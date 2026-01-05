<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		EditorView,
		keymap,
		lineNumbers,
		highlightActiveLine,
		drawSelection
	} from '@codemirror/view';
	import { EditorState, Compartment } from '@codemirror/state';
	import { markdown } from '@codemirror/lang-markdown';
	import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
	import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
	import { oneDark } from '@codemirror/theme-one-dark';
	import { i18n } from '$lib/stores/i18n.svelte';

	interface Props {
		content: string;
		onchange?: (content: string) => void;
		onScroll?: (scrollTop: number) => void;
		class?: string;
		readonly?: boolean;
	}

	let { content, onchange, onScroll, class: className, readonly = false }: Props = $props();

	let editorContainer: HTMLDivElement;
	let editorView: EditorView | null = null;
	const themeCompartment = new Compartment();
	const readonlyCompartment = new Compartment();

	// Track if we're currently syncing to avoid loops
	let isSyncing = false;

	export function scrollTo(scrollTop: number) {
		if (editorView) {
			editorView.scrollDOM.scrollTop = scrollTop;
		}
	}

	const customDarkTheme = EditorView.theme(
		{
			'&': {
				backgroundColor: 'var(--color-background) !important',
				color: 'var(--color-foreground) !important'
			},
			'.cm-content': {
				caretColor: 'var(--color-foreground)'
			},
			'.cm-gutters': {
				backgroundColor: 'var(--color-background) !important',
				color: 'var(--color-muted-foreground)',
				borderRight: '1px solid var(--color-border)'
			},
			'.cm-activeLine': {
				backgroundColor: 'var(--color-muted) !important'
			},
			'.cm-activeLineGutter': {
				backgroundColor: 'var(--color-muted) !important'
			}
		},
		{ dark: true }
	);

	function getTheme() {
		if (typeof document === 'undefined') return [];
		const isDark = document.documentElement.classList.contains('dark');
		return isDark ? [oneDark, customDarkTheme] : [];
	}

	function createEditor() {
		if (!editorContainer) return;

		const updateListener = EditorView.updateListener.of((update) => {
			if (update.docChanged && !isSyncing) {
				const newContent = update.state.doc.toString();
				onchange?.(newContent);
			}
		});

		// Scroll listener
		const domEventHandlers = EditorView.domEventHandlers({
			scroll: (event, view) => {
				if (event.target instanceof HTMLElement) {
					onScroll?.(view.scrollDOM.scrollTop);
				}
			}
		});

		// RTL support - detect per line
		const rtlLinePlugin = EditorView.perLineTextDirection.of(true);

		const state = EditorState.create({
			doc: content,
			extensions: [
				lineNumbers(),
				highlightActiveLine(),
				drawSelection(),
				history(),
				markdown(),
				syntaxHighlighting(defaultHighlightStyle),
				keymap.of([...defaultKeymap, ...historyKeymap]),
				themeCompartment.of(getTheme()),
				readonlyCompartment.of(EditorState.readOnly.of(readonly)),
				rtlLinePlugin,
				updateListener,
				domEventHandlers,
				EditorView.lineWrapping,
				EditorView.theme({
					'&': {
						height: '100%',
						fontSize: '14px'
					},
					'.cm-scroller': {
						overflow: 'auto',
						fontFamily: '"Arabic", "Fira Code", monospace'
					},
					'.cm-content': {
						padding: '16px 0'
					},
					'.cm-line': {
						padding: '0 16px'
					},
					'&.cm-focused': {
						outline: 'none'
					}
				})
			]
		});

		editorView = new EditorView({
			state,
			parent: editorContainer
		});
	}

	function destroyEditor() {
		if (editorView) {
			editorView.destroy();
			editorView = null;
		}
	}

	// Update content from outside
	$effect(() => {
		// Need to access content to track it
		const newContent = content;

		if (editorView) {
			const currentContent = editorView.state.doc.toString();
			if (newContent !== currentContent) {
				isSyncing = true;
				editorView.dispatch({
					changes: {
						from: 0,
						to: editorView.state.doc.length,
						insert: newContent
					}
				});
				isSyncing = false;
			}
		}
	});

	// Update theme when dark mode changes
	$effect(() => {
		if (editorView && typeof document !== 'undefined') {
			// Watch for dark class changes
			const isDark = document.documentElement.classList.contains('dark');
			editorView.dispatch({
				effects: themeCompartment.reconfigure(isDark ? oneDark : [])
			});
		}
	});

	// Update readonly state
	$effect(() => {
		if (editorView) {
			editorView.dispatch({
				effects: readonlyCompartment.reconfigure(EditorState.readOnly.of(readonly))
			});
		}
	});

	onMount(() => {
		createEditor();

		// Watch for theme changes
		const observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				if (mutation.attributeName === 'class' && editorView) {
					editorView.dispatch({
						effects: themeCompartment.reconfigure(getTheme())
					});
				}
			}
		});

		observer.observe(document.documentElement, { attributes: true });

		return () => observer.disconnect();
	});

	onDestroy(() => {
		destroyEditor();
	});
</script>

<div
	bind:this={editorContainer}
	class="border-border bg-background h-full w-full overflow-hidden border-r {className}"
	dir="auto"
></div>

<style>
	:global(.cm-editor) {
		height: 100%;
	}
</style>
