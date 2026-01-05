# MD-to-PDF Architecture

This document describes the architecture, state management, and data flow of the MD-to-PDF application.

## Overview

MD-to-PDF is a SvelteKit-based single-page application (SPA) that converts Markdown to PDF with full RTL (Arabic) language support. It runs entirely in the browser using OPFS (Origin Private File System) for persistent storage.

## Technology Stack

```mermaid
graph TB
    subgraph Frontend
        SK[SvelteKit + Svelte 5]
        TW[Tailwind CSS 4]
        CM[CodeMirror 6]
        MD[marked.js]
        MM[mermaid.js]
    end

    subgraph Storage
        OPFS[OPFS - Origin Private File System]
        LS[LocalStorage]
    end

    subgraph Output
        PDF[Browser Print API]
    end

    SK --> CM
    SK --> MD
    MD --> MM
    SK --> OPFS
    SK --> LS
    SK --> PDF
```

## Application Structure

```
md-to-pdf/
├── src/
│   ├── routes/
│   │   ├── +layout.svelte      # Root layout, store initialization
│   │   ├── +layout.ts          # SPA mode config (ssr: false)
│   │   └── +page.svelte        # Main application page
│   ├── lib/
│   │   ├── stores/             # State management
│   │   │   ├── files.svelte.ts # File operations store
│   │   │   ├── settings.svelte.ts # Document settings store
│   │   │   └── i18n.svelte.ts  # Internationalization store
│   │   ├── components/
│   │   │   ├── editor/         # CodeMirror markdown editor
│   │   │   ├── preview/        # Rendered markdown preview
│   │   │   ├── sidebar/        # File tree browser
│   │   │   ├── settings/       # Settings modal
│   │   │   └── ui/             # Reusable UI components
│   │   ├── utils/
│   │   │   ├── opfs.ts         # OPFS file system wrapper
│   │   │   ├── markdown.ts     # Markdown processing
│   │   │   └── cn.ts           # Class name utility
│   │   └── i18n/               # Translation files
│   │       ├── en.json
│   │       └── ar.json
│   └── app.css                 # Global styles, theming
├── static/                     # Static assets
└── svelte.config.js            # SvelteKit config (adapter-static)
```

## State Management

The application uses Svelte 5 runes (`$state`, `$derived`, `$effect`) for reactive state management.

### Store Architecture

```mermaid
flowchart TB
    subgraph Stores
        FS[filesStore]
        HS[historyStore]
        SS[settingsStore]
        I18N[i18n]
    end

    subgraph Storage
        OPFS[(OPFS)]
        LS[(LocalStorage)]
    end

    subgraph Components
        SB[Sidebar]
        FT[FileTree]
        HP[HistoryPanel]
        ED[MarkdownEditor]
        PR[MarkdownPreview]
        SM[SettingsModal]
        TB[Toolbar]
        SP[SelectablePreview]
        TE[TableEditor]
    end

    FS <--> OPFS
    FS <--> HS
    HS <--> OPFS
    FS --> FT
    FS --> ED
    FS --> PR
    FS --> SP
    HS --> HP

    SS <--> LS
    SS --> PR
    SS --> SM

    I18N <--> LS
    I18N --> TB
    I18N --> SB
    I18N --> SM
```

### Files Store (`files.svelte.ts`)

Manages file operations, auto-save, and current editor state.

```mermaid
stateDiagram-v2
    [*] --> Uninitialized
    Uninitialized --> Loading: init()
    Loading --> Ready: OPFS initialized
    Loading --> Error: OPFS failed

    Ready --> FileOpen: openFile(path)
    FileOpen --> Editing: User types
    Editing --> Dirty: Content changed
    Dirty --> AutoSaving: 2s inactivity
    AutoSaving --> Clean: Auto-save success
    Dirty --> Saving: Manual save
    Saving --> Clean: Save success
    Saving --> Error: Save failed
    Clean --> Ready

    Ready --> Creating: createFile()
    Creating --> FileOpen: File created
```

**State Properties:**

- `files: FileNode[]` - Tree of files and folders
- `currentFile: EditorFile | null` - Currently open file
- `isLoading: boolean` - Loading state
- `error: string | null` - Error message
- `autoSaveEnabled: boolean` - Auto-save toggle (default: true)

**Key Functions:**

- `init()` - Initialize OPFS, history store, and load file list
- `createFile(path, name)` - Create new markdown file
- `createFolder(path, name)` - Create new folder
- `openFile(path)` - Load and open file
- `saveCurrentFile()` - Save current file to OPFS (creates version)
- `updateContent(content)` - Update editor content (schedules auto-save)
- `deleteItem(path, isFolder)` - Delete file or folder
- `renameItem(oldPath, newName)` - Rename file or folder
- `restoreVersion(versionId)` - Restore file from version history
- `setAutoSave(enabled)` - Enable/disable auto-save

### History Store (`history.svelte.ts`)

Manages version history for files using OPFS.

```mermaid
sequenceDiagram
    participant User
    participant FilesStore
    participant HistoryStore
    participant OPFS

    User->>FilesStore: Save file
    FilesStore->>HistoryStore: saveVersion(path, oldContent)
    HistoryStore->>OPFS: Create .history/{file}/{timestamp}.md
    OPFS-->>HistoryStore: Success

    User->>HistoryStore: loadVersions(path)
    HistoryStore->>OPFS: List .history/{file}/
    OPFS-->>HistoryStore: Version files
    HistoryStore-->>User: FileVersion[]

    User->>FilesStore: restoreVersion(id)
    FilesStore->>HistoryStore: getVersionContent(id)
    HistoryStore-->>FilesStore: content
    FilesStore->>FilesStore: currentFile.content = content
```

**State Properties:**

- `versions: FileVersion[]` - List of versions for current file
- `isLoading: boolean` - Loading state
- `currentFilePath: string | null` - File being viewed

**Key Functions:**

- `saveVersion(path, content)` - Save content as a version (1 min interval)
- `loadVersions(path)` - Load all versions for a file
- `getVersionContent(id)` - Get content of specific version
- `deleteVersion(id)` - Delete a version
- `clearHistory(path)` - Clear all history for a file

**Version Storage:**

```
.history/
├── document_md/
│   ├── 1704384000000-abc123.md
│   ├── 1704387600000-def456.md
│   └── 1704391200000-ghi789.md
└── notes_md/
    └── 1704394800000-jkl012.md
```

### Settings Store (`settings.svelte.ts`)

Manages per-document settings for PDF rendering.

```mermaid
graph LR
    subgraph Settings
        TY[Typography]
        LY[Layout]
        HD[Header/Footer]
        HG[Headings]
    end

    TY --> |fontFamily, fontSize, lineHeight| Preview
    LY --> |pageSize, margins| Preview
    HD --> |logo, pageNumbers| Preview
    HG --> |h1-h6 styles| Preview
```

**State Properties:**

- `fontFamily` - Font for body text
- `fontSize` - Base font size (pt)
- `lineHeight` - Line height multiplier
- `pageSize` - A4, Letter, Legal
- `margins` - Top, bottom, left, right
- `header` - Logo, position, show on first page
- `footer` - Page numbers, format, custom text
- `headings` - Color, fontSize, borderBottom for h1-h6

### i18n Store (`i18n.svelte.ts`)

Manages language and RTL direction.

**State Properties:**

- `language: 'en' | 'ar'` - Current language
- `direction: 'ltr' | 'rtl'` - Text direction
- `t: Translations` - Translation strings

## Data Flow

### Editor → Preview Flow

```mermaid
sequenceDiagram
    participant User
    participant Editor
    participant Page
    participant Store
    participant Preview

    User->>Editor: Type markdown
    Editor->>Page: onchange(content)
    Page->>Store: updateContent(content)
    Store-->>Page: currentFile.content updated
    Page-->>Preview: content prop updated
    Preview->>Preview: processMarkdown(content)
    Preview->>Preview: Render HTML + Mermaid
```

### File Create/Save Flow

```mermaid
sequenceDiagram
    participant User
    participant FileTree
    participant Store
    participant OPFS

    User->>FileTree: Click "New File"
    FileTree->>FileTree: Show input field
    User->>FileTree: Enter name + Enter
    FileTree->>Store: createFile(path, name)
    Store->>OPFS: createFile(fullPath)
    OPFS-->>Store: Success
    Store->>Store: refresh()
    Store->>OPFS: listDirectory()
    OPFS-->>Store: FileNode[]
    Store->>FileTree: files updated
    Store->>Store: openFile(path)
    FileTree->>FileTree: Show file selected
```

### Settings → PDF Export Flow

```mermaid
sequenceDiagram
    participant User
    participant Settings
    participant Store
    participant Preview
    participant Browser

    User->>Settings: Change font size
    Settings->>Store: update({ fontSize: 12 })
    Store-->>Preview: settings updated
    Preview->>Preview: generateSettingsCSS()
    Preview->>Preview: Apply styles

    User->>Browser: Click Export PDF
    Browser->>Browser: window.print()
    Browser->>Preview: Apply @media print CSS
    Browser->>User: Print dialog
```

## Storage Architecture

### OPFS (Origin Private File System)

Used for storing markdown files and folders. Provides:

- Persistent storage (survives browser close)
- Hierarchical folder structure
- No size limits (within browser quota)
- Fast read/write operations

```mermaid
graph TB
    subgraph OPFS["OPFS Root"]
        MD[md-to-pdf/]
        MD --> F1[document.md]
        MD --> F2[notes.md]
        MD --> D1[projects/]
        D1 --> F3[project-a.md]
        D1 --> F4[project-b.md]
    end
```

### LocalStorage

Used for:

- User preferences (language, theme)
- Document settings (fonts, margins, etc.)
- Last opened file path

**Keys:**

- `md-to-pdf-settings` - Document settings JSON
- `md-to-pdf-language` - Language preference
- `md-to-pdf-last-file` - Last opened file path

## Component Hierarchy

```mermaid
graph TB
    Layout[+layout.svelte]
    Layout --> ModeWatcher
    Layout --> Page[+page.svelte]

    Page --> Toolbar
    Page --> Sidebar
    Page --> EditorPane
    Page --> PreviewPane
    Page --> SettingsModal

    Sidebar --> FileTree
    EditorPane --> MarkdownEditor
    PreviewPane --> SelectablePreview
    SelectablePreview --> MarkdownPreview
    SelectablePreview --> TableEditor

    SettingsModal --> Typography
    SettingsModal --> Layout
    SettingsModal --> HeaderFooter
    SettingsModal --> Headings
```

## RTL/LTR Handling

The application has three independent RTL/LTR contexts:

1. **App UI** - Controlled by `i18n.direction`, applied to toolbar and sidebar
2. **Editor** - Auto-detected per line using CodeMirror's `perLineTextDirection`
3. **Preview** - Auto-detected from content using Arabic character count

```mermaid
graph LR
    subgraph "App Direction"
        UI[Toolbar + Sidebar]
        UI --> |i18n.direction| RTL1[RTL if Arabic UI]
    end

    subgraph "Editor Direction"
        ED[Each Line]
        ED --> |perLineTextDirection| RTL2[Auto per line]
    end

    subgraph "Preview Direction"
        PR[Content]
        PR --> |countArabic > 5| RTL3[RTL if Arabic content]
    end
```

## Print/PDF Architecture

When exporting to PDF:

1. Browser's `window.print()` is called
2. `@media print` CSS hides editor, sidebar, toolbar
3. Preview pane becomes full-width
4. `overflow: visible` allows multi-page content
5. Page break rules applied to headings, tables, code blocks

```css
@media print {
	.editor-pane,
	.no-print {
		display: none;
	}
	.preview-pane {
		overflow: visible;
		height: auto;
	}
	h1,
	h2,
	h3 {
		page-break-after: avoid;
	}
	table,
	pre {
		page-break-inside: avoid;
	}
}
```

## Error Handling

Errors are managed at the store level and bubbled up to components:

```mermaid
flowchart TB
    subgraph Store
        E1[OPFS Error] --> ERR[error state]
        E2[Save Error] --> ERR
        E3[Delete Error] --> ERR
    end

    ERR --> C1[Component checks error]
    C1 --> D1{error !== null?}
    D1 --> |Yes| SHOW[Show error message]
    D1 --> |No| HIDE[Normal UI]
```

## Security Considerations

- **No Server** - All data stays in browser (OPFS + LocalStorage)
- **No External Requests** - Except for CDN assets if used
- **XSS Prevention** - Markdown rendered with safe defaults
- **Content Security** - Mermaid runs with `securityLevel: 'loose'` for diagram flexibility
