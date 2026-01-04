<script lang="ts">
  import { filesStore } from "$lib/stores/files.svelte";
  import { i18n } from "$lib/stores/i18n.svelte";
  import { settingsStore } from "$lib/stores/settings.svelte";
  import { mode, toggleMode } from "mode-watcher";
  import Sidebar from "$lib/components/sidebar/Sidebar.svelte";
  import MarkdownEditor from "$lib/components/editor/MarkdownEditor.svelte";
  import MarkdownPreview from "$lib/components/preview/MarkdownPreview.svelte";
  import SelectablePreview from "$lib/components/preview/SelectablePreview.svelte";
  import SettingsModal from "$lib/components/settings/SettingsModal.svelte";
  import TableEditor from "$lib/components/editor/TableEditor.svelte";
  import Button from "$lib/components/ui/button.svelte";
  import Separator from "$lib/components/ui/separator.svelte";
  import {
    Sun,
    Moon,
    Monitor,
    Settings,
    Save,
    FileDown,
    Languages,
    PanelLeftClose,
    PanelLeft,
    FilePlus,
    Eye,
    Code2,
  } from "lucide-svelte";

  // Get current mode value for reactivity
  let currentMode = $derived(mode.current);

  let showSidebar = $state(true);
  let showSettings = $state(false);
  let editorContent = $state("");
  let isDragging = $state(false);
  let viewMode = $state<"edit-only" | "split" | "preview-only">("split");

  // Resizable panel state
  let editorWidthPercent = $state(50); // 50% default
  let isResizing = $state(false);
  let containerRef: HTMLDivElement;

  // Mobile view state (show editor or preview)
  let mobileView = $state<"editor" | "preview">("editor");

  // Sync editor content with current file
  $effect(() => {
    if (filesStore.currentFile) {
      editorContent = filesStore.currentFile.content;
    }
  });

  function handleContentChange(content: string) {
    editorContent = content;
    filesStore.updateContent(content);
  }

  async function handleSave() {
    if (!filesStore.currentFile) return;

    // If it's a new file, prompt for filename
    if (filesStore.currentFile.isNew) {
      const filename = prompt(
        i18n.t.actions.enterFileName || "Enter file name:",
        "Untitled.md"
      );
      if (!filename) return;

      await filesStore.saveNewFile("", filename);
    } else {
      await filesStore.saveCurrentFile();
    }
  }

  function handleExportPDF() {
    window.print();
  }

  function handleNewFile() {
    filesStore.newUnsavedFile();
    editorContent = "";
  }

  function toggleLanguage() {
    i18n.setLanguage(i18n.language === "en" ? "ar" : "en");
  }

  function setViewMode(mode: "edit-only" | "split" | "preview-only") {
    viewMode = mode;
  }

  // Handle selection-based editing
  function handleSelectionEdit(originalText: string, newText: string) {
    if (editorContent.includes(originalText)) {
      const updatedContent = editorContent.replace(originalText, newText);
      handleContentChange(updatedContent);
    }
  }

  // Handle table editing
  let editingTableMarkdown = $state<string | null>(null);

  function handleTableEdit(tableMarkdown: string) {
    editingTableMarkdown = tableMarkdown;
  }

  function handleTableSave(newMarkdown: string) {
    if (editingTableMarkdown && editorContent.includes(editingTableMarkdown)) {
      const updatedContent = editorContent.replace(
        editingTableMarkdown,
        newMarkdown
      );
      handleContentChange(updatedContent);
    }
    editingTableMarkdown = null;
  }

  function handleKeydown(event: KeyboardEvent) {
    // Ctrl/Cmd + S to save
    if ((event.ctrlKey || event.metaKey) && event.key === "s") {
      event.preventDefault();
      handleSave();
    }
  }

  // Drag and drop handlers
  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer?.types.includes("Files")) {
      isDragging = true;
    }
  }

  function handleDragLeave(event: DragEvent) {
    // Only set to false if leaving the main container
    const relatedTarget = event.relatedTarget as HTMLElement;
    const realTarget = event.currentTarget as HTMLElement;
    if (!relatedTarget || !realTarget.contains(relatedTarget)) {
      isDragging = false;
    }
  }

  async function handleDrop(event: DragEvent) {
    event.preventDefault();
    isDragging = false;

    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;

    // Process only markdown files
    for (const file of files) {
      if (
        file.name.endsWith(".md") ||
        file.type === "text/markdown" ||
        file.type === "text/plain"
      ) {
        try {
          const content = await file.text();
          await filesStore.importFile(file.name, content);
        } catch (e) {
          console.error("Failed to import file:", file.name, e);
        }
      }
    }
  }

  // Resize handlers
  function handleResizeStart(event: MouseEvent | TouchEvent) {
    event.preventDefault();
    isResizing = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    if (event instanceof MouseEvent) {
      document.addEventListener("mousemove", handleResizeMove);
      document.addEventListener("mouseup", handleResizeEnd);
    } else {
      document.addEventListener("touchmove", handleResizeMove);
      document.addEventListener("touchend", handleResizeEnd);
    }
  }

  function handleResizeMove(event: MouseEvent | TouchEvent) {
    if (!isResizing || !containerRef) return;

    const clientX =
      event instanceof MouseEvent ? event.clientX : event.touches[0].clientX;
    const containerRect = containerRef.getBoundingClientRect();

    let newPercent: number;
    if (i18n.direction === "rtl") {
      // In RTL, the editor is on the right, so calculate from the right edge
      newPercent =
        ((containerRect.right - clientX) / containerRect.width) * 100;
    } else {
      // In LTR, the editor is on the left, so calculate from the left edge
      newPercent = ((clientX - containerRect.left) / containerRect.width) * 100;
    }

    // Clamp between 20% and 80%
    editorWidthPercent = Math.max(20, Math.min(80, newPercent));
  }

  function handleResizeEnd() {
    isResizing = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    document.removeEventListener("mousemove", handleResizeMove);
    document.removeEventListener("mouseup", handleResizeEnd);
    document.removeEventListener("touchmove", handleResizeMove);
    document.removeEventListener("touchend", handleResizeEnd);
  }

  // Double-click to reset to 50%
  function handleResizeReset() {
    editorWidthPercent = 50;
  }
</script>

<svelte:window onkeydown={handleKeydown} />
<svelte:head>
  <title>{i18n.t.app.title}</title>
</svelte:head>

<div
  class="relative flex h-screen flex-col bg-background text-foreground print:block! print:h-auto! print:overflow-visible!"
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
  role="application"
>
  <!-- Toolbar -->
  <header
    class="no-print flex h-12 items-center justify-between border-b border-border px-4"
    dir={i18n.direction}
  >
    <div class="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        onclick={() => (showSidebar = !showSidebar)}
        title={showSidebar ? "Hide sidebar" : "Show sidebar"}
      >
        {#if showSidebar}
          <PanelLeftClose class="h-4 w-4" />
        {:else}
          <PanelLeft class="h-4 w-4" />
        {/if}
      </Button>

      <Separator orientation="vertical" class="h-6" />

      <Button
        variant="ghost"
        size="icon"
        onclick={handleNewFile}
        title={i18n.t.sidebar.newFile}
      >
        <FilePlus class="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onclick={handleSave}
        disabled={!filesStore.currentFile?.isDirty}
        title={i18n.t.actions.save}
      >
        <Save class="h-4 w-4" />
      </Button>
    </div>

    <div class="flex items-center gap-1">
      {#if filesStore.currentFile}
        <span class="text-sm text-muted-foreground">
          {filesStore.currentFile.name}
          {#if filesStore.currentFile.isDirty}
            <span class="text-yellow-500">*</span>
          {/if}
        </span>
      {/if}
    </div>

    <div class="flex items-center gap-2">
      <!-- Mobile view toggle - only visible on small screens -->
      <div class="flex md:hidden">
        <Button
          variant={mobileView === "editor" ? "default" : "ghost"}
          size="icon"
          onclick={() => (mobileView = "editor")}
          title="Show Editor"
        >
          <Code2 class="h-4 w-4" />
        </Button>
        <Button
          variant={mobileView === "preview" ? "default" : "ghost"}
          size="icon"
          onclick={() => (mobileView = "preview")}
          title="Show Preview"
        >
          <Eye class="h-4 w-4" />
        </Button>
      </div>

      <Separator orientation="vertical" class="h-6 md:hidden" />

      <!-- View Mode Toggle Group -->
      <div class="flex gap-1 items-center">
        <Button
          variant={viewMode === "edit-only" ? "default" : "ghost"}
          size="sm"
          onclick={() => setViewMode("edit-only")}
          title="Edit Only"
        >
          <Code2 class="h-4 w-4" />
        </Button>
        <Button
          variant={viewMode === "split" ? "default" : "ghost"}
          size="sm"
          onclick={() => setViewMode("split")}
          title="Split View"
        >
          <div class="flex gap-0.5">
            <Code2 class="h-3 w-3" />
            <Eye class="h-3 w-3" />
          </div>
        </Button>
        <Button
          variant={viewMode === "preview-only" ? "default" : "ghost"}
          size="sm"
          onclick={() => setViewMode("preview-only")}
          title="Preview Only"
        >
          <Eye class="h-4 w-4" />
        </Button>
      </div>

      <Separator orientation="vertical" class="h-6" />>

      <Button
        variant="ghost"
        size="icon"
        onclick={toggleLanguage}
        title={i18n.language === "en" ? "العربية" : "English"}
      >
        <Languages class="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onclick={toggleMode}
        title={i18n.t.theme.title}
      >
        {#if currentMode === "dark"}
          <Moon class="h-4 w-4" />
        {:else if currentMode === "light"}
          <Sun class="h-4 w-4" />
        {:else}
          <Monitor class="h-4 w-4" />
        {/if}
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onclick={() => (showSettings = true)}
        title={i18n.t.settings.title}
      >
        <Settings class="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" class="h-6" />

      <Button
        variant="outline"
        size="sm"
        onclick={handleExportPDF}
        class="hidden sm:flex"
      >
        <FileDown class="me-2 h-4 w-4" />
        {i18n.t.export.pdf}
      </Button>
      <Button
        variant="outline"
        size="icon"
        onclick={handleExportPDF}
        class="sm:hidden"
        title={i18n.t.export.pdf}
      >
        <FileDown class="h-4 w-4" />
      </Button>
    </div>
  </header>

  <!-- Main Content -->
  <main
    class="flex flex-1 overflow-hidden print:overflow-visible! print:h-auto! print:block!"
  >
    <!-- Sidebar - hidden on mobile when not needed -->
    {#if showSidebar}
      <aside
        class="no-print hidden w-64 shrink-0 border-e border-border bg-sidebar sm:block"
        dir={i18n.direction}
      >
        <Sidebar />
      </aside>
    {/if}

    <!-- Editor and Preview - Support for 3 view modes -->
    <div
      bind:this={containerRef}
      class="editor-preview-container relative flex flex-1 overflow-hidden print:overflow-visible! print:h-auto! print:block!"
    >
      {#if filesStore.currentFile}
        <!-- Edit Only Mode -->
        {#if viewMode === "edit-only"}
          <div class="h-full w-full overflow-hidden print:hidden!">
            <MarkdownEditor
              content={editorContent}
              onchange={handleContentChange}
            />
          </div>

          <!-- Split View Mode -->
        {:else if viewMode === "split"}
          <!-- Editor Pane (Left) -->
          <div
            class="editor-pane h-full overflow-hidden print:hidden!"
            class:mobile-hidden={mobileView !== "editor"}
            style="--editor-width: {editorWidthPercent}%;"
          >
            <MarkdownEditor
              content={editorContent}
              onchange={handleContentChange}
            />
          </div>

          <!-- Resizable Divider -->
          <div
            class="resize-handle no-print"
            onmousedown={handleResizeStart}
            ontouchstart={handleResizeStart}
            ondblclick={handleResizeReset}
            role="separator"
            aria-orientation="vertical"
            aria-valuenow={editorWidthPercent}
            tabindex="0"
          >
            <div class="resize-handle-bar"></div>
          </div>

          <!-- Preview Pane (Right) -->
          <div
            class="preview-pane h-full overflow-hidden border-s border-border print:overflow-visible! print:h-auto! print:block! print:w-full!"
            class:mobile-hidden={mobileView !== "preview"}
            style="--preview-width: {100 - editorWidthPercent}%;"
          >
                        <SelectablePreview
              content={editorContent}
              onEdit={handleSelectionEdit}
              onEditTable={handleTableEdit}
            />
          </div>

          <!-- Preview Only Mode -->
        {:else}
          <div class="h-full w-full overflow-auto p-6">
            <SelectablePreview
              content={editorContent}
              onEdit={handleSelectionEdit}
              onEditTable={handleTableEdit}
            />
          </div>
        {/if}
      {:else}
        <!-- No file open -->
        <div
          class="flex h-full items-center justify-center text-muted-foreground"
        >
          <div class="text-center">
            <p class="mb-2 text-lg">{i18n.t.app.title}</p>
            <p class="text-sm">{i18n.t.sidebar.noFiles}</p>
            <Button variant="outline" class="mt-4" onclick={handleNewFile}>
              <FilePlus class="me-2 h-4 w-4" />
              {i18n.t.sidebar.newFile}
            </Button>
          </div>
        </div>
      {/if}
    </div>
  </main>
</div>

<!-- Settings Modal -->
<SettingsModal open={showSettings} onclose={() => (showSettings = false)} />

<!-- Drop Zone Overlay -->

<!-- Table Editor Modal -->
{#if editingTableMarkdown}
  <TableEditor
    tableMarkdown={editingTableMarkdown}
    onSave={handleTableSave}
    onClose={() => (editingTableMarkdown = null)}
  />
{/if}

{#if isDragging}
  <div
    class="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-primary/10 backdrop-blur-sm"
  >
    <div
      class="rounded-xl border-2 border-dashed border-primary bg-background/90 p-8 text-center shadow-lg"
    >
      <FileDown class="mx-auto mb-4 h-12 w-12 text-primary" />
      <p class="text-lg font-medium">
        {i18n.t.dropzone?.title || "Drop markdown files here"}
      </p>
      <p class="mt-1 text-sm text-muted-foreground">
        {i18n.t.dropzone?.subtitle || "Only .md files will be imported"}
      </p>
    </div>
  </div>
{/if}

<style>
  @media print {
    :global(html),
    :global(body) {
      background: white !important;
      height: auto !important;
      overflow: visible !important;
    }

    header,
    aside,
    .no-print {
      display: none !important;
    }

    main {
      display: block !important;
      overflow: visible !important;
      height: auto !important;
    }

    /* Hide editor pane, show only preview */
    .editor-pane {
      display: none !important;
    }

    .editor-preview-container {
      display: block !important;
      overflow: visible !important;
      height: auto !important;
    }

    /* CRITICAL: Show preview pane and override all hiding */
    .preview-pane {
      display: block !important;
      border: none !important;
      overflow: visible !important;
      height: auto !important;
      width: 100% !important;
    }

    /* Override mobile-hidden class for print */
    .mobile-hidden {
      display: block !important;
    }

    /* Make sure the preview container shows all content */
    :global(.preview-container) {
      display: block !important;
      height: auto !important;
      overflow: visible !important;
      padding: 0 !important;
    }

    :global(.preview-content) {
      display: block !important;
      height: auto !important;
      overflow: visible !important;
    }

    /* Allow page breaks inside content */
    :global(.preview-content *) {
      page-break-inside: auto;
    }

    /* Avoid breaking headings from their content */
    :global(.preview-content h1),
    :global(.preview-content h2),
    :global(.preview-content h3),
    :global(.preview-content h4),
    :global(.preview-content h5),
    :global(.preview-content h6) {
      page-break-after: avoid;
    }

    /* Avoid breaking tables and figures */
    :global(.preview-content table),
    :global(.preview-content figure),
    :global(.preview-content pre) {
      page-break-inside: avoid;
    }

    .resize-handle {
      display: none !important;
    }
  }

  /* Resize handle styles */
  .resize-handle {
    width: 8px;
    cursor: col-resize;
    background: transparent;
    position: relative;
    z-index: 10;
    flex-shrink: 0;
    display: none;
    align-items: center;
    justify-content: center;
    transition: background-color 0.15s ease;
  }

  .resize-handle:hover,
  .resize-handle:active {
    background-color: var(--color-accent);
  }

  .resize-handle-bar {
    width: 4px;
    height: 40px;
    background-color: var(--color-border);
    border-radius: 2px;
    transition:
      background-color 0.15s ease,
      height 0.15s ease;
  }

  .resize-handle:hover .resize-handle-bar,
  .resize-handle:active .resize-handle-bar {
    background-color: var(--color-primary);
    height: 60px;
  }

  /* Mobile styles - single pane view with toggle */
  @media (max-width: 767px) {
    .editor-pane,
    .preview-pane {
      width: 100% !important;
      flex: 1 !important;
    }

    .mobile-hidden {
      display: none !important;
    }

    .resize-handle {
      display: none !important;
    }

    .preview-pane {
      border-inline-start: none !important;
    }
  }

  /* Desktop styles - show both panes side by side with resizable divider */
  @media (min-width: 768px) {
    .editor-pane {
      width: var(--editor-width, 50%);
      flex: none !important;
    }

    .preview-pane {
      width: var(--preview-width, 50%);
      flex: none !important;
    }

    .resize-handle {
      display: flex !important;
    }

    .mobile-hidden {
      display: block !important;
    }
  }
</style>
