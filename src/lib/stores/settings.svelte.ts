export interface HeadingStyle {
	color: string;
	fontSize: string;
	borderBottom: boolean;
}

export interface DocumentSettings {
	// Typography
	fontFamily: string;
	fontSize: number;
	lineHeight: number;

	// Page Layout
	pageSize: 'A4' | 'Letter' | 'Legal' | 'Canvas';
	margins: {
		top: string;
		bottom: string;
		left: string;
		right: string;
	};

	// Header
	header: {
		enabled: boolean;
		logo?: string; // Base64 data URL
		logoPosition: 'left' | 'center' | 'right';
		text?: string;
		showOnFirstPage: boolean;
	};

	// Footer
	footer: {
		enabled: boolean;
		showPageNumbers: boolean;
		pageNumberFormat: '1' | '1/N' | 'Page 1' | 'صفحة 1';
		customText?: string;
	};

	// Theme Colors (Independent of Headings)
	theme: {
		tableHeader: string;
		links: string;
		blockquotes: string;
		codeBlock: string;
		textColor: string;
	};

	// Heading Styles
	headings: {
		h1: HeadingStyle;
		h2: HeadingStyle;
		h3: HeadingStyle;
		h4: HeadingStyle;
		h5: HeadingStyle;
		h6: HeadingStyle;
	};
}

export const defaultSettings: DocumentSettings = {
	fontFamily: 'Cairo',
	fontSize: 10,
	lineHeight: 1.6,
	pageSize: 'A4',
	margins: {
		top: '1.5cm',
		bottom: '1.5cm',
		left: '1.5cm',
		right: '1.5cm'
	},
	theme: {
		tableHeader: '#2c3e50', // PwC/McKinsey style dark blue
		links: '#2980b9',
		blockquotes: '#2980b9',
		codeBlock: '#f8f9fa',
		textColor: '#2d3436'
	},
	header: {
		enabled: false,
		logoPosition: 'left',
		showOnFirstPage: true
	},
	footer: {
		enabled: false,
		showPageNumbers: true,
		pageNumberFormat: '1'
	},
	headings: {
		h1: { color: '#2c3e50', fontSize: '18pt', borderBottom: true },
		h2: { color: '#2980b9', fontSize: '14pt', borderBottom: true },
		h3: { color: '#34495e', fontSize: '12pt', borderBottom: false },
		h4: { color: '#2d3436', fontSize: '11pt', borderBottom: false },
		h5: { color: '#636e72', fontSize: '10pt', borderBottom: false },
		h6: { color: '#b2bec3', fontSize: '10pt', borderBottom: false }
	}
};

const SETTINGS_STORAGE_KEY = 'md-to-pdf-global-settings';

function createSettingsStore() {
	let settings = $state<DocumentSettings>(structuredClone(defaultSettings));

	function init() {
		if (typeof window === 'undefined') return;
		const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
		if (stored) {
			try {
				const parsed = JSON.parse(stored);
				// Deep merge to ensure new theme keys exist if loading old settings
				settings = { 
					...defaultSettings, 
					...parsed,
					theme: { ...defaultSettings.theme, ...parsed.theme }
				};
			} catch {
				settings = structuredClone(defaultSettings);
			}
		}
	}

	function save() {
		if (typeof window !== 'undefined') {
			localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
		}
	}

	function update(partial: Partial<DocumentSettings>) {
		settings = { ...settings, ...partial };
		save();
	}

	function updateHeader(partial: Partial<DocumentSettings['header']>) {
		settings.header = { ...settings.header, ...partial };
		save();
	}

	function updateFooter(partial: Partial<DocumentSettings['footer']>) {
		settings.footer = { ...settings.footer, ...partial };
		save();
	}

	function updateTheme(partial: Partial<DocumentSettings['theme']>) {
		settings.theme = { ...settings.theme, ...partial };
		save();
	}

	function updateHeading(level: keyof DocumentSettings['headings'], style: Partial<HeadingStyle>) {
		settings.headings[level] = { ...settings.headings[level], ...style };
		save();
	}

	function reset() {
		settings = structuredClone(defaultSettings);
		save();
	}

	function setLogo(dataUrl: string | undefined) {
		settings.header.logo = dataUrl;
		save();
	}

	return {
		get current() {
			return settings;
		},
		init,
		save,
		update,
		updateHeader,
		updateFooter,
		updateTheme,
		updateHeading,
		reset,
		setLogo
	};
}

export const settingsStore = createSettingsStore();
