'use strict';

/**
 * Encrypti0n.com service worker.
 *
 * Provides offline support for the whole web application, including the root
 * page and `/pages/*`. The worker is bundled locally with esbuild via
 * `npm run build:sw`, so it carries no runtime dependency on third-party CDNs.
 *
 * Design decisions:
 * - Cache HTML, JavaScript, CSS, shell images, fonts, icons, images and WASM
 *   with different strategies because they have different freshness and
 *   availability requirements.
 * - Prefer fresh HTML from the network, but always keep usable offline
 *   fallbacks.
 * - Keep the Argon2 WASM cache outside Workbox so its cache name is stable and
 *   unaffected by Workbox cache-name prefixing.
 * - Let this root-scoped worker also handle StreamSaver downloads. StreamSaver's
 *   `mitm.html` iframe reuses the broadest matching worker registration, so
 *   this worker must implement both offline caching and streamed-download
 *   handling.
 * - Avoid caching transient StreamSaver download URLs by intercepting them
 *   before Workbox routes run.
 */

import { clientsClaim, setCacheNameDetails } from 'workbox-core';
import { registerRoute, NavigationRoute, setCatchHandler } from 'workbox-routing';
import { NetworkFirst, StaleWhileRevalidate, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

/**
 * Configures the prefix Workbox applies to Workbox-managed cache names.
 *
 * Design decision:
 * - Use a project-specific prefix so Encrypti0n.com caches are easy to identify
 *   in browser DevTools and less likely to collide with other apps on the same
 *   origin.
 */
setCacheNameDetails({ prefix: 'encrypti0n' });

/**
 * Cache used for WASM assets.
 *
 * Design decision:
 * - This cache is managed manually rather than by Workbox so the literal cache
 *   name remains `wasm-assets`. That avoids Workbox prefixing and keeps WASM
 *   cache lookups stable across service-worker versions.
 *
 * @type {string}
 */
const WASM_CACHE = 'wasm-assets';

/**
 * Cache used for static image and font assets that can safely be served
 * cache-first.
 *
 * @type {string}
 */
const STATIC_ASSETS_CACHE = 'static-assets';

/**
 * Cache used for navigable HTML pages.
 *
 * Design decision:
 * - HTML uses a dedicated cache because it has stricter freshness requirements
 *   than images and fonts. Users should see the newest page when online, but
 *   still get a usable shell while offline.
 *
 * @type {string}
 */
const HTML_CACHE = 'html-pages';

/**
 * Core HTML pages that should be available before first navigation.
 *
 * Design decision:
 * - Pre-cache only the minimum HTML set needed for a reliable offline shell.
 *   Other HTML pages are cached lazily as users visit them.
 *
 * @type {string[]}
 */
const CORE_HTML_URLS = [
    '/',
    '/index.html',
    '/pages/offline.html',
];

/**
 * Cache used for application shell assets that should be available offline.
 *
 * @type {string}
 */
const SHELL_ASSETS_CACHE = 'shell-assets';

/**
 * Small, critical visual assets that should always be cached.
 *
 * Design decision:
 * - Logos are treated as shell assets because they are part of the perceived
 *   app chrome. They should remain available even before the browser has had a
 *   chance to discover them through normal image requests.
 *
 * @type {string[]}
 */
const ALWAYS_CACHE_ASSETS = [
    '/assets/images/logo.webp',
    '/assets/images/logo-dark.webp',
    '/assets/images/logo-sm.webp',
];

/**
 * Immediately activates updated service-worker code and claims existing pages.
 *
 * Design decision:
 * - `skipWaiting()` and `clientsClaim()` reduce the window where old and new
 *   service-worker code are both active. This is useful for a security-focused
 *   app where cached code should update promptly.
 * - Current page execution is not force-reloaded; users continue their active
 *   session, while the next navigation or asset request uses the new worker.
 */
self.skipWaiting();
clientsClaim();

/**
 * Installs the service worker and primes critical offline caches.
 *
 * Design decisions:
 * - Cache Argon2 WASM during install so cryptographic functionality can work
 *   offline as early as possible.
 * - Skip network fetches for assets that are already cached. This allows a
 *   service-worker script update to install while the user is offline.
 * - Treat all install-time cache failures as non-fatal. A failed logo, HTML
 *   page, or WASM fetch should not prevent the worker from installing; runtime
 *   fallback logic still handles missing resources.
 *
 * @param {ExtendableEvent} event - Browser install event.
 * @returns {void}
 */
self.addEventListener('install', (event) => {
    event.waitUntil(
        Promise.all([
            caches.open(WASM_CACHE).then(async (cache) => {
                const existing = await cache.match('/assets/libs/cryptit/argon2.wasm');
                if (existing) return;

                try {
                    await cache.add('/assets/libs/cryptit/argon2.wasm');
                } catch {
                    // Do not fail SW installation just because WASM could not be cached.
                }
            }),

            caches.open(HTML_CACHE).then(async (cache) => {
                await Promise.all(
                    CORE_HTML_URLS.map(async (url) => {
                        try {
                            const existing = await cache.match(url);
                            if (!existing) {
                                await cache.add(url);
                            }
                        } catch {
                            // Keep install resilient. The navigation route still has fallbacks.
                        }
                    })
                );
            }),

            caches.open(SHELL_ASSETS_CACHE).then(async (cache) => {
                await Promise.all(
                    ALWAYS_CACHE_ASSETS.map(async (url) => {
                        try {
                            const existing = await cache.match(url);
                            if (!existing) {
                                await cache.add(url);
                            }
                        } catch {
                            // Shell images improve offline UX but should not block installation.
                        }
                    })
                );
            }),
        ])
    );
});

// ---------------------------------------------------------------------------
// StreamSaver integration
// ---------------------------------------------------------------------------

/**
 * Stores one-time StreamSaver download streams by their virtual download URL.
 *
 * StreamSaver streams large downloads through a service worker instead of
 * buffering them in memory. Its `mitm.html` iframe reuses this worker because
 * this worker is registered at the root scope. A download is announced via
 * `postMessage`, stored in this map, then later consumed by a `fetch` request
 * for the generated virtual URL.
 *
 * Design decisions:
 * - Use an in-memory map because StreamSaver download URLs are transient,
 *   single-use, and should never survive a worker restart.
 * - Delete entries as soon as the corresponding fetch is handled so streams
 *   cannot be replayed and memory is released promptly.
 *
 * @type {Map<string, [ReadableStream, object, MessagePort]>}
 */
const streamMap = new Map();

/**
 * Creates a ReadableStream backed by a StreamSaver message port.
 *
 * Design decisions:
 * - Support StreamSaver's message protocol directly in this worker so the app
 *   does not need a second service worker.
 * - Propagate cancellation back to the page through the message port. This lets
 *   the producer stop generating data when the browser cancels the download.
 *
 * @param {MessagePort} port - Message port used by StreamSaver to send chunks.
 * @returns {ReadableStream} A stream that yields chunks received from the port.
 */
const createStreamSaverStream = (port) =>
    new ReadableStream({
        /**
         * Starts forwarding chunks from the message port into the stream.
         *
         * @param {ReadableStreamDefaultController} controller - Stream controller.
         * @returns {void}
         */
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

        /**
         * Notifies the producer that the consumer cancelled the download.
         *
         * @returns {void}
         */
        cancel() {
            port.postMessage({ abort: true });
        },
    });

/**
 * Handles messages sent to the service worker.
 *
 * Supported messages:
 * - `"ping"`: heartbeat from StreamSaver's `mitm.html`; intentionally ignored.
 * - StreamSaver download metadata with a transferable `MessagePort`.
 *
 * Design decisions:
 * - Ignore messages without a port because StreamSaver download setup always
 *   includes one.
 * - Generate a one-time virtual URL when StreamSaver does not provide one.
 * - Support all StreamSaver stream-transfer modes: direct `readableStream`,
 *   deferred `transferringReadable`, and chunked port messages.
 *
 * @param {ExtendableMessageEvent} event - Message event sent to the worker.
 * @returns {void}
 */
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

/**
 * Handles fetches that must run before Workbox routing:
 * - StreamSaver `/ping` keep-alive requests.
 * - WASM asset requests.
 * - StreamSaver one-time virtual download URLs.
 *
 * Design decisions:
 * - Use `stopImmediatePropagation()` for these requests so Workbox never sees
 *   or caches them.
 * - Handle WASM manually to avoid Workbox cache-name prefixing.
 * - Use URL strings as WASM cache keys instead of `Request` objects to avoid
 *   `Vary`-header differences causing unnecessary cache misses.
 * - Only allow selected StreamSaver response headers through. This prevents
 *   callers from injecting arbitrary headers into a download response.
 *
 * @param {FetchEvent} event - Browser fetch event.
 * @returns {void}
 */
self.addEventListener('fetch', (event) => {
    const url = event.request.url;

    // Firefox keep-alive ping (see mitm.html) — answer so it never hits cache.
    if (url.endsWith('/ping')) {
        event.stopImmediatePropagation();
        event.respondWith(new Response('pong'));
        return;
    }

    // WASM assets: cache-first using a dedicated cache whose name is not
    // transformed by Workbox's prefix logic. Handles both native WASM loads
    // (destination === 'wasm') and plain fetch() calls (destination === '').
    if (url.endsWith('.wasm')) {
        event.stopImmediatePropagation();
        event.respondWith(
            caches.open(WASM_CACHE).then(async (cache) => {
                const cached = await cache.match(url);
                if (cached) return cached;

                try {
                    const response = await fetch(event.request);

                    if (response.ok || response.type === 'opaque') {
                        cache.put(url, response.clone()).catch(() => {});
                    }

                    return response;
                } catch {
                    return new Response('WASM asset is not available offline.', {
                        status: 503,
                        headers: {
                            'Content-Type': 'text/plain; charset=utf-8',
                        },
                    });
                }
            })
        );
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

/**
 * Tests whether a URL points to the service-worker script itself.
 *
 * Design decision:
 * - Service-worker scripts must never be served from cache. Returning a cached
 *   worker can permanently block updates because the browser may never see the
 *   newer script bytes.
 *
 * @param {URL} url - Parsed request URL.
 * @returns {boolean} True when the request targets `sw.js`.
 */
const isServiceWorkerScript = (url) => /(^|\/)[^/]*sw\.js$/.test(url.pathname);

/**
 * Network-first strategy used for navigations and HTML documents.
 *
 * Design decisions:
 * - Prefer network for HTML so users receive the latest app shell and page
 *   content while online.
 * - Cache successful and opaque responses so local and cross-origin-compatible
 *   development scenarios remain resilient.
 * - Limit HTML entries to prevent the cache from growing without bound.
 *
 * @type {NetworkFirst}
 */
const htmlNetworkFirst = new NetworkFirst({
    cacheName: HTML_CACHE,
    plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({ maxEntries: 30 }),
    ],
});

/**
 * Resolves an offline HTML fallback for a failed navigation.
 *
 * Fallback priority:
 * - For `/` and `/index.html`, try both canonical home-page variants before
 *   the offline page.
 * - For other pages, try the exact cached request, then the offline page, then
 *   the home page.
 *
 * Design decisions:
 * - Keep `/` and `/index.html` synchronized because browsers and app links may
 *   request either form.
 * - Prefer a cached copy of the exact page when available, because it is more
 *   useful than a generic offline page.
 *
 * @param {Request} request - Failed navigation request.
 * @returns {Promise<Response|undefined>} Cached fallback response, if present.
 */
const getCachedHtmlFallback = async (request) => {
    const cache = await caches.open(HTML_CACHE);
    const url = new URL(request.url);

    if (url.pathname === '/' || url.pathname === '/index.html') {
        return (
            await cache.match('/') ||
            await cache.match('/index.html') ||
            await cache.match('/pages/offline.html')
        );
    }

    return (
        await cache.match(request) ||
        await cache.match('/pages/offline.html') ||
        await cache.match('/index.html') ||
        await cache.match('/')
    );
};

/**
 * Registers the navigation route for HTML pages.
 *
 * Design decisions:
 * - Use a custom `NavigationRoute` handler instead of only a stock Workbox
 *   strategy so the app can apply project-specific fallback ordering.
 * - Keep `/` and `/index.html` synchronized after any successful home-page
 *   network response.
 * - Return a minimal inline offline document as the last resort so navigation
 *   failures always produce a valid HTML response.
 */
registerRoute(
    new NavigationRoute(async ({ event, request }) => {
        try {
            const response = await htmlNetworkFirst.handle({ event, request });

            if (response) {
                // Keep / and /index.html synchronized when either one succeeds.
                const url = new URL(request.url);

                if (url.pathname === '/' || url.pathname === '/index.html') {
                    const cache = await caches.open(HTML_CACHE);
                    cache.put('/', response.clone()).catch(() => {});
                    cache.put('/index.html', response.clone()).catch(() => {});
                }

                return response;
            }
        } catch {
            // Fall through to cache fallback below.
        }

        const fallback = await getCachedHtmlFallback(request);

        if (fallback) return fallback;

        return new Response(
            '<!doctype html><title>Offline</title><h1>Offline</h1><p>This page is not available offline.</p>',
            {
                status: 503,
                headers: {
                    'Content-Type': 'text/html; charset=utf-8',
                },
            }
        );
    })
);

/**
 * Registers caching for JavaScript assets.
 *
 * Design decisions:
 * - Use stale-while-revalidate so already-cached app code loads quickly while
 *   updates are refreshed in the background.
 * - Exclude service-worker scripts so update checks always reach the network.
 */
registerRoute(
    ({ url, request }) =>
        request.destination === 'script' && !isServiceWorkerScript(url),
    new StaleWhileRevalidate({
        cacheName: 'js-assets',
        plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
    })
);

/**
 * Registers caching for CSS assets.
 *
 * Design decision:
 * - Use stale-while-revalidate for stylesheets because stale CSS is usually
 *   acceptable for one load, while background refresh keeps the UI current.
 */
registerRoute(
    ({ request }) => request.destination === 'style',
    new StaleWhileRevalidate({
        cacheName: 'css-assets',
        plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
    })
);

/**
 * Registers cache-first handling for critical shell assets.
 *
 * Design decision:
 * - Shell logos are small and rarely change, so cache-first gives reliable
 *   offline rendering and avoids unnecessary network requests.
 */
registerRoute(
    ({ url }) => ALWAYS_CACHE_ASSETS.includes(url.pathname),
    new CacheFirst({
        cacheName: SHELL_ASSETS_CACHE,
        plugins: [
            new CacheableResponsePlugin({ statuses: [0, 200] }),
        ],
    })
);

/**
 * Registers cache-first handling for fonts and images.
 *
 * Design decisions:
 * - Fonts and images are typically content-addressed or rarely changed, making
 *   them good candidates for cache-first behavior.
 * - Apply a 30-day lifetime and entry cap to avoid unbounded storage growth.
 */
registerRoute(
    ({ request }) => ['font', 'image'].includes(request.destination),
    new CacheFirst({
        cacheName: STATIC_ASSETS_CACHE,
        plugins: [
            new CacheableResponsePlugin({ statuses: [0, 200] }),
            new ExpirationPlugin({
                maxEntries: 100,
                maxAgeSeconds: 30 * 24 * 60 * 60,
            }),
        ],
    })
);

/**
 * Global Workbox catch handler.
 *
 * Design decisions:
 * - Navigation failures should resolve to a friendly offline page whenever
 *   possible.
 * - Non-navigation failures should remain real failures via `Response.error()`;
 *   returning placeholder JS, CSS, image, or WASM responses could hide bugs and
 *   leave the app in a misleading partial state.
 */
setCatchHandler(async ({ request }) => {
    if (request.mode === 'navigate') {
        const cache = await caches.open(HTML_CACHE);

        return (
            await cache.match('/pages/offline.html') ||
            await cache.match('/index.html') ||
            await cache.match('/') ||
            new Response(
                '<!doctype html><title>Offline</title><h1>Offline</h1><p>This page is not available offline.</p>',
                {
                    status: 503,
                    headers: {
                        'Content-Type': 'text/html; charset=utf-8',
                    },
                }
            )
        );
    }

    return Response.error();
});