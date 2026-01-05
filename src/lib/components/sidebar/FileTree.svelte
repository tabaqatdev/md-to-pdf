<script lang="ts">
	import { filesStore } from '$lib/stores/files.svelte';
	import { i18n } from '$lib/stores/i18n.svelte';
	import type { FileNode } from '$lib/utils/opfs';
	import Button from '$lib/components/ui/button.svelte';
	import Input from '$lib/components/ui/input.svelte';
	import {
		Folder,
		FolderOpen,
		FileText,
		ChevronRight,
		ChevronDown,
		Plus,
		FolderPlus,
		Trash2,
		Pencil,
		MoveRight
	} from 'lucide-svelte';

	interface Props {
		class?: string;
	}

	let { class: className }: Props = $props();

	let expandedFolders = $state<Set<string>>(new Set());
	let editingPath = $state<string | null>(null);
	let editingName = $state('');
	let creatingIn = $state<{ path: string; type: 'file' | 'folder' } | null>(null);
	let newItemName = $state('');
	let movingNode = $state<FileNode | null>(null);
	let selectedFolder = $state<string>('');

	function toggleFolder(path: string) {
		if (expandedFolders.has(path)) {
			expandedFolders.delete(path);
		} else {
			expandedFolders.add(path);
		}
		expandedFolders = new Set(expandedFolders);
	}

	async function handleFileClick(node: FileNode) {
		if (node.type === 'folder') {
			toggleFolder(node.path);
		} else {
			await filesStore.openFile(node.path);
		}
	}

	function startRename(node: FileNode, event: MouseEvent) {
		event.stopPropagation();
		event.preventDefault();
		editingPath = node.path;
		// For files, strip the .md extension so user only edits the base name
		if (node.type === 'file' && node.name.endsWith('.md')) {
			editingName = node.name.slice(0, -3);
		} else {
			editingName = node.name;
		}
	}

	async function confirmRename() {
		if (editingPath && editingName.trim()) {
			const pathToRename = editingPath;
			const nameToUse = editingName.trim();

			// Clear editing state first to prevent double-calls
			editingPath = null;
			editingName = '';

			try {
				await filesStore.renameItem(pathToRename, nameToUse);
			} catch (e) {
				console.error('Rename failed:', e);
			}
		} else {
			editingPath = null;
			editingName = '';
		}
	}

	function cancelRename() {
		editingPath = null;
		editingName = '';
	}

	function startCreate(path: string, type: 'file' | 'folder') {
		creatingIn = { path, type };
		newItemName = '';
		if (path) {
			expandedFolders.add(path);
			expandedFolders = new Set(expandedFolders);
		}
	}

	async function confirmCreate() {
		if (!creatingIn || !newItemName.trim()) return;

		try {
			if (creatingIn.type === 'file') {
				const filePath = await filesStore.createFile(creatingIn.path, newItemName.trim());
				// Open the newly created file
				await filesStore.openFile(filePath);
			} else {
				await filesStore.createFolder(creatingIn.path, newItemName.trim());
			}
		} catch (e) {
			console.error('Failed to create:', e);
		}

		creatingIn = null;
		newItemName = '';
	}

	function cancelCreate() {
		creatingIn = null;
		newItemName = '';
	}

	async function handleDelete(node: FileNode, event: MouseEvent) {
		event.stopPropagation();
		event.preventDefault();
		const message =
			node.type === 'folder' ? i18n.t.confirm.deleteFolder : i18n.t.confirm.deleteFile;

		if (confirm(message)) {
			await filesStore.deleteItem(node.path, node.type === 'folder');
		}
	}

	let isConfirming = $state(false);

	async function handleKeydown(event: KeyboardEvent, action: 'rename' | 'create') {
		if (event.key === 'Enter') {
			event.preventDefault();
			isConfirming = true;
			if (action === 'rename') await confirmRename();
			else await confirmCreate();
		} else if (event.key === 'Escape') {
			if (action === 'rename') cancelRename();
			else cancelCreate();
		}
	}

	function handleCreateBlur() {
		// Use setTimeout to allow Enter key to set isConfirming first
		setTimeout(() => {
			if (!isConfirming && creatingIn) {
				cancelCreate();
			}
			isConfirming = false;
		}, 150);
	}

	function handleRenameBlur() {
		// Use setTimeout to allow Enter key to complete first
		setTimeout(() => {
			// Only confirm if we haven't already confirmed via Enter key
			if (!isConfirming && editingPath) {
				confirmRename();
			}
			isConfirming = false;
		}, 150);
	}

	function handleAddClick(event: MouseEvent, path: string) {
		event.stopPropagation();
		event.preventDefault();
		startCreate(path, 'file');
	}

	function startMove(node: FileNode, event: MouseEvent) {
		event.stopPropagation();
		event.preventDefault();
		movingNode = node;
		selectedFolder = '';
	}

	function cancelMove() {
		movingNode = null;
		selectedFolder = '';
	}

	async function confirmMove() {
		if (!movingNode || selectedFolder === null) return;

		try {
			const newPath = selectedFolder ? `${selectedFolder}/${movingNode.name}` : movingNode.name;
			if (newPath !== movingNode.path) {
				await filesStore.renameItem(movingNode.path, newPath);
			}
		} catch (e) {
			console.error('Failed to move:', e);
		}

		movingNode = null;
		selectedFolder = '';
	}

	// Get list of all folders for move dialog
	function getAllFolders(nodes: FileNode[], currentPath = ''): { path: string; display: string }[] {
		const folders: { path: string; display: string }[] = [];

		// Add root option
		if (currentPath === '') {
			folders.push({ path: '', display: '📁 Root' });
		}

		for (const node of nodes) {
			if (node.type === 'folder' && node.path !== movingNode?.path) {
				const depth = node.path.split('/').length - 1;
				const indent = '  '.repeat(depth);
				folders.push({ path: node.path, display: `${indent}📁 ${node.name}` });

				if (node.children) {
					folders.push(...getAllFolders(node.children, node.path));
				}
			}
		}

		return folders;
	}
</script>

<div class="flex h-full flex-col {className}">
	<!-- Header -->
	<div class="border-border flex items-center justify-between border-b p-3">
		<h2 class="text-sm font-semibold">{i18n.t.sidebar.files}</h2>
		<div class="flex gap-1">
			<Button
				variant="ghost"
				size="icon"
				class="h-7 w-7"
				onclick={() => startCreate('', 'file')}
				title={i18n.t.sidebar.newFile}
			>
				<Plus class="h-4 w-4" />
			</Button>
			<Button
				variant="ghost"
				size="icon"
				class="h-7 w-7"
				onclick={() => startCreate('', 'folder')}
				title={i18n.t.sidebar.newFolder}
			>
				<FolderPlus class="h-4 w-4" />
			</Button>
		</div>
	</div>

	<!-- File Tree -->
	<div class="scrollbar-thin flex-1 overflow-auto p-2">
		{#if filesStore.isLoading}
			<div class="text-muted-foreground flex items-center justify-center p-4">
				<span class="animate-pulse">Loading...</span>
			</div>
		{:else if filesStore.files.length === 0 && !creatingIn}
			<div class="text-muted-foreground p-4 text-center text-sm">
				{i18n.t.sidebar.noFiles}
			</div>
		{:else}
			<!-- Creating at root level -->
			{#if creatingIn && creatingIn.path === ''}
				<div class="mb-1 flex items-center gap-1 rounded px-2 py-1">
					{#if creatingIn.type === 'folder'}
						<Folder class="text-muted-foreground h-4 w-4" />
					{:else}
						<FileText class="text-muted-foreground h-4 w-4" />
					{/if}
					<Input
						bind:value={newItemName}
						class="h-6 flex-1 text-sm"
						placeholder={creatingIn.type === 'folder' ? 'Folder name' : 'File name'}
						onkeydown={(e) => handleKeydown(e, 'create')}
						onblur={handleCreateBlur}
						autofocus
					/>
				</div>
			{/if}

			{#each filesStore.files as node (node.id)}
				{@render fileNode(node, 0)}
			{/each}
		{/if}
	</div>
</div>

{#snippet fileNode(node: FileNode, depth: number)}
	{@const isExpanded = expandedFolders.has(node.path)}
	{@const isEditing = editingPath === node.path}
	{@const isActive = filesStore.currentFile?.path === node.path}
	{@const paddingLeft = `${depth * 12 + 8}px`}

	<div class="group">
		<!-- Use div with role instead of nested buttons -->
		<div
			class="hover:bg-accent flex w-full cursor-pointer items-center gap-1 rounded px-2 py-1 text-sm {isActive
				? 'bg-accent'
				: ''}"
			style="padding-inline-start: {paddingLeft}"
			onclick={() => handleFileClick(node)}
			onkeydown={(e) => e.key === 'Enter' && handleFileClick(node)}
			role="button"
			tabindex="0"
		>
			{#if node.type === 'folder'}
				{#if isExpanded}
					<ChevronDown class="text-muted-foreground h-3 w-3 shrink-0" />
					<FolderOpen class="h-4 w-4 shrink-0 text-yellow-500" />
				{:else}
					<ChevronRight class="text-muted-foreground h-3 w-3 shrink-0" />
					<Folder class="h-4 w-4 shrink-0 text-yellow-500" />
				{/if}
			{:else}
				<span class="w-3"></span>
				<FileText class="h-4 w-4 shrink-0 text-blue-500" />
			{/if}

			{#if isEditing}
				<Input
					bind:value={editingName}
					class="h-5 flex-1 text-sm"
					onkeydown={(e) => handleKeydown(e, 'rename')}
					onblur={handleRenameBlur}
					autofocus
					onclick={(e) => e.stopPropagation()}
				/>
			{:else}
				<span class="flex-1 truncate text-start">{node.name}</span>
			{/if}

			<!-- Action buttons - now safe since parent is div, not button -->
			<div class="hidden gap-0.5 group-hover:flex">
				{#if node.type === 'folder'}
					<button
						type="button"
						class="hover:bg-background rounded p-0.5"
						onclick={(e) => handleAddClick(e, node.path)}
						title={i18n.t.sidebar.newFile}
					>
						<Plus class="h-3 w-3" />
					</button>
				{/if}
				<button
					type="button"
					class="hover:bg-background rounded p-0.5"
					onclick={(e) => startRename(node, e)}
					title={i18n.t.sidebar.rename}
				>
					<Pencil class="h-3 w-3" />
				</button>
				{#if node.type === 'file'}
					<button
						type="button"
						class="hover:bg-background rounded p-0.5"
						onclick={(e) => startMove(node, e)}
						title="Move to folder"
					>
						<MoveRight class="h-3 w-3" />
					</button>
				{/if}
				<button
					type="button"
					class="text-destructive hover:bg-background rounded p-0.5"
					onclick={(e) => handleDelete(node, e)}
					title={i18n.t.sidebar.delete}
				>
					<Trash2 class="h-3 w-3" />
				</button>
			</div>
		</div>

		<!-- Children -->
		{#if node.type === 'folder' && isExpanded}
			<!-- Creating inside folder -->
			{#if creatingIn && creatingIn.path === node.path}
				<div
					class="flex items-center gap-1 rounded px-2 py-1"
					style="padding-inline-start: {(depth + 1) * 12 + 8}px"
				>
					{#if creatingIn.type === 'folder'}
						<Folder class="text-muted-foreground h-4 w-4" />
					{:else}
						<FileText class="text-muted-foreground h-4 w-4" />
					{/if}
					<Input
						bind:value={newItemName}
						class="h-6 flex-1 text-sm"
						placeholder={creatingIn.type === 'folder' ? 'Folder name' : 'File name'}
						onkeydown={(e) => handleKeydown(e, 'create')}
						onblur={handleCreateBlur}
						autofocus
					/>
				</div>
			{/if}

			{#if node.children}
				{#each node.children as child (child.id)}
					{@render fileNode(child, depth + 1)}
				{/each}
			{/if}
		{/if}
	</div>
{/snippet}

<!-- Move Dialog -->
{#if movingNode}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-transparent"
		onclick={cancelMove}
		onkeydown={(e) => e.key === 'Escape' && cancelMove()}
		tabindex="-1"
		role="dialog"
		aria-modal="true"
	>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="border-border w-full max-w-md rounded-lg border bg-white p-6 shadow-2xl dark:bg-gray-900"
			onclick={(e) => e.stopPropagation()}
		>
			<h3 class="mb-4 text-lg font-semibold">
				Move "{movingNode.name}" to folder
			</h3>

			<div class="mb-4">
				<label for="folder-select" class="mb-2 block text-sm font-medium"
					>Select destination folder:</label
				>
				<select
					id="folder-select"
					bind:value={selectedFolder}
					class="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
				>
					{#each getAllFolders(filesStore.files) as folder}
						<option value={folder.path}>{folder.display}</option>
					{/each}
				</select>
			</div>

			<div class="flex justify-end gap-2">
				<Button variant="outline" onclick={cancelMove}>Cancel</Button>
				<Button onclick={confirmMove}>Move</Button>
			</div>
		</div>
	</div>
{/if}
