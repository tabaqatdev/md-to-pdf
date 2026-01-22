import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';

// Initialize markdown-it with syntax highlighting
const md = new MarkdownIt({
	html: true,
	breaks: true,
	linkify: true,
	highlight: function (str, lang) {
		// Skip mermaid blocks - they're handled separately
		if (lang === 'mermaid') {
			return '';
		}

		if (lang && hljs.getLanguage(lang)) {
			try {
				return hljs.highlight(str, { language: lang, ignoreIllegals: true }).value;
			} catch {
				// Fall through to auto-detection
			}
		}

		// Auto-detect language if not specified or not recognized
		try {
			return hljs.highlightAuto(str).value;
		} catch {
			return ''; // Return empty to use default escaping
		}
	}
});

/**
 * Detect if text is primarily RTL (Arabic/Hebrew/Persian)
 * Returns true if significant Arabic characters are found
 */
export function detectRTL(text: string): boolean {
	// Sample first 1000 characters
	const sample = text.slice(0, 1000);
	// Count Arabic/Hebrew/Persian characters
	const rtlCount = (sample.match(/[\u0600-\u06FF\u0590-\u05FF\u0750-\u077F]/g) || []).length;
	// If more than 5 RTL characters, treat as RTL
	return rtlCount > 5;
}

/**
 * Check if a string starts with English characters
 */
export function isEnglishStart(text: string): boolean {
	if (!text) return false;
	const match = text.match(/[\u0600-\u06FFa-zA-Z]/);
	return match !== null && /[a-zA-Z]/.test(match[0]);
}

/**
 * Check if text is primarily English based on first strong character
 * This is a smarter detection that ignores numbers, punctuation, and superscripts
 */
export function isPrimarilyEnglish(text: string): boolean {
	if (!text) return false;
	// Find the first character that is either Arabic (\u0600-\u06FF) or Latin (A-Z)
	// This ignores numbers, punctuation, bullets, and superscripts at the start
	const match = text.match(/[\u0600-\u06FFa-zA-Z]/);
	if (!match) return false;

	// Check if first strong character is English
	if (/[a-zA-Z]/.test(match[0])) {
		// Double-check: count characters to confirm it's mostly English
		const arabicCount = (text.match(/[\u0600-\u06FF]/g) || []).length;
		const englishCount = (text.match(/[a-zA-Z]/g) || []).length;
		return englishCount > arabicCount;
	}
	return false;
}

/**
 * Process HTML for RTL/LTR direction
 * Applies direction to elements based on their content
 * Uses smart per-element detection for mixed content documents
 */
export function processDirection(html: string, isRTL: boolean): string {
	// Create a temporary container to process the HTML
	if (typeof document === 'undefined') return html;

	const container = document.createElement('div');
	container.innerHTML = html;

	// Set base direction
	container.setAttribute('dir', isRTL ? 'rtl' : 'ltr');

	// Code blocks are always LTR
	container.querySelectorAll('pre, code').forEach((el) => {
		(el as HTMLElement).style.direction = 'ltr';
		(el as HTMLElement).style.textAlign = 'left';
	});

	// Process each block element for mixed content
	// This handles documents with mixed Arabic/English content
	if (isRTL) {
		container.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6').forEach((el) => {
			const text = el.textContent || '';
			if (isPrimarilyEnglish(text)) {
				// This element is primarily English, set LTR
				(el as HTMLElement).style.direction = 'ltr';
				(el as HTMLElement).style.textAlign = 'left';

				// For lists in RTL context with LTR content, swap padding
				if (el.tagName === 'LI') {
					const parent = el.parentElement;
					if (parent && (parent.tagName === 'UL' || parent.tagName === 'OL')) {
						(parent as HTMLElement).style.paddingLeft = '2em';
						(parent as HTMLElement).style.paddingRight = '0';
					}
				}
			} else {
				// Ensure Arabic content stays RTL
				(el as HTMLElement).style.direction = 'rtl';
				(el as HTMLElement).style.textAlign = 'right';
			}
		});
	}

	return container.innerHTML;
}

/**
 * Extract mermaid code blocks and return processed HTML
 */
export function extractMermaidBlocks(html: string): { html: string; mermaidBlocks: string[] } {
	if (typeof document === 'undefined') {
		return { html, mermaidBlocks: [] };
	}

	const container = document.createElement('div');
	container.innerHTML = html;

	const mermaidBlocks: string[] = [];
	// markdown-it renders code blocks with class "language-mermaid"
	const mermaidElements = container.querySelectorAll('pre code.language-mermaid');

	mermaidElements.forEach((block, index) => {
		const pre = block.parentElement;
		if (!pre) return;

		const mermaidCode = block.textContent || '';
		mermaidBlocks.push(mermaidCode);

		const div = document.createElement('div');
		div.className = 'mermaid';
		div.id = `mermaid-${index}`;
		div.textContent = mermaidCode;

		// Preserve data-source-line if present
		if (pre.hasAttribute('data-source-line')) {
			div.setAttribute('data-source-line', pre.getAttribute('data-source-line')!);
		}

		pre.parentNode?.replaceChild(div, pre);
	});

	return { html: container.innerHTML, mermaidBlocks };
}

/**
 * Full markdown processing pipeline
 */
export function processMarkdown(content: string): {
	html: string;
	isRTL: boolean;
	mermaidBlocks: string[];
} {
	const isRTL = detectRTL(content);

	// Render using markdown-it
	// Inject line numbers
	const tokens = md.parse(content, {});
	tokens.forEach((token) => {
		if (token.map && token.level === 0) {
			token.attrSet('data-source-line', String(token.map[0]));
			token.attrSet('data-source-line-end', String(token.map[1]));
		}
	});

	let html = md.renderer.render(tokens, md.options, {});

	html = processDirection(html, isRTL);
	const { html: processedHtml, mermaidBlocks } = extractMermaidBlocks(html);

	return {
		html: processedHtml,
		isRTL,
		mermaidBlocks
	};
}

/**
 * Generate CSS for document settings
 */
export function generateSettingsCSS(settings: {
	fontFamily: string;
	fontSize: number;
	lineHeight: number;
	headings: Record<string, { color: string; fontSize: string; borderBottom: boolean }>;
	margins?: { top: string; bottom: string; left: string; right: string };
	theme?: {
		tableHeader: string;
		links: string;
		blockquotes: string;
		codeBlock: string;
		textColor: string;
	};
}): string {
	// ... existing heading styles code ...
	const headingStyles = Object.entries(settings.headings)
		.map(([tag, style]) => {
			return `
        .preview-content ${tag} {
          color: ${style.color} !important;
          font-size: ${style.fontSize} !important;
          ${style.borderBottom ? `border-bottom: 2pt solid ${style.color}; padding-bottom: 6pt;` : 'border-bottom: none;'}
        }
      `;
		})
		.join('\n');

	const marginStyles = settings.margins
		? `padding: ${settings.margins.top} ${settings.margins.right} ${settings.margins.bottom} ${settings.margins.left};`
		: '';

	// Default colors if theme is missing (backward compatibility)
	const tableHeaderColor = settings.theme?.tableHeader || settings.headings.h1.color;
	const linkColor = settings.theme?.links || settings.headings.h2.color;
	const quoteColor = settings.theme?.blockquotes || settings.headings.h2.color;
	const textColor = settings.theme?.textColor || '#333333';

	return `
    .preview-content {
      font-family: "${settings.fontFamily}", "Helvetica Neue", Arial, sans-serif !important;
      font-size: ${settings.fontSize}pt !important;
      line-height: ${settings.lineHeight} !important;
      color: ${textColor} !important;
    }
    .preview-container {
      ${marginStyles}
    }
    
    /* Apply text color to common elements to ensure override */
    /* Note: Exclude code block spans to allow syntax highlighting colors */
    .preview-content p,
    .preview-content li,
    .preview-content td {
        color: ${textColor} !important;
    }
    .preview-content span:not([class*="hljs"]) {
        color: ${textColor} !important;
    }

    ${headingStyles}
    
    /* Dynamic Theme Colors */
    .preview-content th {
      background-color: ${tableHeaderColor} !important;
      border-color: ${tableHeaderColor} !important;
      color: white !important;
    }
    
    .preview-content blockquote {
      border-color: ${quoteColor} !important;
    }

    .preview-content a {
      color: ${linkColor} !important;
    }

    @media print {
      @page {
        size: A4;
        ${settings.margins ? `margin: ${settings.margins.top} ${settings.margins.right} ${settings.margins.bottom} ${settings.margins.left};` : ''}
      }
    }
  `;
}
