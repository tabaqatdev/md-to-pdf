<script lang="ts">
  import Button from "$lib/components/ui/button.svelte";
  import {
    AlignLeft,
    AlignCenter,
    AlignRight,
    Trash2,
    Plus,
    X,
    Save,
    Columns,
    Rows,
  } from "lucide-svelte";
  import { fade, scale } from "svelte/transition";
  import { cubicOut } from "svelte/easing";

  interface Props {
    tableMarkdown: string;
    onSave: (newMarkdown: string) => void;
    onClose: () => void;
  }

  let { tableMarkdown, onSave, onClose }: Props = $props();

  type Alignment = "left" | "center" | "right";

  // Parse markdown table into 2D array and extract alignment
  function parseTable(markdown: string): {
    rows: string[][];
    alignments: Alignment[];
  } {
    const lines = markdown.trim().split("\n");
    const rows: string[][] = [];
    let alignments: Alignment[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // Parse separator line for alignment
      if (line.match(/^\|?\s*:?-+:?\s*(\|.*)+$/)) {
        const parts = line
          .split("|")
          .filter((p) => p.trim() !== "") // Remove outer empty parts
          .map((p) => p.trim());

        alignments = parts.map((part) => {
          if (part.startsWith(":") && part.endsWith(":")) return "center";
          if (part.endsWith(":")) return "right";
          return "left";
        });
        continue;
      }

      const cells = line
        .split("|")
        .slice(1, -1) // Remove empty first/last from split
        .map((cell) => cell.trim());

      if (cells.length > 0) {
        rows.push(cells);
      }
    }

    // Default alignment if not found or mismatch
    if (alignments.length === 0 && rows.length > 0) {
      alignments = new Array(rows[0].length).fill("left");
    }

    // Ensure alignment array matches row length (handle edge cases)
    if (rows.length > 0 && alignments.length < rows[0].length) {
      const diff = rows[0].length - alignments.length;
      alignments = [...alignments, ...new Array(diff).fill("left")];
    }

    return { rows, alignments };
  }

  // svelte-ignore state_referenced_locally
  const parsed = parseTable(tableMarkdown);

  // svelte-ignore state_referenced_locally
  let tableData = $state(parsed.rows);
  // svelte-ignore state_referenced_locally
  let columnAlignments = $state<Alignment[]>(parsed.alignments);
  let hoveredCol = $state<number | null>(null);
  let hoveredRow = $state<number | null>(null);

  function addColumn() {
    tableData = tableData.map((row) => [...row, ""]);
    columnAlignments = [...columnAlignments, "left"];
  }

  function removeColumn(colIndex: number) {
    if (tableData[0].length <= 1) return; // Keep at least 1 column
    tableData = tableData.map((row) => row.filter((_, i) => i !== colIndex));
    columnAlignments = columnAlignments.filter((_, i) => i !== colIndex);
  }

  function addRow() {
    const newRow = new Array(tableData[0].length).fill("");
    tableData = [...tableData, newRow];
  }

  function removeRow(rowIndex: number) {
    if (tableData.length <= 1) return; // Keep at least 1 row
    tableData = tableData.filter((_, i) => i !== rowIndex);
  }

  function toggleAlignment(colIndex: number) {
    const current = columnAlignments[colIndex];
    const nextFn = (curr: Alignment): Alignment => {
      if (curr === "left") return "center";
      if (curr === "center") return "right";
      return "left";
    };
    columnAlignments[colIndex] = nextFn(current);
  }

  function handleCellEdit(rowIndex: number, colIndex: number, value: string) {
    tableData[rowIndex][colIndex] = value;
  }

  function generateMarkdown(): string {
    if (tableData.length === 0) return "";

    const header = tableData[0];
    const separator = columnAlignments.map((align) => {
      if (align === "center") return ":---:";
      if (align === "right") return "---:";
      return ":---";
    });
    const body = tableData.slice(1);

    return [
      `| ${header.join(" | ")} |`,
      `| ${separator.join(" | ")} |`,
      ...body.map((row) => `| ${row.join(" | ")} |`),
    ].join("\n");
  }

  function handleSave() {
    const markdown = generateMarkdown();
    onSave(markdown);
  }

  function getAlignIcon(align: Alignment) {
    switch (align) {
      case "center":
        return AlignCenter;
      case "right":
        return AlignRight;
      default:
        return AlignLeft;
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-all duration-300"
  transition:fade={{ duration: 200 }}
  onclick={onClose}
>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="relative flex w-full max-w-6xl max-h-[90vh] flex-col overflow-hidden rounded-2xl border border-white/20 bg-background/95 shadow-2xl backdrop-blur-xl ring-1 ring-black/5 dark:ring-white/10"
    onclick={(e) => e.stopPropagation()}
    transition:scale={{ start: 0.95, duration: 300, easing: cubicOut }}
  >
    <!-- Header -->
    <div
      class="flex items-center justify-between border-b border-border/50 bg-muted/30 px-6 py-4 backdrop-blur-xl"
    >
      <div class="flex items-center gap-3">
        <div
          class="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"
        >
          <Columns class="h-5 w-5" />
        </div>
        <div>
          <h2 class="text-xl font-semibold tracking-tight">Table Editor</h2>
          <p class="text-xs text-muted-foreground">
            Modify content & alignment
          </p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onclick={onClose}
          class="h-9 w-9 rounded-full hover:bg-destructive/10 hover:text-destructive"
        >
          <X class="h-5 w-5" />
        </Button>
      </div>
    </div>

    <!-- Toolbar -->
    <div
      class="flex items-center gap-2 border-b border-border/50 bg-background/50 px-6 py-2 backdrop-blur-sm"
    >
      <Button
        variant="outline"
        size="sm"
        onclick={addColumn}
        class="h-8 gap-2 text-xs font-medium"
      >
        <Plus class="h-3.5 w-3.5" /> Column
      </Button>
      <Button
        variant="outline"
        size="sm"
        onclick={addRow}
        class="h-8 gap-2 text-xs font-medium"
      >
        <Plus class="h-3.5 w-3.5" /> Row
      </Button>
      <div class="mx-2 h-4 w-px bg-border/50"></div>
      <span class="text-xs text-muted-foreground">
        {tableData.length} rows × {tableData[0]?.length || 0} columns
      </span>
    </div>

    <!-- Table Container -->
    <div class="flex-1 overflow-auto bg-muted/10 p-8">
      <div
        class="relative overflow-visible rounded-lg border border-border bg-card shadow-sm"
      >
        <div class="overflow-x-auto">
          <table class="w-full border-collapse text-sm">
            <thead>
              <tr class="bg-muted/50 border-b border-border">
                <th
                  class="w-10 sticky left-0 z-10 bg-muted/50 border-r border-border/50"
                ></th>
                {#each tableData[0] || [] as _, colIndex}
                  {@const Icon = getAlignIcon(columnAlignments[colIndex])}
                  <th
                    class="group relative min-w-[120px] p-0 font-medium text-muted-foreground transition-colors hover:bg-muted"
                    onmouseenter={() => (hoveredCol = colIndex)}
                    onmouseleave={() => (hoveredCol = null)}
                  >
                    <div
                      class="flex items-center justify-between gap-2 px-3 py-2.5"
                    >
                      <span class="text-xs font-mono opacity-50"
                        >#{colIndex + 1}</span
                      >
                      <div
                        class="flex items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                      >
                        <!-- Alignment Toggle -->
                        <button
                          class="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-background hover:text-foreground"
                          onclick={() => toggleAlignment(colIndex)}
                          title="Toggle Alignment ({columnAlignments[
                            colIndex
                          ]})"
                          aria-label="Toggle alignment"
                        >
                          <Icon class="h-3.5 w-3.5" />
                        </button>
                        <!-- Remove Column -->
                        <button
                          class="flex h-6 w-6 items-center justify-center rounded text-destructive/70 transition-colors hover:bg-destructive hover:text-destructive-foreground"
                          onclick={() => removeColumn(colIndex)}
                          title="Remove column"
                          aria-label="Remove column"
                        >
                          <Trash2 class="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <!-- Active Indicator -->
                    {#if columnAlignments[colIndex] !== "left"}
                      <div
                        class="absolute bottom-0 inset-x-0 h-0.5 bg-primary/50"
                      ></div>
                    {/if}
                  </th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#each tableData as row, rowIndex}
                <tr
                  class="group border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"
                  onmouseenter={() => (hoveredRow = rowIndex)}
                  onmouseleave={() => (hoveredRow = null)}
                >
                  <td
                    class="sticky left-0 z-10 w-10 border-r border-border/50 bg-card p-0 text-center"
                  >
                    <div class="flex h-full w-full items-center justify-center">
                      <button
                        class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground/50 opacity-0 hover:bg-destructive hover:text-destructive-foreground group-hover:opacity-100 transition-all"
                        onclick={() => removeRow(rowIndex)}
                        title="Remove row"
                        aria-label="Remove row"
                      >
                        <Trash2 class="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                  {#each row as cell, colIndex}
                    <td class="p-0">
                      <div class="relative">
                        <input
                          type="text"
                          value={cell}
                          oninput={(e) =>
                            handleCellEdit(
                              rowIndex,
                              colIndex,
                              e.currentTarget.value
                            )}
                          class="w-full border-0 bg-transparent px-3 py-2.5 focus:bg-accent/20 focus:ring-2 focus:ring-inset focus:ring-primary/50 focus:outline-none text-foreground placeholder:text-muted-foreground/30 transition-all {rowIndex ===
                          0
                            ? 'font-semibold text-foreground/90'
                            : ''}"
                          style="text-align: {columnAlignments[colIndex] ||
                            'left'};"
                          placeholder={rowIndex === 0 ? "Header" : "Cell"}
                        />
                      </div>
                    </td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
      <div class="mt-4 text-center">
        <p class="text-xs text-muted-foreground">
          Tips: Click alignment icons in headers to change column alignment.
          Hover over row/col headers to delete.
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div
      class="flex justify-end gap-3 border-t border-border/50 bg-background/50 px-6 py-4 backdrop-blur-xl"
    >
      <Button variant="ghost" onclick={onClose} class="hover:bg-muted"
        >Cancel</Button
      >
      <Button onclick={handleSave} class="gap-2 shadow-lg shadow-primary/20">
        <Save class="h-4 w-4" />
        Save Changes
      </Button>
    </div>
  </div>
</div>
