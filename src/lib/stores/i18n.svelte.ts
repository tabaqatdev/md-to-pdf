import en from '$lib/i18n/en.json';
import ar from '$lib/i18n/ar.json';

export type Language = 'en' | 'ar';
export type Direction = 'ltr' | 'rtl';

type TranslationKeys = typeof en;

const translations: Record<Language, TranslationKeys> = { en, ar };

const STORAGE_KEY = 'md-to-pdf-language';

function getInitialLanguage(): Language {
	if (typeof window === 'undefined') return 'en';
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored === 'en' || stored === 'ar') return stored;
	const browserLang = navigator.language.toLowerCase();
	return browserLang.startsWith('ar') ? 'ar' : 'en';
}

function createI18nStore() {
	let language = $state<Language>('en');
	const direction = $derived<Direction>(language === 'ar' ? 'rtl' : 'ltr');
	const t = $derived(translations[language]);

	function init() {
		language = getInitialLanguage();
		updateDocument();
	}

	function setLanguage(lang: Language) {
		language = lang;
		if (typeof window !== 'undefined') {
			localStorage.setItem(STORAGE_KEY, lang);
			updateDocument();
		}
	}

	function updateDocument() {
		if (typeof document !== 'undefined') {
			document.documentElement.lang = language;
			document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
		}
	}

	function translate(key: string): string {
		const keys = key.split('.');
		let value: unknown = t;
		for (const k of keys) {
			if (value && typeof value === 'object' && k in value) {
				value = (value as Record<string, unknown>)[k];
			} else {
				return key;
			}
		}
		return typeof value === 'string' ? value : key;
	}

	return {
		get language() {
			return language;
		},
		get direction() {
			return direction;
		},
		get t() {
			return t;
		},
		init,
		setLanguage,
		translate
	};
}

export const i18n = createI18nStore();
