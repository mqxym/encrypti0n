'use strict';

/**
 * Encrypti0n.com service worker.
 *
 * Provides offline support for the whole web application (root + /pages/*).
 * Bundled locally with esbuild (npm run build:sw) so it carries no external
 * dependencies. Caches HTML, JS and CSS as they are requested and refreshes
 * them from the network whenever a connection is available.
 *
 * This worker is registered at the root scope ("/") and therefore controls the
 * whole origin, including StreamSaver's mitm.html iframe. StreamSaver's mitm
 * reuses whatever worker already controls its path (it asks for the broadest
 * matching registration), so it talks to THIS worker instead of registering a
 * second one. We therefore implement StreamSaver's streamed-download protocol
 * here (see the StreamSaver section below). Letting a single worker handle both
 * offline caching and streamed downloads avoids scope/activation races and lets
 * file downloads keep working while fully offline.
 */

import { clientsClaim, setCacheNameDetails } from 'workbox-core';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst, StaleWhileRevalidate, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

setCacheNameDetails({ prefix: 'encrypti0n' });

// Activate a new worker immediately and take control of open pages so updated
// code is served on the next page load without disrupting the current session.
self.skipWaiting();
clientsClaim();

// Pre-cache argon2.wasm on install so it is available even before first use.
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open('encrypti0n-static-assets').then((cache) =>
            cache.add('/assets/libs/cryptit/argon2.wasm')
        )
    );
});

// ---------------------------------------------------------------------------
// StreamSaver integration
// ---------------------------------------------------------------------------
// StreamSaver streams large downloads through a service worker instead of
// buffering them in memory. Its mitm.html iframe reuses this worker (see the
// file header), so we mirror StreamSaver's own sw.js protocol here: a download
// is announced via postMessage (storing its stream against a one-time virtual
// URL), then the page navigates a hidden iframe to that URL, which we answer
// with the stream and a Content-Disposition: attachment header.
//
// These requests are handled before the Workbox routes and stop propagation so
// Workbox never sees — or caches — the transient download URLs.
const streamMap = new Map();

const createStreamSaverStream = (port) =>
    new ReadableStream({
        start(controller) {
            port.onmessage = ({ data }) => {
                if (data === 'end') return controller.close();
                if (data === 'abort') {
                    controller.error('Aborted the download');
                    return;
                }
                controller.enqueue(data);
            };
        },
        cancel() {
            port.postMessage({ abort: true });
        },
    });

self.addEventListener('message', (event) => {
    const data = event.data;

    // Heartbeat from mitm.html that keeps the worker alive — nothing to do.
    if (data === 'ping') return;

    // Only StreamSaver download requests carry a transferable message port.
    if (!event.ports || !event.ports.length) return;

    const port = event.ports[0];
    const downloadUrl =
        data.url ||
        self.registration.scope +
            Math.random() +
            '/' +
            (typeof data === 'string' ? data : data.filename);
    const metadata = [null, data, port];

    if (data.readableStream) {
        metadata[0] = data.readableStream;
    } else if (data.transferringReadable) {
        // The readable end is transferred separately over the same port.
        port.onmessage = (evt) => {
            port.onmessage = null;
            metadata[0] = evt.data.readableStream;
        };
    } else {
        metadata[0] = createStreamSaverStream(port);
    }

    streamMap.set(downloadUrl, metadata);
    port.postMessage({ download: downloadUrl });
});

self.addEventListener('fetch', (event) => {
    const url = event.request.url;

    // Firefox keep-alive ping (see mitm.html) — answer so it never hits cache.
    if (url.endsWith('/ping')) {
        event.stopImmediatePropagation();
        event.respondWith(new Response('pong'));
        return;
    }

    const hijack = streamMap.get(url);
    if (!hijack) return; // Not a download — let the Workbox routes handle it.

    event.stopImmediatePropagation();
    streamMap.delete(url);

    const [stream, data] = hijack;

    // Only copy the length & disposition; don't let callers set arbitrary headers.
    const responseHeaders = new Headers({
        'Content-Type': 'application/octet-stream; charset=utf-8',
        'Content-Security-Policy': "default-src 'none'",
        'X-Content-Security-Policy': "default-src 'none'",
        'X-WebKit-CSP': "default-src 'none'",
        'X-XSS-Protection': '1; mode=block',
        'Cross-Origin-Embedder-Policy': 'require-corp',
    });

    const headers = new Headers(data.headers || {});
    if (headers.has('Content-Length')) {
        responseHeaders.set('Content-Length', headers.get('Content-Length'));
    }
    if (headers.has('Content-Disposition')) {
        responseHeaders.set('Content-Disposition', headers.get('Content-Disposition'));
    }

    event.respondWith(new Response(stream, { headers: responseHeaders }));
});

// ---------------------------------------------------------------------------
// Offline caching routes
// ---------------------------------------------------------------------------
// Never intercept service-worker scripts. Serving a cached worker would block
// updates from ever being fetched fresh.
const isServiceWorkerScript = (url) => /(^|\/)sw\.js$/.test(url.pathname);

// HTML pages (and StreamSaver's mitm.html iframe): prefer the network so users
// get the latest version online, fall back to the cached copy when offline.
// Transient download URLs never reach this route — the StreamSaver fetch handler
// above stops their propagation first.
registerRoute(
    new NavigationRoute(
        new NetworkFirst({
            cacheName: 'html-pages',
            plugins: [
                new CacheableResponsePlugin({ statuses: [0, 200] }),
                new ExpirationPlugin({ maxEntries: 30 }),
            ],
        })
    )
);

// JavaScript: bundled app code (assets/js/*.js), dev-time source modules
// (app/**/*.js) and StreamSaver.min.js. Serve from cache instantly, refresh in
// the background online. Service-worker scripts are excluded so they stay fresh.
registerRoute(
    ({ url, request }) =>
        request.destination === 'script' && !isServiceWorkerScript(url),
    new StaleWhileRevalidate({
        cacheName: 'js-assets',
        plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
    })
);

// Stylesheets: serve from cache instantly, refresh in the background online.
registerRoute(
    ({ request }) => request.destination === 'style',
    new StaleWhileRevalidate({
        cacheName: 'css-assets',
        plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
    })
);

// WebAssembly modules: cache first with a 30-day lifetime.
// Match both native WASM loads (destination === 'wasm') and plain fetch() calls
// (destination === '') since loadArgon2WasmBinary uses fetch().arrayBuffer().
registerRoute(
    ({ url, request }) => request.destination === 'wasm' || url.pathname.endsWith('.wasm'),
    new CacheFirst({
        cacheName: 'static-assets',
        plugins: [
            new CacheableResponsePlugin({ statuses: [0, 200] }),
            new ExpirationPlugin({
                maxEntries: 10,
                maxAgeSeconds: 30 * 24 * 60 * 60,
            }),
        ],
    })
);

// Fonts, icons and images: rarely change, cache first with a 30-day lifetime.
registerRoute(
    ({ request }) => ['font', 'image'].includes(request.destination),
    new CacheFirst({
        cacheName: 'static-assets',
        plugins: [
            new CacheableResponsePlugin({ statuses: [0, 200] }),
            new ExpirationPlugin({
                maxEntries: 100,
                maxAgeSeconds: 30 * 24 * 60 * 60,
            }),
        ],
    })
);
