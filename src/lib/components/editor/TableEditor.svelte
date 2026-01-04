<script lang="ts">
  import Button from "$lib/components/ui/button.svelte";

  interface Props {
    tableMarkdown: string;
    onSave: (newMarkdown: string) => void;
    onClose: () => void;
  }

  let { tableMarkdown, onSave, onClose }: Props = $props();

  // Parse markdown table into 2D array
  function parseTable(markdown: string): string[][] {
    const lines = markdown.trim().split("\n");
    const rows: string[][] = [];

    for (let i = 0; i < lines.length; i++) {
      // Skip separator line (contains ---)
      if (lines[i].includes("---")) continue;

      const cells = lines[i]
        .split("|")
        .slice(1, -1) // Remove empty first/last from split
        .map((cell) => cell.trim());

      if (cells.length > 0) {
        rows.push(cells);
      }
    }

    return rows;
  }

  let tableData = $state(parseTable(tableMarkdown));
  let hasHeader = $state(true);

  function addColumn() {
    tableData = tableData.map((row) => [...row, ""]);
  }

  function removeColumn(colIndex: number) {
    if (tableData[0].length <= 1) return; // Keep at least 1 column
    tableData = tableData.map((row) => row.filter((_, i) => i !== colIndex));
  }

  function addRow() {
    const newRow = new Array(tableData[0].length).fill("");
    tableData = [...tableData, newRow];
  }

  function removeRow(rowIndex: number) {
    if (tableData.length <= 1) return; // Keep at least 1 row
    tableData = tableData.filter((_, i) => i !== rowIndex);
  }

  function handleCellEdit(rowIndex: number, colIndex: number, value: string) {
    tableData[rowIndex][colIndex] = value;
  }

  function generateMarkdown(): string {
    if (tableData.length === 0) return "";

    const header = tableData[0];
    const separator = header.map(() => "---");
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
</script>

<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-transparent"
  onclick={onClose}
>
  <div
    class="w-full max-w-5xl max-h-[90vh] rounded-lg bg-card border-2 border-border shadow-2xl overflow-hidden flex flex-col"
    onclick={(e) => e.stopPropagation()}
  >
    <!-- Header -->
    <div
      class="flex items-center justify-between px-6 py-4 border-b-2 border-border bg-card"
    >
      <h2 class="text-xl font-bold">Edit Table</h2>
      <div class="flex gap-2">
        <Button variant="outline" size="sm" onclick={addColumn}>
          ➕ Add Column
        </Button>
        <Button variant="outline" size="sm" onclick={addRow}>➕ Add Row</Button>
      </div>
    </div>

    <!-- Table Editor -->
    <div class="flex-1 overflow-auto p-6">
      <div class="overflow-x-auto">
        <table class="w-full border-collapse">
          <thead>
            <tr>
              <th class="w-12"></th>
              {#each tableData[0] || [] as _, colIndex}
                <th class="relative">
                  <button
                    class="absolute -top-2 right-1 w-6 h-6 rounded bg-red-500 text-white text-xs hover:bg-red-600"
                    onclick={() => removeColumn(colIndex)}
                    title="Remove column"
                  >
                    ✕
                  </button>
                </th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each tableData as row, rowIndex}
              <tr>
                <td class="text-center">
                  <button
                    class="w-6 h-6 rounded bg-red-500 text-white text-xs hover:bg-red-600"
                    onclick={() => removeRow(rowIndex)}
                    title="Remove row"
                  >
                    ✕
                  </button>
                </td>
                {#each row as cell, colIndex}
                  <td class="p-1">
                    <input
                      type="text"
                      value={cell}
                      oninput={(e) =>
                        handleCellEdit(
                          rowIndex,
                          colIndex,
                          e.currentTarget.value
                        )}
                      class="w-full px-3 py-2 border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      class:font-bold={rowIndex === 0 && hasHeader}
                    />
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Footer -->
    <div
      class="flex justify-end gap-2 px-6 py-4 border-t-2 border-border bg-card"
    >
      <Button variant="outline" onclick={onClose}>Cancel</Button>
      <Button onclick={handleSave}>Save Changes</Button>
    </div>
  </div>
</div>

<style>
  th,
  td {
    padding: 0.5rem;
  }

  th {
    position: relative;
    padding-top: 2rem;
  }
</style>
