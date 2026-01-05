import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit(), wasm(), topLevelAwait()],
	optimizeDeps: {
		include: [],
		exclude: ['loro-crdt']
	},
	resolve: {
		alias: {
			mermaid: 'mermaid/dist/mermaid.esm.min.mjs'
		}
	},
	build: {
		rollupOptions: {
			onwarn(warning, warn) {
				// Suppress sourcemap warnings for loro-crdt
				if (warning.code === 'SOURCEMAP_ERROR' && warning.message.includes('loro-crdt')) {
					return;
				}
				warn(warning);
			}
		}
	}
});
