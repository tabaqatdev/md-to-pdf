<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { processMarkdown, generateSettingsCSS } from '$lib/utils/markdown';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import { i18n } from '$lib/stores/i18n.svelte';

	interface Props {
		content: string;
		class?: string;
	}

	let { content, class: className }: Props = $props();

	let previewContainer: HTMLDivElement;
	let processedHtml = $state('');
	let isRTL = $state(false);
	let mermaidReady = $state(false);

	// Process markdown when content changes
	// Process markdown when content changes or mermaid settings change
	$effect(() => {
		// Track dependencies
		const mermaidSettings = settingsStore.current.mermaid;

		if (content) {
			const result = processMarkdown(content);
			processedHtml = result.html;
			isRTL = result.isRTL;

			// Render mermaid diagrams after DOM update
			if (result.mermaidBlocks.length > 0 && mermaidReady) {
				// Use tick() to ensure DOM is updated with new HTML before searching for .mermaid elements
				tick().then(() => {
					renderMermaid();
				});
			}
		} else {
			processedHtml = '';
			isRTL = false;
		}
	});

	// Generate dynamic CSS from settings
	let settingsCSS = $derived(
		generateSettingsCSS({
			fontFamily: settingsStore.current.fontFamily,
			fontSize: settingsStore.current.fontSize,
			lineHeight: settingsStore.current.lineHeight,
			headings: settingsStore.current.headings,
			margins: settingsStore.current.margins,
			theme: settingsStore.current.theme
		})
	);

	// Derived values for header/footer
	let headerEnabled = $derived(settingsStore.current.header.enabled);
	let headerLogo = $derived(settingsStore.current.header.logo);
	let headerLogoPosition = $derived(settingsStore.current.header.logoPosition);
	let headerText = $derived(settingsStore.current.header.text);
	let headerShowOnFirstPage = $derived(settingsStore.current.header.showOnFirstPage);
	let footerEnabled = $derived(settingsStore.current.footer.enabled);
	let footerShowPageNumbers = $derived(settingsStore.current.footer.showPageNumbers);
	let footerPageNumberFormat = $derived(settingsStore.current.footer.pageNumberFormat);
	let footerCustomText = $derived(settingsStore.current.footer.customText);
	let pageSize = $derived(settingsStore.current.pageSize);
	let margins = $derived(settingsStore.current.margins);

	async function renderMermaid() {
		if (typeof window === 'undefined' || !previewContainer) return;

		try {
			// Small delay to ensure DOM is fully ready (tick() usually enough but this is safer for complex rendering)
			await tick();

			const mermaidModule = await import('mermaid');
			// Handle potential CJS/ESM interop differences
			const mermaid = mermaidModule.default || mermaidModule;

			// Get settings
			const { fontFamily, fontSize } = settingsStore.current.mermaid || {
				fontFamily: 'Arial, sans-serif',
				fontSize: 14
			};

			mermaid.initialize({
				startOnLoad: false,
				theme: 'default',
				securityLevel: 'loose',
				fontFamily: fontFamily,
				themeVariables: {
					fontFamily: fontFamily,
					fontSize: `${fontSize}px`,
					// Update specific node font sizes
					nodeBorder: '1px solid #333',
					mainBkg: '#fff',
					nodeTextColor: '#333'
				},
				// Gantt chart settings - prevent text overlap
				gantt: {
					barHeight: 50,
					barGap: 10,
					topPadding: 75,
					rightPadding: 75,
					leftPadding: 75,
					gridLineStartPadding: 35,
					fontSize: fontSize,
					sectionFontSize: fontSize + 2,
					numberSectionStyles: 4,
					axisFormat: '%Y-%m-%d',
					useWidth: 1200
				},
				// Timeline settings
				timeline: {
					useMaxWidth: true
				},
				// General settings for better rendering
				flowchart: {
					useMaxWidth: true
				}
			});

			const mermaidDivs = previewContainer.querySelectorAll('.mermaid');
			if (mermaidDivs.length > 0) {
				// Apply font size to container
				mermaidDivs.forEach((div) => {
					(div as HTMLElement).style.fontSize = `${fontSize}px`;
				});

				await mermaid.run({
					nodes: mermaidDivs as NodeListOf<HTMLElement>
				});

				// Post-processing for specific diagram types if needed
				mermaidDivs.forEach((div) => {
					const svg = div.querySelector('svg');
					if (svg) {
						svg.style.fontFamily = fontFamily;
						svg.style.fontSize = `${fontSize}px`;
					}
				});
			}
		} catch (error) {
			console.error('Mermaid rendering error:', error);
		}
	}

	onMount(async () => {
		try {
			await import('mermaid');
			mermaidReady = true;
			// Trigger a check in case content was loaded before mermaid
			if (processedHtml && previewContainer?.querySelectorAll('.mermaid').length > 0) {
				renderMermaid();
			}
		} catch (error) {
			console.error('Failed to load mermaid:', error);
		}

		// Handle page numbering for print
		// The CSS counter(page) works in @page margin boxes but has limited support
		// As a fallback, we show page numbers in the table footer
		const updatePageNumbers = () => {
			const pageNumberElements = previewContainer?.querySelectorAll('.page-number');
			pageNumberElements?.forEach((el) => {
				// CSS counter(page) will be used in print
				// For screen preview, just show "1" as placeholder
				if (el instanceof HTMLElement) {
					el.textContent = '';
				}
			});
		};

		updatePageNumbers();
	});
</script>

<svelte:head>
	{@html `<style>
		${settingsCSS}

		@media print {
			@page {
				size: ${pageSize === 'Canvas' ? 'auto' : pageSize};
				margin: ${pageSize === 'Canvas' ? '0mm' : `${margins.top} ${margins.right} ${margins.bottom} ${margins.left}`};
			}

			/* First page can have different header */
			@page :first {
				${!headerShowOnFirstPage ? 'margin-top: ' + margins.top + ';' : ''}
			}
		}
	</style>`}
</svelte:head>

<div
	bind:this={previewContainer}
	class="preview-container h-full w-full overflow-auto bg-white {className}"
	dir={isRTL ? 'rtl' : 'ltr'}
>
	<!--
		Print Layout: Using table structure for repeating headers/footers
		This is the most reliable cross-browser method for print headers/footers
	-->
	<table class="print-layout">
		<thead class="print-header">
			<tr>
				<td>
					{#if headerEnabled}
						<div
							class="header-content"
							class:justify-start={headerLogoPosition === 'left'}
							class:justify-center={headerLogoPosition === 'center'}
							class:justify-end={headerLogoPosition === 'right'}
						>
							{#if headerLogo}
								<img src={headerLogo} alt="Logo" class="header-logo" />
							{/if}
							{#if headerText}
								<span class="header-text" class:ms-4={headerLogo}>{headerText}</span>
							{/if}
						</div>
					{/if}
				</td>
			</tr>
		</thead>

		<tfoot class="print-footer">
			<tr>
				<td>
					{#if footerEnabled && footerCustomText}
						<div class="footer-content">
							<span class="footer-text">{footerCustomText}</span>
						</div>
					{/if}
				</td>
			</tr>
		</tfoot>

		<tbody>
			<tr>
				<td class="content-cell">
					{#if processedHtml}
						<div class="preview-content prose prose-sm max-w-none" dir={isRTL ? 'rtl' : 'ltr'}>
							{#key settingsStore.current.mermaid}
								{@html processedHtml}
							{/key}
						</div>
					{:else}
						<div class="text-muted-foreground flex h-full items-center justify-center">
							<p>{i18n.t.preview.empty}</p>
						</div>
					{/if}
				</td>
			</tr>
		</tbody>
	</table>

	<!-- Browser native page numbers will be used upon print -->
	{#if footerEnabled && footerCustomText}
		<!-- Optional custom footer text if needed, otherwise handled by table footer -->
	{/if}
</div>

<style>
	/* Screen styles - hide print table structure */
	.print-layout {
		width: 100%;
		border-collapse: collapse;
	}

	.print-layout td {
		padding: 0;
		vertical-align: top;
	}

	/* Header styling for screen */
	.header-content {
		display: flex;
		align-items: center;
		padding: 1rem 2rem;
		border-bottom: 1px solid #e5e7eb;
		min-height: 3rem;
	}

	.header-logo {
		max-height: 3rem;
		max-width: 12rem;
		object-fit: contain;
	}

	.header-text {
		font-size: 0.875rem;
		color: #4b5563;
	}

	/* Footer styling for screen */
	.footer-content {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 2rem;
		border-top: 1px solid #e5e7eb;
		font-size: 0.875rem;
		color: #6b7280;
		min-height: 2rem;
	}

	/* Page number element - show on screen as well for preview */
	.print-page-number {
		text-align: center;
		padding: 0.5rem 0;
		font-size: 0.875rem;
		color: #6b7280;
		border-top: 1px solid #e5e7eb;
	}

	.page-number-value::before {
		content: '1'; /* Placeholder for screen preview */
	}

	/* Content area */
	.content-cell {
		padding: 2rem;
	}

	.preview-content {
		font-family: var(--preview-font, 'Cairo', 'Helvetica Neue', Arial, sans-serif);
		/* Force light mode colors regardless of global dark mode */
		color: #333 !important;
		background-color: white !important;
	}

	/* Ensure preview container always has light background */
	.preview-container {
		background-color: white !important;
		color: #333 !important;
	}

	/* RTL specific styles */
	.preview-content[dir='rtl'] {
		text-align: right;
	}

	.preview-content[dir='rtl'] :global(ul),
	.preview-content[dir='rtl'] :global(ol) {
		padding-right: 2em;
		padding-left: 0;
	}

	.preview-content[dir='ltr'] :global(ul),
	.preview-content[dir='ltr'] :global(ol) {
		padding-left: 2em;
		padding-right: 0;
	}

	/* Code blocks always LTR with proper colors */
	.preview-content :global(pre) {
		direction: ltr;
		text-align: left;
		background-color: #f8f8f8 !important;
		color: #333 !important;
		border: 1px solid #ddd;
		border-radius: 4px;
		padding: 1rem;
	}

	.preview-content :global(code) {
		direction: ltr;
		text-align: left;
		background-color: #f5f5f5 !important;
		color: #333 !important;
		padding: 0.2em 0.4em;
		border-radius: 3px;
		font-family: 'Courier New', monospace;
	}

	.preview-content :global(pre code) {
		background-color: transparent !important;
		padding: 0;
	}

	/* ========== MERMAID DIAGRAMS ========== */
	/* Container styles */
	.preview-content :global(.mermaid) {
		display: flex;
		justify-content: center;
		margin: 1.5rem 0;
		width: 100%;
		max-width: 100%;
		direction: ltr !important;
		text-align: center;
		/* Page break control */
		page-break-inside: avoid;
		break-inside: avoid;
		/* Overflow handling */
		overflow-x: auto;
		overflow-y: visible;
	}

	/* SVG sizing */
	.preview-content :global(.mermaid svg) {
		width: 100%;
		max-width: 100%;
		height: auto;
		background-color: white;
	}

	/* Gantt chart text sizing */
	.preview-content :global(.mermaid svg .grid),
	.preview-content :global(.mermaid svg .section),
	.preview-content :global(.mermaid svg .task) {
		font-size: 11px;
	}

	.preview-content :global(.mermaid svg .taskText) {
		font-size: 10px;
	}

	.preview-content :global(.mermaid svg .sectionTitle) {
		font-size: 12px;
		font-weight: bold;
	}

	/* Table styles - using table-layout: fixed for better long text handling */
	.preview-content :global(table) {
		width: 100%;
		max-width: 100%;
		border-collapse: collapse;
		margin: 1rem 0;
		table-layout: fixed;
	}

	.preview-content :global(th) {
		/* Color/Background removed to use dynamic setting */
		padding: 0.5rem;
		text-align: center;
		border-width: 1px;
		border-style: solid;
		word-wrap: break-word;
		overflow-wrap: break-word;
	}

	.preview-content :global(td) {
		padding: 0.5rem;
		border: 1px solid #ccc;
		text-align: center;
		word-wrap: break-word;
		overflow-wrap: break-word;
	}

	.preview-content :global(tr:nth-child(even)) {
		background-color: #f5f5f5;
	}

	/* Link styles - ensure long URLs wrap properly */
	.preview-content :global(a) {
		/* Color removed to use dynamic setting */
		text-decoration: none;
		word-break: break-all;
	}

	/* Ensure all block elements fit within container */
	.preview-content :global(h1),
	.preview-content :global(h2),
	.preview-content :global(h3),
	.preview-content :global(h4),
	.preview-content :global(h5),
	.preview-content :global(h6),
	.preview-content :global(p),
	.preview-content :global(ul),
	.preview-content :global(ol),
	.preview-content :global(li),
	.preview-content :global(div),
	.preview-content :global(blockquote),
	.preview-content :global(pre),
	.preview-content :global(span) {
		max-width: 100%;
		overflow-wrap: break-word;
	}

	/* Force dark text on paragraphs and list items to prevent dark mode issues */
	.preview-content :global(p),
	.preview-content :global(li),
	.preview-content :global(span) {
		color: #333 !important;
	}

	/* Headings inside tables - ensure they still get their proper colors */
	.preview-content :global(table h1),
	.preview-content :global(table h2),
	.preview-content :global(table h3),
	.preview-content :global(table h4),
	.preview-content :global(table h5),
	.preview-content :global(table h6),
	.preview-content :global(td h1),
	.preview-content :global(td h2),
	.preview-content :global(td h3),
	.preview-content :global(td h4),
	.preview-content :global(td h5),
	.preview-content :global(td h6) {
		margin-top: 0;
		padding-bottom: 0;
		border-bottom: none;
	}

	/* Blockquote RTL */
	.preview-content[dir='rtl'] :global(blockquote) {
		border-right-width: 4px;
		border-right-style: solid;
		border-left: none;
		padding-right: 1rem;
		padding-left: 0;
		margin-right: 0;
	}

	.preview-content[dir='ltr'] :global(blockquote) {
		border-left-width: 4px;
		border-left-style: solid;
		border-right: none;
		padding-left: 1rem;
		padding-right: 0;
		margin-left: 0;
	}

	/* ========== PRINT STYLES ========== */
	@media print {
		.preview-container {
			padding: 0 !important;
			overflow: visible !important;
			height: auto !important;
		}

		.print-layout {
			width: 100%;
		}

		/* Repeating header on each page */
		.print-header {
			display: table-header-group;
		}

		.print-header td {
			padding: 0;
		}

		.header-content {
			padding: 0.5cm 0;
			margin-bottom: 0.5cm;
		}

		/* Repeating footer on each page */
		.print-footer {
			display: table-footer-group;
		}

		.print-footer td {
			padding: 0;
		}

		.footer-content {
			padding: 0.5cm 0;
			margin-top: 0.5cm;
		}

		/* Fixed position page number - Removed to rely on browser default */
		/* .print-page-number and pseudo-elements removed as behavior is inconsistent */

		/* Content area */
		.content-cell {
			padding: 0;
		}

		/* Page break handling */
		.preview-content :global(h1),
		.preview-content :global(h2),
		.preview-content :global(h3) {
			page-break-after: avoid;
			break-after: avoid;
		}

		.preview-content :global(table),
		.preview-content :global(figure),
		.preview-content :global(pre) {
			page-break-inside: avoid;
			break-inside: avoid;
		}

		.preview-content :global(img) {
			max-width: 100%;
			page-break-inside: avoid;
			break-inside: avoid;
		}

		/* Mermaid diagrams - ensure they fit on one page */
		.preview-content :global(.mermaid) {
			page-break-inside: avoid !important;
			break-inside: avoid !important;
			page-break-before: auto;
			page-break-after: auto;
			overflow: visible !important;
			display: flex !important;
			justify-content: center !important;
		}

		.preview-content :global(.mermaid svg) {
			/* Remove max constraints to allow full width as requested */
			width: 100% !important;
			max-width: 100% !important;
			height: auto !important;
		}
	}

	/* Utility classes for positioning */
	.justify-start {
		justify-content: flex-start;
	}

	.justify-center {
		justify-content: center;
	}

	.justify-end {
		justify-content: flex-end;
	}
</style>
