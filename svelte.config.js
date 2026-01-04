import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: '200.html', // SPA fallback for client-side routing
			precompress: false,
			strict: true
		}),
		paths: {
			// Set base path for GitHub Pages deployment
			// Change 'md-to-pdf' to your repository name
			base: process.env.NODE_ENV === 'production' ? '/md-to-pdf' : ''
		}
	}
};

export default config;
