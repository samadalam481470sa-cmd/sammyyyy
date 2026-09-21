import { truncate } from './findings.mjs';

const REQUIRED_SECURITY_HEADERS = [
  {
    name: 'content-security-policy',
    severity: 'medium',
    why: 'Nothing constrains where scripts may be loaded from, so a single injected tag can exfiltrate card-adjacent session data.',
    fix: "Serve a CSP from the edge or Nitro (`routeRules` / `nitro.routeRules['/**'].headers`). Start report-only, allow self plus the Clerk and Stripe origins the app already talks to, then enforce.",
  },
  {
    name: 'permissions-policy',
    severity: 'low',
    why: 'The gate scanner asks for camera access; without a Permissions-Policy every embedded context inherits the same powerful features.',
    fix: "Send `Permissions-Policy: camera=(self), geolocation=(), microphone=()` so only the scanner origin can use the camera.",
  },
];

async function safeFetch(url, init = {}) {
  try {
    const response = await fetch(url, { redirect: 'manual', ...init });
    const headers = Object.fromEntries(response.headers.entries());
    return { ok: true, status: response.status, headers, response };
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
}

export async function runHttpChecks({ baseUrl, config, findings }) {
  const origin = new URL(baseUrl).origin;

  const insecure = await safeFetch(baseUrl.replace('https://', 'http://'));
  if (insecure.ok && ![301, 302, 307, 308].includes(insecure.status)) {
    findings.add({
      id: 'http-no-https-redirect',
      severity: 'high',
      title: 'Plain HTTP is not redirected to HTTPS',
      where: baseUrl.replace('https://', 'http://'),
      evidence: `GET over http:// returned ${insecure.status} instead of a redirect.`,
      fix: 'Redirect every http:// request to https:// at the edge before it reaches the app.',
    });
  }

  const robots = await safeFetch(`${origin}/robots.txt`);
  if (!robots.ok || robots.status !== 200) {
    findings.add({
      id: 'robots-missing',
      severity: 'low',
      title: 'robots.txt is missing',
      where: '/robots.txt',
      evidence: robots.ok ? `HTTP ${robots.status}` : robots.error,
      fix: 'Serve a robots.txt that allows the buyer-facing pages and disallows /dashboard, /scan, /tickets and /api.',
    });
  } else {
    const body = await robots.response.text();
    if (!/^\s*sitemap:/im.test(body)) {
      findings.add({
        id: 'robots-no-sitemap-directive',
        severity: 'low',
        title: 'robots.txt does not point at a sitemap',
        where: '/robots.txt',
        evidence: truncate(body.trim(), 240),
        fix: 'Add `Sitemap: https://<host>/sitemap.xml` to robots.txt and generate that sitemap from the published events.',
      });
    }
  }

  const sitemap = await safeFetch(`${origin}/sitemap.xml`);
  if (!sitemap.ok || sitemap.status !== 200) {
    findings.add({
      id: 'sitemap-missing',
      severity: 'low',
      title: 'No sitemap.xml is served',
      where: '/sitemap.xml',
      evidence: sitemap.ok ? `HTTP ${sitemap.status}` : sitemap.error,
      fix: 'Generate a sitemap that lists the public /venue/:venueSlug/:eventSlug pages so buyers can find events through search.',
    });
  }

  const root = await safeFetch(origin, { redirect: 'follow' });
  if (root.ok) {
    for (const header of REQUIRED_SECURITY_HEADERS) {
      if (!root.headers[header.name]) {
        findings.add({
          id: `security-header-missing-${header.name}`,
          severity: header.severity,
          title: `Response header \`${header.name}\` is not set`,
          where: 'all HTML responses',
          evidence: `Headers on GET / : ${Object.keys(root.headers).sort().join(', ')}`,
          fix: `${header.why} ${header.fix}`,
        });
      }
    }

    const hsts = root.headers['strict-transport-security'];
    if (hsts && !/includesubdomains/i.test(hsts)) {
      findings.add({
        id: 'hsts-no-subdomains',
        severity: 'low',
        title: 'HSTS does not cover subdomains',
        where: 'all HTML responses',
        evidence: `strict-transport-security: ${hsts}`,
        fix: 'Send `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` so the Clerk subdomain is covered too.',
      });
    }

    if (root.headers['x-xss-protection']) {
      findings.add({
        id: 'obsolete-x-xss-protection',
        severity: 'low',
        title: 'Obsolete `X-XSS-Protection` header is still sent',
        where: 'all HTML responses',
        evidence: `x-xss-protection: ${root.headers['x-xss-protection']}`,
        fix: 'Drop the header. Every current browser ignores it, and in old Chrome its auditor could itself be abused. A CSP replaces it.',
      });
    }

    if (!root.headers['cache-control']) {
      findings.add({
        id: 'html-no-cache-control',
        severity: 'low',
        title: 'Server-rendered HTML is sent without a `cache-control` header',
        where: 'GET /',
        evidence: `No cache-control on GET /, while /legal/* sends an explicit policy. x-cache: ${root.headers['x-cache'] || 'n/a'}`,
        fix: 'Set an explicit policy on every HTML route so the CDN cannot fall back to its default TTL, e.g. `routeRules: { "/": { headers: { "cache-control": "public, max-age=0, s-maxage=300" } } }`.',
      });
    }
  }

  if (config.healthPath) {
    const health = await safeFetch(`${origin}${config.healthPath}`, { redirect: 'follow' });
    const body = health.ok ? await health.response.text() : '';
    if (!health.ok || health.status !== 200) {
      findings.add({
        id: 'health-endpoint-down',
        severity: 'high',
        title: 'Health endpoint is not reporting healthy',
        where: config.healthPath,
        evidence: health.ok ? `HTTP ${health.status} ${truncate(body, 200)}` : health.error,
        fix: 'Investigate the origin: the app reports its own database connectivity through this endpoint.',
      });
    }
    return { health: truncate(body, 200) };
  }

  return {};
}
