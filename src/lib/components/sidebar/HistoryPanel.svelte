<script lang="ts">
  import { historyStore, type FileVersion } from "$lib/stores/history.svelte";
  import { filesStore } from "$lib/stores/files.svelte";
  import { i18n } from "$lib/stores/i18n.svelte";
  import Button from "$lib/components/ui/button.svelte";
  import { History, RotateCcw, Eye, Trash2, Copy, Check } from "lucide-svelte";

  interface Props {
    class?: string;
  }

  let { class: className }: Props = $props();

  let selectedVersion = $state<FileVersion | null>(null);
  let showDiff = $state(false);
  let copiedLines = $state<Set<number>>(new Set());

  function formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - timestamp;

    // Less than 1 hour
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return minutes <= 1 ? "Just now" : `${minutes} min ago`;
    }

    // Less than 24 hours
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    }

    // Less than 7 days
    if (diff < 604800000) {
      const days = Math.floor(diff / 86400000);
      return `${days} day${days > 1 ? "s" : ""} ago`;
    }

    // Otherwise show date
    return date.toLocaleDateString(i18n.language === "ar" ? "ar-SA" : "en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function handleRestore(version: FileVersion) {
    if (
      confirm(
        i18n.t.history?.confirmRestore ||
          "Restore this version? Current changes will be saved to history."
      )
    ) {
      await filesStore.restoreVersion(version.id);
      selectedVersion = null;
      showDiff = false;
    }
  }

  async function handleDelete(version: FileVersion, event: MouseEvent) {
    event.stopPropagation();
    if (confirm(i18n.t.history?.confirmDelete || "Delete this version?")) {
      await historyStore.deleteVersion(version.id);
    }
  }

  function handleViewDiff(version: FileVersion) {
    selectedVersion = version;
    showDiff = true;
    copiedLines = new Set();
  }

  function closeDiff() {
    selectedVersion = null;
    showDiff = false;
    copiedLines = new Set();
  }

  // Compute diff between version and current content
  function computeDiff(oldContent: string, newContent: string): DiffLine[] {
    const oldLines = oldContent.split("\n");
    const newLines = newContent.split("\n");
    const diff: DiffLine[] = [];

    // Simple line-by-line diff (for more complex diffs, use a diff library)
    const maxLen = Math.max(oldLines.length, newLines.length);

    let oldIdx = 0;
    let newIdx = 0;

    while (oldIdx < oldLines.length || newIdx < newLines.length) {
      const oldLine = oldLines[oldIdx];
      const newLine = newLines[newIdx];

      if (oldLine === newLine) {
        diff.push({
          type: "unchanged",
          content: oldLine || "",
          lineNum: newIdx + 1,
        });
        oldIdx++;
        newIdx++;
      } else if (oldLine !== undefined && !newLines.includes(oldLine)) {
        diff.push({ type: "removed", content: oldLine, lineNum: oldIdx + 1 });
        oldIdx++;
      } else if (newLine !== undefined && !oldLines.includes(newLine)) {
        diff.push({ type: "added", content: newLine, lineNum: newIdx + 1 });
        newIdx++;
      } else {
        // Changed line
        if (oldLine !== undefined) {
          diff.push({ type: "removed", content: oldLine, lineNum: oldIdx + 1 });
          oldIdx++;
        }
        if (newLine !== undefined) {
          diff.push({ type: "added", content: newLine, lineNum: newIdx + 1 });
          newIdx++;
        }
      }
    }

    return diff;
  }

  interface DiffLine {
    type: "added" | "removed" | "unchanged";
    content: string;
    lineNum: number;
  }

  let diffLines = $derived(
    selectedVersion && filesStore.currentFile
      ? computeDiff(selectedVersion.content, filesStore.currentFile.content)
      : []
  );

  function copyLine(index: number, line: DiffLine) {
    const prefix = line.type === "added" ? "+" : "-";
    const text = `${line.lineNum}: ${prefix} ${line.content}`;
    navigator.clipboard.writeText(text);
    copiedLines.add(index);
    copiedLines = new Set(copiedLines);

    setTimeout(() => {
      copiedLines.delete(index);
      copiedLines = new Set(copiedLines);
    }, 2000);
  }

  function copyAllChanges(type: "added" | "removed") {
    const prefix = type === "added" ? "+" : "-";
    const lines = diffLines
      .filter((line) => line.type === type)
      .map((line) => `${line.lineNum}: ${prefix} ${line.content}`)
      .join("\n");

    navigator.clipboard.writeText(lines);
  }
</script>

<div class="flex h-full flex-col {className}">
  <!-- Header -->
  <div class="flex items-center justify-between border-b border-border p-3">
    <h2 class="flex items-center gap-2 text-sm font-semibold">
      <History class="h-4 w-4" />
      {i18n.t.history?.title || "History"}
    </h2>
  </div>

  <!-- Content -->
  <div class="flex-1 overflow-auto">
    {#if !filesStore.currentFile}
      <div class="p-4 text-center text-sm text-muted-foreground">
        {i18n.t.history?.noFile || "Open a file to see its history"}
      </div>
    {:else if historyStore.isLoading}
      <div class="flex items-center justify-center p-4 text-muted-foreground">
        <span class="animate-pulse"
          >{i18n.t.history?.loading || "Loading..."}</span
        >
      </div>
    {:else if historyStore.versions.length === 0}
      <div class="p-4 text-center text-sm text-muted-foreground">
        {i18n.t.history?.noVersions || "No previous versions"}
      </div>
    {:else}
      <div class="divide-y divide-border">
        {#each historyStore.versions as version (version.id)}
          <div
            class="group flex items-center justify-between p-3 hover:bg-accent"
          >
            <div class="min-w-0 flex-1">
              <div class="text-sm font-medium">
                {formatDate(version.timestamp)}
              </div>
              <div class="text-xs text-muted-foreground">
                {formatSize(version.size)}
              </div>
            </div>
            <div class="flex gap-1 opacity-0 group-hover:opacity-100">
              <button
                type="button"
                class="rounded p-1 hover:bg-background"
                onclick={() => handleViewDiff(version)}
                title={i18n.t.history?.viewDiff || "View changes"}
              >
                <Eye class="h-4 w-4" />
              </button>
              <button
                type="button"
                class="rounded p-1 hover:bg-background"
                onclick={() => handleRestore(version)}
                title={i18n.t.history?.restore || "Restore"}
              >
                <RotateCcw class="h-4 w-4" />
              </button>
              <button
                type="button"
                class="rounded p-1 text-destructive hover:bg-background"
                onclick={(e) => handleDelete(version, e)}
                title={i18n.t.history?.delete || "Delete"}
              >
                <Trash2 class="h-4 w-4" />
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<!-- Diff Modal -->
{#if showDiff && selectedVersion}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-transparent"
    onclick={closeDiff}
    onkeydown={(e) => e.key === "Escape" && closeDiff()}
    tabindex="-1"
    role="dialog"
    aria-modal="true"
  >
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-lg bg-white dark:bg-gray-900 shadow-2xl border border-border"
      onclick={(e) => e.stopPropagation()}
    >
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-border p-4">
        <div>
          <h2 class="text-lg font-semibold">
            {i18n.t.history?.diffTitle || "Version Comparison"}
          </h2>
          <p class="text-sm text-muted-foreground">
            {formatDate(selectedVersion.timestamp)} → {i18n.t.history
              ?.current || "Current"}
          </p>
        </div>
        <div class="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onclick={() => copyAllChanges("removed")}
          >
            <Copy class="me-1 h-3 w-3" />
            {i18n.t.history?.copyRemoved || "Copy Removed"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onclick={() => copyAllChanges("added")}
          >
            <Copy class="me-1 h-3 w-3" />
            {i18n.t.history?.copyAdded || "Copy Added"}
          </Button>
          <Button
            variant="default"
            size="sm"
            onclick={() => selectedVersion && handleRestore(selectedVersion)}
          >
            <RotateCcw class="me-1 h-3 w-3" />
            {i18n.t.history?.restore || "Restore"}
          </Button>
        </div>
      </div>

      <!-- Diff Content -->
      <div class="max-h-[70vh] overflow-auto p-4 font-mono text-sm">
        {#each diffLines as line, index (index)}
          <div
            class="group flex items-start gap-2 rounded px-2 py-0.5 {line.type ===
            'added'
              ? 'bg-green-500/10 text-green-700 dark:text-green-400'
              : line.type === 'removed'
                ? 'bg-red-500/10 text-red-700 dark:text-red-400'
                : ''}"
          >
            <span class="w-8 shrink-0 text-end text-muted-foreground"
              >{line.lineNum}</span
            >
            <span class="w-4 shrink-0 text-center">
              {#if line.type === "added"}+{:else if line.type === "removed"}-{:else}&nbsp;{/if}
            </span>
            <span class="flex-1 whitespace-pre-wrap break-all"
              >{line.content || " "}</span
            >
            {#if line.type !== "unchanged"}
              <button
                type="button"
                class="shrink-0 rounded p-0.5 opacity-0 hover:bg-background group-hover:opacity-100"
                onclick={() => copyLine(index, line)}
                title={i18n.t.history?.copyLine || "Copy line"}
              >
                {#if copiedLines.has(index)}
                  <Check class="h-3 w-3 text-green-500" />
                {:else}
                  <Copy class="h-3 w-3" />
                {/if}
              </button>
            {/if}
          </div>
        {/each}
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-between border-t border-border p-4">
        <div class="text-sm text-muted-foreground">
          <span class="text-green-600"
            >+{diffLines.filter((l) => l.type === "added").length}</span
          >
          <span class="mx-2">/</span>
          <span class="text-red-600"
            >-{diffLines.filter((l) => l.type === "removed").length}</span
          >
        </div>
        <Button variant="outline" onclick={closeDiff}>
          {i18n.t.settings?.close || "Close"}
        </Button>
      </div>
    </div>
  </div>
{/if}
