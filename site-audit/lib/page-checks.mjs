import { truncate } from './findings.mjs';

const MOBILE_VIEWPORT = { width: 390, height: 844 };
const DESKTOP_VIEWPORT = { width: 1440, height: 900 };

// axe rules that are worth a real bug report rather than a note.
const AXE_SEVERITY = { critical: 'medium', serious: 'medium', moderate: 'low', minor: 'low' };

function collectPageSignals(page) {
  const signals = { consoleErrors: [], pageErrors: [], requestFailures: [], badResponses: [] };
  page.on('console', (message) => {
    if (message.type() === 'error') {
      signals.consoleErrors.push({ text: message.text(), url: message.location()?.url || null });
    }
  });
  page.on('pageerror', (error) => signals.pageErrors.push(String(error?.message || error)));
  page.on('requestfailed', (request) => {
    // Navigations cancelled by a client-side redirect are noise, not defects.
    if (request.failure()?.errorText !== 'net::ERR_ABORTED') {
      signals.requestFailures.push({ url: request.url(), error: request.failure()?.errorText });
    }
  });
  page.on('response', (response) => {
    if (response.status() >= 400) signals.badResponses.push({ url: response.url(), status: response.status() });
  });
  return signals;
}

async function readHead(page) {
  return page.evaluate(() => {
    const attr = (selector, name) => document.querySelector(selector)?.getAttribute(name) || null;
    return {
      finalUrl: location.href,
      title: document.title,
      lang: document.documentElement.getAttribute('lang'),
      description: attr('meta[name="description"]', 'content'),
      canonical: attr('link[rel="canonical"]', 'href'),
      manifest: attr('link[rel="manifest"]', 'href'),
      viewport: attr('meta[name="viewport"]', 'content'),
      ogTags: [...document.querySelectorAll('meta[property^="og:"]')].map((m) => m.getAttribute('property')),
      twitterTags: [...document.querySelectorAll('meta[name^="twitter:"]')].map((m) => m.getAttribute('name')),
      h1Count: document.querySelectorAll('h1').length,
      hasMainLandmark: Boolean(document.querySelector('main, [role="main"]')),
      bodyText: document.body.innerText.replace(/\s+/g, ' ').trim(),
    };
  });
}

async function readRuntimeConfig(page) {
  return page.evaluate(() => {
    const script = [...document.scripts].map((s) => s.textContent).find((t) => t && t.includes('__NUXT__.config'));
    if (!script) return null;
    const match = script.match(/appUrl:"([^"]*)"/);
    return match ? { appUrl: match[1] } : null;
  });
}

async function runAxe(page, axeSource) {
  await page.addScriptTag({ content: axeSource });
  return page.evaluate(async () => {
    const results = await window.axe.run(document, { resultTypes: ['violations'] });
    return results.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      nodes: violation.nodes.slice(0, 3).map((node) => ({
        target: node.target.join(' '),
        html: node.html.slice(0, 160),
        summary: (node.failureSummary || '').replace(/\s+/g, ' ').trim(),
      })),
    }));
  });
}

async function measureOverflow(page) {
  return page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
}

export async function auditRoutes({ browser, baseUrl, config, findings, axeSource, screenshotDir }) {
  const origin = new URL(baseUrl).origin;
  const pageResults = [];
  const axeTally = new Map();
  let runtimeConfigChecked = false;

  for (const route of config.routes) {
    const context = await browser.newContext({ viewport: DESKTOP_VIEWPORT });
    const page = await context.newPage();
    const signals = collectPageSignals(page);

    let status = null;
    let navigationError = null;
    try {
      const response = await page.goto(origin + route.path, { waitUntil: 'networkidle', timeout: 60_000 });
      status = response?.status() ?? null;
    } catch (error) {
      navigationError = String(error?.message || error).split('\n')[0];
    }

    if (navigationError) {
      findings.add({
        id: `navigation-failed${route.path.replace(/\//g, '-')}`,
        severity: 'high',
        title: `Navigation to ${route.path} failed`,
        where: route.path,
        evidence: navigationError,
        fix: 'Reproduce against the origin: the page never reached a usable state in a real browser.',
      });
      await context.close();
      continue;
    }

    await page.waitForTimeout(2_500);
    const head = await readHead(page);
    const relativeFinalUrl = head.finalUrl.replace(origin, '') || '/';
    const landedOnSignIn = relativeFinalUrl.startsWith(config.signInPath);

    if (!runtimeConfigChecked) {
      runtimeConfigChecked = true;
      const runtime = await readRuntimeConfig(page);
      if (runtime?.appUrl && new URL(runtime.appUrl, origin).origin !== origin) {
        findings.add({
          id: 'runtime-config-appurl-mismatch',
          severity: 'high',
          title: 'Production runtime config advertises a non-production `appUrl`',
          where: 'every server-rendered page',
          evidence: `The deployed server serialises \`runtimeConfig.public.appUrl = "${runtime.appUrl}"\` while the site is served from ${origin}.`,
          fix: 'Set `NUXT_PUBLIC_APP_URL=https://<production-host>` in the deployed environment. Every absolute link built from this value (ticket links in confirmation email, Stripe `success_url`/`cancel_url`, QR payloads, social preview URLs) currently points at a host the buyer cannot reach.',
        });
      }
    }

    if (route.role === 'protected' && !landedOnSignIn) {
      const apiDenials = signals.badResponses.filter((r) => /\/api\//.test(r.url) && [401, 403].includes(r.status));
      findings.add({
        id: `unprotected-route${route.path.replace(/\//g, '-')}`,
        severity: 'high',
        title: `Protected route ${route.path} renders for a signed-out visitor on a cold load`,
        where: route.path,
        evidence: `Opened directly (no in-app navigation): HTTP ${status}, final URL ${relativeFinalUrl}, still rendering "${truncate(head.bodyText, 160)}"${
          apiDenials.length ? `. Its own data calls were rejected: ${apiDenials.map((r) => `${r.status} ${r.url.replace(origin, '')}`).join(', ')}` : ''
        }.`,
        fix: `Guard ${route.path} the same way /dashboard is guarded (server-side, before the page renders). A client-only route middleware that checks \`isLoaded\` first does fire on in-app navigation but no-ops on a cold load, and it never re-runs once the auth state arrives.`,
      });

      if (apiDenials.length && !/sign in|sign-in|not authorised|not authorized|no access|unauthori/i.test(head.bodyText)) {
        findings.add({
          id: `swallowed-api-error${route.path.replace(/\//g, '-')}`,
          severity: 'medium',
          title: `${route.path} hides a failed data request instead of telling the user`,
          where: route.path,
          evidence: `${apiDenials.map((r) => `${r.status} ${r.url.replace(origin, '')}`).join(', ')} was rejected, yet the page shows no error: "${truncate(head.bodyText, 200)}".`,
          fix: 'Surface the `error` from `useFetch` in the template: an empty picker with no explanation is indistinguishable from "this venue has no events".',
        });
      }
    }

    if (route.expectNotFound && /\bnuxt\b/i.test(head.title)) {
      findings.add({
        id: 'unbranded-error-page',
        severity: 'medium',
        title: 'Buyer-facing error states fall back to the framework error page',
        where: route.path,
        evidence: `document.title is "${head.title}" and the page renders the stock Nuxt error screen ("${truncate(head.bodyText, 120)}").`,
        fix: 'Add an `error.vue` that keeps the site header, footer and brand, and gives a buyer a way forward ("this ticket link has expired", "ask the venue for a new link") instead of leaking the framework name.',
      });
    }

    if (head.lang !== config.expectedLang) {
      findings.add({
        id: 'html-missing-lang',
        severity: 'medium',
        title: '`<html>` has no `lang` attribute',
        where: 'every page',
        evidence: `document.documentElement.lang is ${head.lang === null ? 'absent' : `"${head.lang}"`} on every route checked, starting with ${route.path}.`,
        fix: "Set it once in `nuxt.config.ts`: `app: { head: { htmlAttrs: { lang: 'en' } } }`. Without it screen readers pick a voice from the OS locale and WCAG 3.1.1 (Level A) fails on every page.",
      });
    }

    // Only pages a stranger can reach and share are judged on discoverability.
    const isShareable = ['marketing', 'content', 'buyer'].includes(route.role) && !landedOnSignIn;

    if (isShareable && !route.expectNotFound && !head.description) {
      findings.add({
        id: 'meta-description-missing',
        severity: 'low',
        title: 'Public pages ship without a meta description',
        where: route.path,
        evidence: `<meta name="description"> is absent on ${route.path}; title is "${head.title}".`,
        fix: 'Add a description through `useSeoMeta` on the page. The legal pages already do this, so the pattern exists.',
      });
    }

    if (isShareable && !route.expectNotFound && head.ogTags.length === 0 && head.twitterTags.length === 0) {
      findings.add({
        id: 'open-graph-missing',
        severity: 'medium',
        title: 'No Open Graph or Twitter card metadata anywhere, including buyer-facing pages',
        where: route.path,
        evidence: `No \`meta[property^="og:"]\` and no \`meta[name^="twitter:"]\` elements in the document (checked on ${route.path}).`,
        fix: 'Emit `og:title`, `og:description`, `og:image`, `og:url` and `twitter:card` via `useSeoMeta`. Event and ticket links get pasted into texts and group chats; right now they unfurl as a bare URL.',
      });
    }

    if (isShareable && !route.expectNotFound && !head.canonical) {
      findings.add({
        id: 'canonical-missing',
        severity: 'low',
        title: 'Public pages have no canonical URL',
        where: route.path,
        evidence: `<link rel="canonical"> is absent on ${route.path}.`,
        fix: 'Emit a canonical link so query-string variants of event pages do not compete with each other in search results.',
      });
    }

    if (route.pwa && !head.manifest) {
      findings.add({
        id: `pwa-manifest-not-linked${route.path.replace(/\//g, '-')}`,
        severity: 'high',
        title: `${route.path} never links the web app manifest, so it cannot be installed`,
        where: route.path,
        evidence: `No <link rel="manifest"> in the document, even though ${origin}/manifest.webmanifest exists and declares "start_url": "${route.path}".`,
        fix: `Emit the manifest link on this route (${route.path} renders with \`layout: false\`, which is why the shared head never reaches it). Until then gate staff cannot add the scanner to a home screen and always run it inside a browser tab.`,
      });
    }

    // The framework error page is not app-authored markup; `unbranded-error-page` covers it.
    if (!route.expectNotFound) {
      for (const violation of await runAxe(page, axeSource)) {
        const key = violation.id;
        if (!axeTally.has(key)) axeTally.set(key, { violation, routes: [] });
        axeTally.get(key).routes.push(route.path);
      }
    }

    const unexpectedConsole = signals.consoleErrors.filter(
      (entry) => !/Failed to load resource/.test(entry.text) || !route.expectNotFound
    );
    if (signals.pageErrors.length) {
      findings.add({
        id: `uncaught-exception${route.path.replace(/\//g, '-')}`,
        severity: 'high',
        title: `Uncaught JavaScript exception on ${route.path}`,
        where: route.path,
        evidence: truncate(signals.pageErrors.join(' | '), 400),
        fix: 'Fix the exception: anything after it in the same tick does not run.',
      });
    }

    const mobileContext = await browser.newContext({ viewport: MOBILE_VIEWPORT, isMobile: true, hasTouch: true });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto(origin + route.path, { waitUntil: 'networkidle', timeout: 60_000 }).catch(() => {});
    await mobilePage.waitForTimeout(1_500);
    const overflow = await measureOverflow(mobilePage).catch(() => null);
    if (overflow && overflow.scrollWidth > overflow.clientWidth + 1) {
      findings.add({
        id: `mobile-horizontal-overflow${route.path.replace(/\//g, '-')}`,
        severity: 'medium',
        title: `${route.path} scrolls sideways on a phone`,
        where: `${route.path} @ ${MOBILE_VIEWPORT.width}px`,
        evidence: `scrollWidth ${overflow.scrollWidth} > clientWidth ${overflow.clientWidth}.`,
        fix: 'Find the element wider than the viewport and constrain it. Buyers and gate staff are on phones.',
      });
    }
    if (screenshotDir) {
      const name = route.path === '/' ? 'root' : route.path.replace(/^\//, '').replace(/\//g, '-');
      await mobilePage.screenshot({ path: `${screenshotDir}/mobile-${name}.png`, fullPage: true }).catch(() => {});
    }
    await mobileContext.close();

    pageResults.push({
      path: route.path,
      role: route.role,
      status,
      finalUrl: relativeFinalUrl,
      head: { ...head, bodyText: truncate(head.bodyText, 300) },
      consoleErrors: unexpectedConsole,
      requestFailures: signals.requestFailures,
      badResponses: signals.badResponses.map((r) => ({ ...r, url: r.url.replace(origin, '') })),
      mobile: overflow,
    });

    await context.close();
  }

  for (const { violation, routes } of axeTally.values()) {
    if (violation.id === 'html-has-lang') continue; // reported once, with a concrete fix, above
    const node = violation.nodes[0];
    findings.add({
      id: `a11y-${violation.id}`,
      severity: AXE_SEVERITY[violation.impact] || 'low',
      title: `${violation.help} (axe: ${violation.id}, ${violation.impact})`,
      where: routes.join(', '),
      evidence: node ? `${node.target} → ${truncate(node.html, 160)} :: ${truncate(node.summary, 260)}` : '',
      fix: axeFix(violation.id),
    });
  }

  return pageResults;
}

function axeFix(ruleId) {
  const fixes = {
    'color-contrast':
      'The brand green is used as body-text and button-fill colour at `green-500` (#00c950), which is 2.2:1 on white against the 4.5:1 minimum. `green-600` is still only 3.2:1 — map `--ui-primary` to `green-700` (4.95:1) or darker for text and filled buttons in light mode, and stop using `text-dimmed` (slate-400, 2.6:1) for placeholder text.',
    'button-name':
      'Give the control an accessible name. A `role="combobox"` button does not take its name from its contents, so the visible placeholder text is invisible to assistive tech: pass `aria-label` (or wrap it in a `UFormField` with a real label).',
    'link-in-text-block':
      'Underline links that sit inside paragraphs. Colour alone is not enough, and here the colour difference is only 2.1:1 against the surrounding text.',
    'landmark-one-main': 'Wrap the page content in a `<main>` element so screen-reader users can jump straight to it.',
    region: 'Put all content inside landmarks (`<header>`, `<main>`, `<footer>`) instead of loose elements on the document body.',
  };
  return fixes[ruleId] || 'See the axe rule documentation for the recommended remediation.';
}
