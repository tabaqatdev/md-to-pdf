<script lang="ts">
	import { filesStore } from '$lib/stores/files.svelte';
	import { Check, Pencil, X } from 'lucide-svelte';
	import { i18n } from '$lib/stores/i18n.svelte';
	import { tick } from 'svelte';

	let isEditing = $state(false);
	let newName = $state('');
	let inputRef = $state<HTMLInputElement | undefined>();

	// Update newName when file changes or editing starts
	$effect(() => {
		if (filesStore.currentFile && !isEditing) {
			newName = filesStore.currentFile.name;
		}
	});

	// Auto-edit if file is new
	$effect(() => {
		if (filesStore.currentFile?.isNew && !isEditing) {
			startEditing();
		}
	});

	function startEditing() {
		if (!filesStore.currentFile) return;
		newName = filesStore.currentFile.name;
		isEditing = true;
		tick().then(() => {
			inputRef?.focus();
			inputRef?.select();
		});
	}

	async function saveName() {
		if (!filesStore.currentFile || !newName.trim()) return;

		const trimmedName = newName.trim();
		// Ensure .md extension
		const finalName = trimmedName.endsWith('.md') ? trimmedName : `${trimmedName}.md`;

		if (finalName === filesStore.currentFile.name && !filesStore.currentFile.isNew) {
			isEditing = false;
			return;
		}

		try {
			if (filesStore.currentFile.isNew) {
				await filesStore.saveNewFile('', finalName);
			} else {
				await filesStore.renameItem(filesStore.currentFile.path, finalName);
			}
			isEditing = false;
		} catch (e) {
			console.error('Failed to save filename:', e);
			const msg = e instanceof Error ? e.message : 'Unknown error';
			alert(`Failed to save file: ${msg}. Name might be taken or invalid.`);
		}
	}

	function cancelEditing() {
		if (filesStore.currentFile?.isNew) {
			// If canceling a new file, maybe discard it?
			// Currently newUnsavedFile just sets state.
			// Let's just keep it as Untitled or reset name.
			newName = filesStore.currentFile.name;
		} else if (filesStore.currentFile) {
			newName = filesStore.currentFile.name;
		}
		isEditing = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			saveName();
		} else if (e.key === 'Escape') {
			cancelEditing();
		}
	}
</script>

<div class="flex items-center gap-2">
	{#if isEditing}
		<div class="relative flex items-center">
			<input
				bind:this={inputRef}
				bind:value={newName}
				onkeydown={handleKeydown}
				onblur={saveName}
				class="bg-background border-border text-foreground focus:ring-primary h-8 min-w-[200px] rounded-md border px-2 text-sm focus:ring-2 focus:outline-none"
				placeholder="File name"
			/>
			<div class="absolute right-1 flex items-center gap-1">
				<button
					onclick={cancelEditing}
					class="hover:bg-muted text-muted-foreground hover:text-foreground rounded p-0.5"
				>
					<X class="h-3 w-3" />
				</button>
			</div>
		</div>
	{:else if filesStore.currentFile}
		<button
			onclick={startEditing}
			class="hover:bg-muted/50 group flex items-center gap-2 rounded-md px-2 py-1 transition-colors"
			title="Click to rename"
		>
			<span class="text-sm font-medium">
				{filesStore.currentFile.name}
			</span>
			{#if filesStore.currentFile.isDirty}
				<span class="text-yellow-500">*</span>
			{/if}
			<Pencil
				class="text-muted-foreground h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100"
			/>
		</button>
	{/if}
</div>
