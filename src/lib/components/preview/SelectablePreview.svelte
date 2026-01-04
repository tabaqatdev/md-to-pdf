<script lang="ts">
  import MarkdownPreview from "./MarkdownPreview.svelte";

  interface Props {
    content: string;
    onEdit?: (originalText: string, newText: string) => void;
  }

  let { content, onEdit }: Props = $props();

  let containerRef: HTMLDivElement;
  let showToolbar = $state(false);
  let toolbarPosition = $state({ x: 0, y: 0 });
  let selectedText = $state("");
  let selectedElement: HTMLElement | null = null;

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

    // Find the parent editable element (p, h1-h6, li, etc.)
    let element = commonAncestor as HTMLElement;
    while (element && element !== containerRef) {
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

    const originalText = selectedElement.textContent || "";

    // Make element contenteditable
    selectedElement.contentEditable = "true";
    selectedElement.focus();

    // Select the text
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(selectedElement);
    selection?.removeAllRanges();
    selection?.addRange(range);

    showToolbar = false;

    // Listen for blur to save
    const handleBlur = () => {
      selectedElement!.contentEditable = "false";
      const newText = selectedElement!.textContent || "";

      if (newText !== originalText && onEdit) {
        onEdit(originalText, newText);
      }

      selectedElement!.removeEventListener("blur", handleBlur);
      selectedElement!.removeEventListener("keydown", handleKeydown);
    };

    // Listen for Escape to cancel
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

  function handleDelete() {
    if (!selectedElement) return;

    // TODO: Implement delete functionality
    console.log("Delete element:", selectedElement);
    showToolbar = false;
  }

  // Listen for selection changes
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
      <button class="toolbar-btn" onclick={handleEdit} title="Edit selection">
        ✏️ Edit
      </button>
      <button
        class="toolbar-btn delete"
        onclick={handleDelete}
        title="Delete element"
      >
        🗑️
      </button>
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
    background: hsl(var(--primary));
    border-radius: 8px;
    padding: 4px;
    display: flex;
    gap: 2px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
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
    background: transparent;
    border: none;
    color: hsl(var(--primary-foreground));
    padding: 8px 12px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    transition: background 0.2s;
    white-space: nowrap;
  }

  .toolbar-btn:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  .toolbar-btn.delete:hover {
    background: rgba(220, 38, 38, 0.2);
  }

  /* Style for elements being edited */
  :global([contenteditable="true"]) {
    outline: 2px solid hsl(var(--primary));
    outline-offset: 2px;
    border-radius: 4px;
    padding: 4px;
    background: rgba(var(--primary-rgb), 0.05);
  }
</style>
