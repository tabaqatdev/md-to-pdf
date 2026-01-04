<script lang="ts">
  import { onMount } from "svelte";
  import MarkdownPreview from "./MarkdownPreview.svelte";
  import { Edit2 } from "lucide-svelte";

  interface Props {
    content: string;
    onEditTable?: (markdown: string, tableIndex: number) => void;
    onEditMermaid?: (code: string, diagramIndex: number) => void;
  }

  let { content, onEditTable, onEditMermaid }: Props = $props();

  let containerRef: HTMLDivElement;
  let editButtons: {
    element: HTMLElement;
    type: "table" | "mermaid";
    index: number;
  }[] = [];

  // Add edit buttons to tables and Mermaid diagrams
  function addEditButtons() {
    if (!containerRef) return;

    // Clear existing buttons
    editButtons.forEach((btn) => btn.element.remove());
    editButtons = [];

    // Find all tables
    const tables = containerRef.querySelectorAll("table");
    tables.forEach((table, index) => {
      const wrapper = document.createElement("div");
      wrapper.className = "relative group inline-block w-full";

      const editBtn = document.createElement("button");
      editBtn.className =
        "absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity rounded-md bg-primary text-primary-foreground p-2 shadow-lg hover:bg-primary/90";
      editBtn.innerHTML =
        '<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>';
      editBtn.title = "Edit table";
      editBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleEditTable(table, index);
      };

      // Wrap table
      table.parentNode?.insertBefore(wrapper, table);
      wrapper.appendChild(table);
      wrapper.appendChild(editBtn);

      editButtons.push({ element: wrapper, type: "table", index });
    });

    // Find all Mermaid diagrams
    const diagrams = containerRef.querySelectorAll(".mermaid");
    diagrams.forEach((diagram, index) => {
      const wrapper = document.createElement("div");
      wrapper.className = "relative group inline-block w-full";

      const editBtn = document.createElement("button");
      editBtn.className =
        "absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity rounded-md bg-primary text-primary-foreground p-2 shadow-lg hover:bg-primary/90";
      editBtn.innerHTML =
        '<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>';
      editBtn.title = "Edit diagram";
      editBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleEditMermaid(diagram as HTMLElement, index);
      };

      // Wrap diagram
      diagram.parentNode?.insertBefore(wrapper, diagram);
      wrapper.appendChild(diagram);
      wrapper.appendChild(editBtn);

      editButtons.push({ element: wrapper, type: "mermaid", index });
    });
  }

  function handleEditTable(table: Element, index: number) {
    // Extract markdown from table HTML
    const markdown = extractTableMarkdown(table);
    if (onEditTable) {
      onEditTable(markdown, index);
    }
  }

  function handleEditMermaid(diagram: HTMLElement, index: number) {
    // Extract Mermaid code from data attribute or text content
    const code =
      diagram.getAttribute("data-mermaid-source") || diagram.textContent || "";
    if (onEditMermaid) {
      onEditMermaid(code, index);
    }
  }

  function extractTableMarkdown(table: Element): string {
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

  // Re-add buttons when content changes
  $effect(() => {
    if (content && containerRef) {
      // Wait for MarkdownPreview to render
      setTimeout(() => {
        addEditButtons();
      }, 100);
    }
  });
</script>

<div bind:this={containerRef} class="enhanced-preview">
  <MarkdownPreview {content} />
</div>

<style>
  .enhanced-preview :global(.relative.group) {
    margin: 1rem 0;
  }
</style>
