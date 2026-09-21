import { truncate } from './findings.mjs';

const SW_PATH = '/sw.js';

function parsePrecacheManifest(source) {
  const urls = [...source.matchAll(/\{url:"([^"]+)"/g)].map((match) => match[1]);
  const navigationFallback = source.match(/createHandlerBoundToURL\("([^"]+)"\)/)?.[1] ?? null;
  const allowlist = source.match(/allowlist:\[([^\]]*)\]/)?.[1] ?? null;
  return { urls, navigationFallback, allowlist };
}

/**
 * The service worker can register perfectly and still leave the app dead offline:
 * a navigation fallback is only useful if the document it points at was precached.
 */
export async function inspectServiceWorker({ baseUrl, findings }) {
  const origin = new URL(baseUrl).origin;
  let source;
  try {
    const response = await fetch(`${origin}${SW_PATH}`);
    if (!response.ok) {
      findings.add({
        id: 'service-worker-missing',
        severity: 'high',
        title: 'No service worker is served',
        where: SW_PATH,
        evidence: `HTTP ${response.status}`,
        fix: 'The product promises offline check-in at the gate; that needs a service worker.',
      });
      return null;
    }
    source = await response.text();
  } catch (error) {
    findings.add({
      id: 'service-worker-unreachable',
      severity: 'high',
      title: 'Service worker could not be fetched',
      where: SW_PATH,
      evidence: String(error?.message || error),
      fix: 'Make sure the generated service worker is deployed alongside the build.',
    });
    return null;
  }

  const manifest = parsePrecacheManifest(source);
  const documents = manifest.urls.filter((url) => url.endsWith('.html') || url === '' || url.endsWith('/'));

  if (manifest.navigationFallback) {
    const fallback = manifest.navigationFallback.replace(/^\//, '');
    const precached = manifest.urls.some((url) => {
      const normalised = url.replace(/^\//, '');
      return normalised === fallback || normalised === `${fallback}.html` || normalised === `${fallback}/index.html`;
    });
    if (!precached) {
      findings.add({
        id: 'sw-navigation-fallback-not-precached',
        severity: 'high',
        title: 'Service worker navigation fallback points at a document that was never precached',
        where: SW_PATH,
        evidence:
          `The worker registers \`new NavigationRoute(createHandlerBoundToURL("${manifest.navigationFallback}")` +
          `${manifest.allowlist ? `, { allowlist: [${manifest.allowlist}] }` : ''})\`, but none of its ` +
          `${manifest.urls.length} precache entries is that document (${documents.length} HTML documents precached). ` +
          `Entries are build assets only, e.g. ${manifest.urls.slice(0, 3).join(', ')}.`,
        fix:
          `Precache the document the fallback resolves to. Either prerender it (\`routeRules: { "${manifest.navigationFallback}": { prerender: true } }\`, ` +
          'which puts the HTML in the Workbox manifest), or add a dedicated prerendered offline shell and bind the NavigationRoute to that. ' +
          'Without it the handler falls through to the network and every offline navigation or reload dies on ERR_INTERNET_DISCONNECTED.',
      });
    }
  } else {
    findings.add({
      id: 'sw-no-navigation-route',
      severity: 'high',
      title: 'Service worker precaches assets but handles no navigations',
      where: SW_PATH,
      evidence: `${manifest.urls.length} precache entries, no NavigationRoute registered.`,
      fix: 'Register a NavigationRoute bound to a precached document, otherwise reloading the app offline always fails.',
    });
  }

  return manifest;
}

export async function runOfflineChecks({ browser, baseUrl, config, findings, screenshotDir }) {
  const origin = new URL(baseUrl).origin;
  const results = [];

  for (const route of config.routes.filter((r) => r.mustWorkOffline)) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      serviceWorkers: 'allow',
    });
    const page = await context.newPage();
    await page.goto(origin + route.path, { waitUntil: 'networkidle', timeout: 60_000 });
    await page.waitForTimeout(4_000);

    const worker = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return { supported: false };
      const registrations = await navigator.serviceWorker.getRegistrations();
      return {
        supported: true,
        registrations: registrations.length,
        controller: navigator.serviceWorker.controller?.scriptURL || null,
        caches: 'caches' in window ? await caches.keys() : [],
      };
    });

    if (worker.supported && worker.registrations === 0) {
      findings.add({
        id: `sw-not-registered${route.path.replace(/\//g, '-')}`,
        severity: 'high',
        title: `No service worker registered after loading ${route.path}`,
        where: route.path,
        evidence: JSON.stringify(worker),
        fix: 'Register the worker on the route that needs to work offline.',
      });
    }

    if (screenshotDir) {
      await page.screenshot({ path: `${screenshotDir}/offline-1-online.png`, fullPage: true }).catch(() => {});
    }

    await context.setOffline(true);
    let offlineStatus = null;
    let offlineError = null;
    try {
      const response = await page.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 });
      offlineStatus = response?.status() ?? null;
    } catch (error) {
      offlineError = String(error?.message || error).split('\n')[0];
    }
    await page.waitForTimeout(1_500);
    const rendered = await page
      .evaluate(() => ({ title: document.title, text: document.body?.innerText?.trim() || '' }))
      .catch(() => ({ title: '', text: '' }));

    if (screenshotDir) {
      await page.screenshot({ path: `${screenshotDir}/offline-2-reloaded.png`, fullPage: true }).catch(() => {});
    }

    const broken = Boolean(offlineError) || rendered.text.length === 0;
    if (broken) {
      findings.add({
        id: `offline-reload-broken${route.path.replace(/\//g, '-')}`,
        severity: 'high',
        title: `${route.path} does not survive a reload without network`,
        where: `${route.path} (offline)`,
        evidence:
          `The worker is installed and controlling the page (${worker.controller}, caches: ${JSON.stringify(worker.caches)}), ` +
          `but reloading with the network down ${offlineError ? `failed: ${offlineError}` : 'rendered an empty document'}. ` +
          `Rendered title "${rendered.title}", body "${truncate(rendered.text, 120)}".`,
        fix:
          'The home page sells this exact behaviour ("Works offline at the door… a phone that has loaded the event can check it with no signal at all"). ' +
          'Precache the scanner document so the navigation fallback can serve it, and treat "reload with the network off" as a release check.',
      });
    }

    results.push({ path: route.path, worker, offlineStatus, offlineError, rendered: { ...rendered, text: truncate(rendered.text, 200) } });
    await context.setOffline(false);
    await context.close();
  }

  return results;
}
