<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { X, Copy, Check, Users, Link as LinkIcon } from 'lucide-svelte';
	import Button from '$lib/components/ui/button.svelte';
	import { page } from '$app/stores';
	import { loroStore } from '$lib/stores/loro.svelte';
	import { filesStore } from '$lib/stores/files.svelte';

	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();
	let copied = $state(false);

	// Get room ID from store
	let roomId = $derived(loroStore.roomId);

	onMount(async () => {
		// If we are already in a room (client), roomId is set in store by +page.svelte
		// If we are Host, we might not have started the session yet.
		if (!roomId && !$page.url.hash.includes('room=')) {
			console.log('Initializing Host Session...');
			await loroStore.joinRoom(null);
			// Sync local files to Loro now that we are host
			await filesStore.syncAllToLoro();
		}
	});

	const shareUrl = $derived(
		roomId ? `${$page.url.origin}${$page.url.pathname}#room=${roomId}` : 'Generating link...'
	);

	function copyLink() {
		if (!roomId) return;

		navigator.clipboard.writeText(shareUrl);
		copied = true;
		setTimeout(() => (copied = false), 2000);

		// If we weren't in a room, update URL to join it
		if (!$page.url.hash.includes('room=')) {
			window.location.hash = `room=${roomId}`;
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
		class="bg-background/95 relative flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/20 shadow-2xl ring-1 ring-black/5 backdrop-blur-xl dark:ring-white/10"
		onclick={(e) => e.stopPropagation()}
		transition:scale={{ start: 0.95, duration: 300, easing: cubicOut }}
	>
		<!-- Header -->
		<div
			class="border-border/50 bg-muted/30 flex items-center justify-between border-b px-6 py-4 backdrop-blur-xl"
		>
			<div class="flex items-center gap-3">
				<div
					class="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-xl"
				>
					<Users class="h-5 w-5" />
				</div>
				<div>
					<h2 class="text-xl font-semibold tracking-tight">Collaborate</h2>
					<p class="text-muted-foreground text-xs font-medium">Share link to edit together</p>
				</div>
			</div>
			<button
				onclick={onClose}
				class="bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200"
			>
				<X class="h-4 w-4" />
			</button>
		</div>

		<!-- Content -->
		<div class="space-y-6 p-6">
			<div class="space-y-2">
				<label for="share-link" class="text-sm font-medium">Share Link</label>
				<div class="flex gap-2">
					<div
						class="bg-muted text-muted-foreground relative flex-1 truncate rounded-lg border px-3 py-2.5 font-mono text-sm"
					>
						{shareUrl}
					</div>
					<Button variant="default" size="icon" class="shrink-0" onclick={copyLink}>
						{#if copied}
							<Check class="h-4 w-4" />
						{:else}
							<Copy class="h-4 w-4" />
						{/if}
					</Button>
				</div>
				<p class="text-muted-foreground text-xs">
					Anyone with this link can view and edit this document in real-time.
				</p>
			</div>

			<div class="bg-muted/30 rounded-lg p-4">
				<div class="flex items-center gap-3">
					<div
						class="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/20 text-green-500"
					>
						<LinkIcon class="h-4 w-4" />
					</div>
					<div>
						<p class="text-sm font-medium">P2P Connection</p>
						<p class="text-muted-foreground text-xs">Direct browser-to-browser sync (serverless)</p>
					</div>
				</div>
			</div>
		</div>

		<!-- Footer -->
		<div class="border-border/50 bg-muted/30 flex justify-end border-t p-4">
			<Button variant="outline" onclick={onClose}>Done</Button>
		</div>
	</div>
</div>
