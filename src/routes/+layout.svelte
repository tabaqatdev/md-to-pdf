<script lang="ts">
	import { onMount } from 'svelte';
	import { ModeWatcher } from 'mode-watcher';
	import '../app.css';
	// Syntax highlighting CSS for code blocks
	import 'highlight.js/styles/github.css';
	import { i18n } from '$lib/stores/i18n.svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import { filesStore } from '$lib/stores/files.svelte';

	let { children } = $props();

	onMount(() => {
		// Initialize all stores
		i18n.init();
		settingsStore.init();
		filesStore.init();
	});
</script>

<ModeWatcher />

{@render children()}
