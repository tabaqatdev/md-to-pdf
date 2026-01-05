/*! coi-serviceworker v0.1.7 - Guido Zuidhof and contributors, licensed under MIT */
/*
 * Cross-Origin Isolation Service Worker
 *
 * This service worker enables cross-origin isolation on static hosts (like GitHub Pages)
 * by intercepting requests and adding COOP/COEP headers.
 *
 * Required for:
 * - OPFS (Origin Private File System)
 * - SharedArrayBuffer
 * - High-resolution timers
 *
 * Based on: https://github.com/gzuidhof/coi-serviceworker
 */

let coepCredentialless = false;
if (typeof window === 'undefined') {
	// We're in the service worker
	self.addEventListener('install', () => self.skipWaiting());
	self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

	self.addEventListener('message', (ev) => {
		if (!ev.data) {
			return;
		} else if (ev.data.type === 'deregister') {
			self.registration
				.unregister()
				.then(() => {
					return self.clients.matchAll();
				})
				.then((clients) => {
					clients.forEach((client) => client.navigate(client.url));
				});
		} else if (ev.data.type === 'coepCredentialless') {
			coepCredentialless = ev.data.value;
		}
	});

	self.addEventListener('fetch', function (event) {
		const request = event.request;

		// Skip non-navigation requests
		if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') {
			return;
		}

		event.respondWith(
			fetch(request)
				.then((response) => {
					if (response.status === 0) {
						return response;
					}

					const newHeaders = new Headers(response.headers);
					newHeaders.set(
						'Cross-Origin-Embedder-Policy',
						coepCredentialless ? 'credentialless' : 'require-corp'
					);
					newHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');

					return new Response(response.body, {
						status: response.status,
						statusText: response.statusText,
						headers: newHeaders
					});
				})
				.catch((e) => {
					console.error('Service worker fetch error:', e);
					return new Response('Service worker fetch error', { status: 500 });
				})
		);
	});
} else {
	// We're in the main thread - this shouldn't execute but kept for compatibility
	(() => {
		const registration = navigator.serviceWorker.register(window.document.currentScript.src).then(
			(reg) => {
				if (!(!reg.active && (reg.installing || reg.waiting))) {
					// Already active
					reg.update();
				}
				return reg;
			},
			(err) => {
				console.error('COI Service Worker registration failed:', err);
			}
		);

		if (window.crossOriginIsolated !== false) return;

		window.addEventListener('load', function () {
			if (window.crossOriginIsolated !== false) return;

			registration.then(
				(reg) => {
					if (reg.active && !reg.installing && !reg.waiting) {
						window.location.reload();
					}
				},
				() => {}
			);
		});
	})();
}
