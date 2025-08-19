/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';
import { debugAPI } from '$lib/utils/debug';

const sw = self as unknown as ServiceWorkerGlobalScope;

// Create a unique cache name for this deployment
// Force cache update for API fix
const CACHE = `cache-${version}-api-fix`;

const ASSETS = [
	...build, // the app itself
	...files, // everything in `static`
];

sw.addEventListener('install', (event) => {
	// Create a new cache and add all files to it
	async function addFilesToCache() {
		const cache = await caches.open(CACHE);
		await cache.addAll(ASSETS);
	}

	event.waitUntil(addFilesToCache());
});

sw.addEventListener('activate', (event) => {
	// Remove previous cached data from disk
	async function deleteOldCaches() {
		for (const key of await caches.keys()) {
			if (key !== CACHE) await caches.delete(key);
		}
	}

	event.waitUntil(deleteOldCaches());
});

sw.addEventListener('fetch', (event) => {
	// ignore non-GET requests
	if (event.request.method !== 'GET') return;

	const url = new URL(event.request.url);
	
	// Skip intercepting API requests entirely - let them go through Vite's proxy
	// This allows the development/test proxy to handle routing to the correct backend
	if (url.pathname.startsWith('/api/')) {
		debugAPI('[SW] Skipping API request', { pathname: url.pathname });
		// Don't intercept - let the browser handle this request normally
		// In development/test: Vite proxy will route to backend
		// In production: Direct API calls (same origin)
		return;
	}

	async function respond() {
		const cache = await caches.open(CACHE);

		// `build`/`files` can always be served from the cache
		if (ASSETS.includes(url.pathname)) {
			const response = await cache.match(url.pathname);
			if (response) {
				return response;
			}
		}

		// for everything else (non-API), try the network first, but
		// fall back to the cache if offline
		try {
			const response = await fetch(event.request);

			// if we're offline, fetch can return a value that is not a Response
			// instead of throwing - and we can't pass this non-Response to respondWith
			if (!(response instanceof Response)) {
				throw new Error('invalid response from fetch');
			}

			if (response.status === 200) {
				cache.put(event.request, response.clone());
			}

			return response;
		} catch (err) {
			const response = await cache.match(event.request);

			if (response) {
				return response;
			}

			// if there's no cache, then just error out
			// as there is nothing we can do to respond to this request
			throw err;
		}
	}

	event.respondWith(respond());
});
