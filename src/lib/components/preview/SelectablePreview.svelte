<script lang="ts">
  import MarkdownPreview from "./MarkdownPreview.svelte";

  interface Props {
    content: string;
    onEdit?: (originalText: string, newText: string) => void;
    onEditTable?: (tableMarkdown: string) => void;
  }

  let { content, onEdit, onEditTable }: Props = $props();

  let containerRef: HTMLDivElement;
  let showToolbar = $state(false);
  let toolbarPosition = $state({ x: 0, y: 0 });
  let selectedText = $state("");
  let selectedElement: HTMLElement | null = null;
  let isTableSelected = $state(false);

  function handleSelectionChange() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !containerRef) {
      showToolbar = false;
      return;
    }

    const text = selection.toString().trim();
    if (!text || text.length === 0) {
      showToolbar = false;
      return;
    }

    // Check if selection is within our preview container
    const range = selection.getRangeAt(0);
    const commonAncestor = range.commonAncestorContainer;

    if (!containerRef.contains(commonAncestor as Node)) {
      showToolbar = false;
      return;
    }

    selectedText = text;

    // Find the parent element - check for table first
    let element = commonAncestor as HTMLElement;
    isTableSelected = false;

    while (element && element !== containerRef) {
      if (element.tagName === "TABLE") {
        selectedElement = element;
        isTableSelected = true;
        break;
      }

      if (
        [
          "P",
          "H1",
          "H2",
          "H3",
          "H4",
          "H5",
          "H6",
          "LI",
          "BLOCKQUOTE",
          "TD",
          "TH",
        ].includes(element.tagName)
      ) {
        selectedElement = element;
        isTableSelected = false;
        break;
      }
      element = element.parentElement as HTMLElement;
    }

    // Position toolbar near selection
    const rect = range.getBoundingClientRect();
    const containerRect = containerRef.getBoundingClientRect();

    toolbarPosition = {
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.top - containerRect.top - 50, // Above selection
    };

    showToolbar = true;
  }

  function handleEdit() {
    if (!selectedElement) return;

    // If table is selected, emit table edit event
    if (isTableSelected && onEditTable) {
      const tableMarkdown = extractTableMarkdown(
        selectedElement as HTMLTableElement
      );
      onEditTable(tableMarkdown);
      showToolbar = false;
      return;
    }

    // Otherwise, inline edit for regular text
    const originalText = selectedElement.textContent || "";

    selectedElement.contentEditable = "true";
    selectedElement.focus();

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(selectedElement);
    selection?.removeAllRanges();
    selection?.addRange(range);

    showToolbar = false;

    const handleBlur = () => {
      selectedElement!.contentEditable = "false";
      const newText = selectedElement!.textContent || "";

      if (newText !== originalText && onEdit) {
        onEdit(originalText, newText);
      }

      selectedElement!.removeEventListener("blur", handleBlur);
      selectedElement!.removeEventListener("keydown", handleKeydown);
    };

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        selectedElement!.textContent = originalText;
        selectedElement!.contentEditable = "false";
        selectedElement!.blur();
      } else if (
        e.key === "Enter" &&
        !e.shiftKey &&
        selectedElement!.tagName !== "LI"
      ) {
        e.preventDefault();
        selectedElement!.blur();
      }
    };

    selectedElement.addEventListener("blur", handleBlur);
    selectedElement.addEventListener("keydown", handleKeydown);
  }

  function extractTableMarkdown(table: HTMLTableElement): string {
    const rows: string[][] = [];

    // Get headers
    const headers = Array.from(table.querySelectorAll("thead tr th")).map(
      (th) => th.textContent?.trim() || ""
    );
    if (headers.length > 0) {
      rows.push(headers);
    }

    // Get body rows
    const bodyRows = table.querySelectorAll("tbody tr");
    bodyRows.forEach((tr) => {
      const cells = Array.from(tr.querySelectorAll("td")).map(
        (td) => td.textContent?.trim() || ""
      );
      if (cells.length > 0) {
        rows.push(cells);
      }
    });

    // Convert to markdown
    if (rows.length === 0) return "";

    const header = rows[0];
    const separator = header.map(() => "---");
    const body = rows.slice(1);

    return [
      `| ${header.join(" | ")} |`,
      `| ${separator.join(" | ")} |`,
      ...body.map((row) => `| ${row.join(" | ")} |`),
    ].join("\n");
  }

  function handleDelete() {
    if (!selectedElement) return;
    console.log("Delete element:", selectedElement);
    showToolbar = false;
  }

  $effect(() => {
    document.addEventListener("selectionchange", handleSelectionChange);

    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  });
</script>

<div bind:this={containerRef} class="selection-preview relative">
  <MarkdownPreview {content} />

  {#if showToolbar}
    <div
      class="selection-toolbar"
      style="left: {toolbarPosition.x}px; top: {toolbarPosition.y}px;"
    >
      <button
        class="toolbar-btn"
        onclick={handleEdit}
        title={isTableSelected ? "Edit table" : "Edit selection"}
      >
        ✏️ {isTableSelected ? "Edit Table" : "Edit"}
      </button>
      {#if !isTableSelected}
        <button
          class="toolbar-btn delete"
          onclick={handleDelete}
          title="Delete element"
        >
          🗑️
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .selection-preview {
    position: relative;
  }

  .selection-toolbar {
    position: absolute;
    transform: translateX(-50%);
    background: hsl(var(--card));
    border: 1px solid hsl(var(--border));
    border-radius: 8px;
    padding: 4px;
    display: flex;
    gap: 2px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    z-index: 100;
    animation: fadeIn 0.15s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(-5px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }

  .toolbar-btn {
    background: hsl(var(--background));
    border: 1px solid hsl(var(--border));
    color: hsl(var(--foreground));
    padding: 8px 14px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .toolbar-btn:hover {
    background: hsl(var(--accent));
    color: hsl(var(--accent-foreground));
    border-color: hsl(var(--accent));
  }

  .toolbar-btn.delete:hover {
    background: hsl(0 84% 60%);
    color: white;
    border-color: hsl(0 84% 60%);
  }

  :global([contenteditable="true"]) {
    outline: 2px solid hsl(var(--primary));
    outline-offset: 2px;
    border-radius: 4px;
    padding: 4px;
    background: hsl(var(--accent) / 0.1);
  }
</style>
