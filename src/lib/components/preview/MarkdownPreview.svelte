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

	// Calculate max diagram height based on page size and margins
	let maxDiagramHeight = $derived.by(() => {
		// Page sizes in mm
		const pageSizes: Record<string, number> = {
			A4: 297,
			Letter: 279.4,
			Legal: 355.6,
			Canvas: 297
		};
		const pageHeight = pageSizes[pageSize] || 297;

		// Parse margin values
		const parseMargin = (m: string) => {
			const v = parseFloat(m);
			if (m.endsWith('cm')) return v * 10;
			if (m.endsWith('in')) return v * 25.4;
			return v; // mm
		};

		const topMargin = parseMargin(margins.top);
		const bottomMargin = parseMargin(margins.bottom);
		const headerSpace = headerEnabled ? 15 : 0;
		const footerSpace = footerEnabled ? 10 : 0;

		// Available height in mm, with 15mm safety buffer
		const availableHeight = pageHeight - topMargin - bottomMargin - headerSpace - footerSpace - 15;
		return `${availableHeight}mm`;
	});

	async function renderMermaid() {
		if (typeof window === 'undefined' || !previewContainer) return;

		try {
			await tick();

			const mermaidModule = await import('mermaid');
			const mermaid = mermaidModule.default || mermaidModule;

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
					nodeBorder: '1px solid #333',
					mainBkg: '#fff',
					nodeTextColor: '#333'
				},
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
				timeline: {
					useMaxWidth: true
				},
				flowchart: {
					useMaxWidth: true
				},
				mindmap: {
					useMaxWidth: true,
					padding: 16,
					maxNodeWidth: 250
				}
			});

			const mermaidDivs = previewContainer.querySelectorAll('.mermaid');
			if (mermaidDivs.length > 0) {
				mermaidDivs.forEach((div) => {
					(div as HTMLElement).style.fontSize = `${fontSize}px`;
				});

				await mermaid.run({
					nodes: mermaidDivs as NodeListOf<HTMLElement>
				});

				// Post-process SVGs to make them responsive
				mermaidDivs.forEach((div) => {
					const svg = div.querySelector('svg');
					if (svg) {
						makeSvgResponsive(svg, fontFamily, fontSize);
					}
				});
			}
		} catch (error) {
			console.error('Mermaid rendering error:', error);
		}
	}

	// Make SVG responsive by ensuring viewBox is set and removing fixed dimensions
	function makeSvgResponsive(svg: SVGElement, fontFamily: string, fontSize: number) {
		// Get the intrinsic dimensions
		let width = parseFloat(svg.getAttribute('width') || '0');
		let height = parseFloat(svg.getAttribute('height') || '0');

		// If no width/height, try getBoundingClientRect
		if (!width || !height) {
			const rect = svg.getBoundingClientRect();
			width = rect.width || 100;
			height = rect.height || 100;
		}

		// Ensure viewBox is set for proper scaling
		if (!svg.getAttribute('viewBox') && width && height) {
			svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
		}

		// Remove fixed dimensions to allow CSS to control size
		svg.removeAttribute('width');
		svg.removeAttribute('height');

		// Apply font styles
		svg.style.fontFamily = fontFamily;
		svg.style.fontSize = `${fontSize}px`;
	}

	onMount(async () => {
		try {
			await import('mermaid');
			mermaidReady = true;
			if (processedHtml && previewContainer?.querySelectorAll('.mermaid').length > 0) {
				renderMermaid();
			}
		} catch (error) {
			console.error('Failed to load mermaid:', error);
		}

		// Handle page numbering for print
		const updatePageNumbers = () => {
			const pageNumberElements = previewContainer?.querySelectorAll('.page-number');
			pageNumberElements?.forEach((el) => {
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
	style="--max-diagram-height: {maxDiagramHeight};"
>
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
</div>

<style>
	/* Print layout table */
	.print-layout {
		width: 100%;
		border-collapse: collapse;
	}

	.print-layout td {
		padding: 0;
		vertical-align: top;
	}

	/* Header styling */
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

	/* Footer styling */
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

	/* Content area */
	.content-cell {
		padding: 2rem;
	}

	.preview-content {
		font-family: var(--preview-font, 'Cairo', 'Helvetica Neue', Arial, sans-serif);
		color: #333;
		background-color: white;
	}

	.preview-container {
		background-color: white;
		color: #333;
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

	/* Code blocks - always LTR with syntax highlighting */
	.preview-content :global(pre) {
		direction: ltr;
		text-align: left;
		background-color: #f6f8fa;
		border: 1px solid #e1e4e8;
		border-radius: 6px;
		padding: 1rem;
		overflow-x: auto;
		font-size: 0.9em;
		line-height: 1.5;
	}

	.preview-content :global(code) {
		direction: ltr;
		text-align: left;
		font-family: 'SF Mono', 'Fira Code', 'Consolas', 'Monaco', 'Menlo', monospace;
		font-size: 0.9em;
	}

	/* Inline code (not in pre block) */
	.preview-content :global(:not(pre) > code) {
		background-color: rgba(175, 184, 193, 0.2);
		padding: 0.2em 0.4em;
		border-radius: 4px;
		color: #1f2328;
	}

	/* Code block styling - let highlight.js handle colors */
	.preview-content :global(pre code) {
		background-color: transparent;
		padding: 0;
		color: inherit;
		font-size: inherit;
	}

	/* Ensure highlight.js colors are visible */
	.preview-content :global(pre code.hljs) {
		background: transparent;
		padding: 0;
	}

	/* ========== MERMAID DIAGRAMS ========== */
	.preview-content :global(.mermaid) {
		display: block;
		margin: 1.5rem auto;
		text-align: center;
		direction: ltr;
		max-width: 100%;
		/* Key constraint: limit height to fit on one page */
		max-height: var(--max-diagram-height, 230mm);
		overflow: hidden;
	}

	.preview-content :global(.mermaid svg) {
		display: block;
		margin: 0 auto;
		max-width: 100%;
		max-height: var(--max-diagram-height, 230mm);
		width: auto;
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

	/* Mindmap text sizing - ensure readable text */
	.preview-content :global(.mermaid svg .mindmap-node text),
	.preview-content :global(.mermaid svg .node text),
	.preview-content :global(.mermaid svg text.nodeLabel),
	.preview-content :global(.mermaid svg foreignObject div) {
		font-size: 16px !important;
		font-weight: 500;
	}

	/* Root node (center) should be larger */
	.preview-content :global(.mermaid svg .mindmap-node.section-root text),
	.preview-content :global(.mermaid svg .node.default.root text) {
		font-size: 20px !important;
		font-weight: 600;
	}

	/* Table styles */
	.preview-content :global(table) {
		width: 100%;
		max-width: 100%;
		border-collapse: collapse;
		margin: 1rem 0;
		table-layout: fixed;
	}

	.preview-content :global(th) {
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

	/* Link styles */
	.preview-content :global(a) {
		text-decoration: none;
		word-break: break-all;
	}

	/* Block elements */
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
	.preview-content :global(span) {
		max-width: 100%;
		overflow-wrap: break-word;
	}

	/* Headings inside tables */
	.preview-content :global(table h1),
	.preview-content :global(table h2),
	.preview-content :global(table h3),
	.preview-content :global(table h4),
	.preview-content :global(table h5),
	.preview-content :global(table h6) {
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
			padding: 0;
			overflow: visible;
			height: auto;
		}

		.print-layout {
			width: 100%;
		}

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

		/* Mermaid diagrams - key print styles */
		.preview-content :global(.mermaid) {
			page-break-inside: avoid;
			break-inside: avoid;
			display: block;
			text-align: center;
			margin: 1rem auto;
			-webkit-print-color-adjust: exact;
			print-color-adjust: exact;
		}

		.preview-content :global(.mermaid svg) {
			display: block;
			margin: 0 auto;
		}
	}

	/* Utility classes */
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
