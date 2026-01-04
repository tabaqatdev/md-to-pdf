<script lang="ts">
  import { onMount } from "svelte";
  import MarkdownPreview from "./MarkdownPreview.svelte";

  interface Props {
    content: string;
    onEditTable?: (markdown: string, tableIndex: number) => void;
    onEditMermaid?: (code: string, diagramIndex: number) => void;
  }

  let { content, onEditTable, onEditMermaid }: Props = $props();

  let containerRef: HTMLDivElement;

  // Add edit buttons to tables and Mermaid diagrams
  function addEditButtons() {
    if (!containerRef) return;

    // Find all tables
    const tables = containerRef.querySelectorAll("table");
    tables.forEach((table, index) => {
      // Skip if already wrapped
      if (table.parentElement?.classList.contains("editable-wrapper")) return;

      const wrapper = document.createElement("div");
      wrapper.className = "editable-wrapper";
      wrapper.style.cssText = "position: relative; margin: 1rem 0;";

      const editBtn = document.createElement("button");
      editBtn.className = "edit-button";
      editBtn.style.cssText = `
        position: absolute;
        top: 8px;
        right: 8px;
        z-index: 10;
        background: hsl(var(--primary));
        color: hsl(var(--primary-foreground));
        padding: 12px 20px;
        border-radius: 8px;
        border: 2px solid hsl(var(--primary-foreground));
        cursor: pointer;
        transition: all 0.2s;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        font-weight: 700;
        font-size: 14px;
      `;
      editBtn.innerHTML = "✏️ Edit Table";
      editBtn.onmouseenter = () => {
        editBtn.style.transform = "scale(1.05)";
      };
      editBtn.onmouseleave = () => {
        editBtn.style.transform = "scale(1)";
      };
      editBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleEditTable(table, index);
      };

      // Wrap table
      table.parentNode?.insertBefore(wrapper, table);
      wrapper.appendChild(table);
      wrapper.appendChild(editBtn);
    });

    // Find all Mermaid diagrams
    const diagrams = containerRef.querySelectorAll(".mermaid");
    diagrams.forEach((diagram, index) => {
      // Skip if already wrapped
      if (diagram.parentElement?.classList.contains("editable-wrapper")) return;

      const wrapper = document.createElement("div");
      wrapper.className = "editable-wrapper";
      wrapper.style.cssText = "position: relative; margin: 1rem 0;";

      const editBtn = document.createElement("button");
      editBtn.className = "edit-button";
      editBtn.style.cssText = `
        position: absolute;
        top: 8px;
        right: 8px;
        z-index: 10;
        background: hsl(var(--primary));
        color: hsl(var(--primary-foreground));
        padding: 12px 20px;
        border-radius: 8px;
        border: 2px solid hsl(var(--primary-foreground));
        cursor: pointer;
        transition: all 0.2s;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        font-weight: 700;
        font-size: 14px;
      `;
      editBtn.innerHTML = "✏️ Edit Diagram";
      editBtn.onmouseenter = () => {
        editBtn.style.transform = "scale(1.05)";
      };
      editBtn.onmouseleave = () => {
        editBtn.style.transform = "scale(1)";
      };
      editBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleEditMermaid(diagram as HTMLElement, index);
      };

      // Wrap diagram
      diagram.parentNode?.insertBefore(wrapper, diagram);
      wrapper.appendChild(diagram);
      wrapper.appendChild(editBtn);
    });
  }

  function handleEditTable(table: Element, index: number) {
    console.log("Edit table clicked!", index);
    // Extract markdown from table HTML
    const markdown = extractTableMarkdown(table);
    if (onEditTable) {
      onEditTable(markdown, index);
    }
  }

  function handleEditMermaid(diagram: HTMLElement, index: number) {
    console.log("Edit diagram clicked!", index);
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
      }, 200);
    }
  });
</script>

<div bind:this={containerRef} class="enhanced-preview">
  <MarkdownPreview {content} />
</div>
