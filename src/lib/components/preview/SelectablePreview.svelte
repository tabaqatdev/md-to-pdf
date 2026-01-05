<script lang="ts">
	import MarkdownPreview from './MarkdownPreview.svelte';
	import { portal } from '$lib/actions/portal';
	import { Edit, Trash2, TableProperties } from 'lucide-svelte';

	interface Props {
		content: string;
		onEdit?: (originalText: string, newText: string) => void;
		onEditTable?: (tableMarkdown: string, startLine?: number, endLine?: number) => void;
		onScroll?: (scrollTop: number) => void;
	}

	let { content, onEdit, onEditTable, onScroll }: Props = $props();

	let containerRef: HTMLDivElement;
	let showToolbar = $state(false);
	let toolbarPosition = $state({ x: 0, y: 0 });
	let selectedText = $state('');
	let selectedElement: HTMLElement | null = null;
	let isTableSelected = $state(false);

	export function scrollTo(scrollTop: number) {
		const scrollContainer = containerRef?.querySelector('.preview-container');
		if (scrollContainer) {
			scrollContainer.scrollTop = scrollTop;
		}
	}

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

		// Find the parent element - check for table first
		let element = commonAncestor as HTMLElement;
		isTableSelected = false;

		while (element && element !== containerRef) {
			if (element.tagName === 'TABLE') {
				selectedElement = element;
				isTableSelected = true;
				break;
			}

			if (
				['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE', 'TD', 'TH'].includes(
					element.tagName
				)
			) {
				selectedElement = element;
				isTableSelected = false;
				break;
			}
			element = element.parentElement as HTMLElement;
		}

		// Position toolbar near selection
		const rect = range.getBoundingClientRect();

		// Fixed positioning - relative to viewport (works with portal)
		toolbarPosition = {
			x: rect.left + rect.width / 2,
			y: rect.top - 50
		};

		showToolbar = true;
	}

	function handleScroll() {
		if (showToolbar) {
			showToolbar = false;
		}

		const scrollContainer = containerRef?.querySelector('.preview-container');
		if (scrollContainer && onScroll) {
			onScroll(scrollContainer.scrollTop);
		}
	}

	function handleEdit() {
		if (!selectedElement) return;

		// If table is selected, emit table edit event
		if (isTableSelected && onEditTable) {
			const tableMarkdown = extractTableMarkdown(selectedElement as HTMLTableElement);

			const startLine = selectedElement!.hasAttribute('data-source-line')
				? parseInt(selectedElement!.getAttribute('data-source-line')!)
				: undefined;

			const endLine = selectedElement!.hasAttribute('data-source-line-end')
				? parseInt(selectedElement!.getAttribute('data-source-line-end')!)
				: undefined;

			onEditTable(tableMarkdown, startLine, endLine);
			showToolbar = false;
			return;
		}

		// Otherwise, inline edit for regular text
		const originalText = selectedElement.textContent || '';

		selectedElement.contentEditable = 'true';
		selectedElement.focus();

		const selection = window.getSelection();
		const range = document.createRange();
		range.selectNodeContents(selectedElement);
		selection?.removeAllRanges();
		selection?.addRange(range);

		showToolbar = false;

		const handleBlur = () => {
			selectedElement!.contentEditable = 'false';
			const newText = selectedElement!.textContent || '';

			if (newText !== originalText && onEdit) {
				onEdit(originalText, newText);
			}

			selectedElement!.removeEventListener('blur', handleBlur);
			selectedElement!.removeEventListener('keydown', handleKeydown);
		};

		const handleKeydown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				selectedElement!.textContent = originalText;
				selectedElement!.contentEditable = 'false';
				selectedElement!.blur();
			} else if (e.key === 'Enter' && !e.shiftKey && selectedElement!.tagName !== 'LI') {
				e.preventDefault();
				selectedElement!.blur();
			}
		};

		selectedElement.addEventListener('blur', handleBlur);
		selectedElement.addEventListener('keydown', handleKeydown);
	}

	function extractTableMarkdown(table: HTMLTableElement): string {
		const rows: string[][] = [];

		// Get headers
		const headers = Array.from(table.querySelectorAll('thead tr th')).map(
			(th) => th.textContent?.trim() || ''
		);
		if (headers.length > 0) {
			rows.push(headers);
		}

		// Get body rows
		const bodyRows = table.querySelectorAll('tbody tr');
		bodyRows.forEach((tr) => {
			const cells = Array.from(tr.querySelectorAll('td')).map((td) => td.textContent?.trim() || '');
			if (cells.length > 0) {
				rows.push(cells);
			}
		});

		// Convert to markdown
		if (rows.length === 0) return '';

		const header = rows[0];
		const separator = header.map(() => '---');
		const body = rows.slice(1);

		return [
			`| ${header.join(' | ')} |`,
			`| ${separator.join(' | ')} |`,
			...body.map((row) => `| ${row.join(' | ')} |`)
		].join('\n');
	}

	function handleDelete() {
		if (!selectedElement) return;
		console.log('Delete element:', selectedElement);
		showToolbar = false;
	}

	$effect(() => {
		document.addEventListener('selectionchange', handleSelectionChange);

		// Add scroll listener to the inner preview container to hide toolbar on scroll
		const scrollContainer = containerRef?.querySelector('.preview-container');
		if (scrollContainer) {
			scrollContainer.addEventListener('scroll', handleScroll);
		}

		return () => {
			document.removeEventListener('selectionchange', handleSelectionChange);
			if (scrollContainer) {
				scrollContainer.removeEventListener('scroll', handleScroll);
			}
		};
	});
</script>

<div bind:this={containerRef} class="selection-preview relative h-full">
	<MarkdownPreview {content} />

	{#if showToolbar}
		<div
			use:portal
			class="selection-toolbar animate-in fade-in zoom-in flex items-center gap-1 rounded-lg border p-1 shadow-lg duration-200"
			style="position: fixed; z-index: 2147483647; left: {toolbarPosition.x}px; top: {toolbarPosition.y}px; isolation: isolate; background-color: rgb(255, 255, 255) !important; opacity: 1 !important; border-color: #e5e7eb;"
		>
			<button
				class="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-1 focus-visible:outline-none"
				onclick={handleEdit}
				title={isTableSelected ? 'Edit table' : 'Edit selection'}
			>
				{#if isTableSelected}
					<TableProperties class="mr-1 h-3.5 w-3.5" />
					Edit Table
				{:else}
					<Edit class="mr-1 h-3.5 w-3.5" />
					Edit
				{/if}
			</button>
			{#if !isTableSelected}
				<button
					class="text-destructive hover:bg-destructive/10 hover:text-destructive focus-visible:ring-ring inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors focus-visible:ring-1 focus-visible:outline-none"
					onclick={handleDelete}
					title="Delete element"
				>
					<Trash2 class="h-4 w-4" />
				</button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.selection-preview {
		position: relative;
	}

	.selection-toolbar {
		position: fixed;
		transform: translateX(-50%);
		background: hsl(var(--card));
		border: 1px solid hsl(var(--border));
		border-radius: 8px;
		padding: 4px;
		display: flex;
		gap: 2px;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
		z-index: 9999;
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

	:global([contenteditable='true']) {
		outline: 2px solid hsl(var(--primary));
		outline-offset: 2px;
		border-radius: 4px;
		padding: 4px;
		background: hsl(var(--accent) / 0.1);
	}
</style>
