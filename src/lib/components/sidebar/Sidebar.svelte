<script lang="ts">
	import { i18n } from '$lib/stores/i18n.svelte';
	import FileTree from './FileTree.svelte';
	import HistoryPanel from './HistoryPanel.svelte';
	import { Files, History } from 'lucide-svelte';

	interface Props {
		class?: string;
	}

	let { class: className }: Props = $props();

	let activeTab = $state<'files' | 'history'>('files');
</script>

<div class="flex h-full flex-col {className}">
	<!-- Tabs -->
	<div class="flex border-b border-border" role="tablist">
		<button
			type="button"
			role="tab"
			aria-selected={activeTab === 'files'}
			class="flex flex-1 items-center justify-center gap-2 px-4 py-2 text-sm {activeTab === 'files'
				? 'border-b-2 border-primary font-medium'
				: 'text-muted-foreground hover:text-foreground'}"
			onclick={() => (activeTab = 'files')}
		>
			<Files class="h-4 w-4" />
			{i18n.t.sidebar.files}
		</button>
		<button
			type="button"
			role="tab"
			aria-selected={activeTab === 'history'}
			class="flex flex-1 items-center justify-center gap-2 px-4 py-2 text-sm {activeTab === 'history'
				? 'border-b-2 border-primary font-medium'
				: 'text-muted-foreground hover:text-foreground'}"
			onclick={() => (activeTab = 'history')}
		>
			<History class="h-4 w-4" />
			{i18n.t.history?.title || 'History'}
		</button>
	</div>

	<!-- Tab Content -->
	<div class="flex-1 overflow-hidden" role="tabpanel">
		{#if activeTab === 'files'}
			<FileTree />
		{:else}
			<HistoryPanel />
		{/if}
	</div>
</div>
