// site-migrate :: lib/probe — source-site probing helpers for intake.mjs.
// Plain Node ESM, global fetch only. Sequential polite requests.

const UA = 'Mozilla/5.0 (compatible; site-migrate-intake)';
const POLITE_DELAY_MS = 400;
const TIMEOUT_MS = 60_000; // cold WP caches can take >40s on first hit

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let requested = false;

// Sequential, polite, retries once on network error / 5xx (cold-cache 504s).
export async function politeFetch(url, headers = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (requested) await sleep(POLITE_DELAY_MS);
    requested = true;
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'user-agent': UA, ...headers },
      });
      if (res.status >= 500 && attempt === 0) continue;
      const text = await res.text();
      return {
        ok: res.ok,
        status: res.status,
        url: res.url,
        text,
        contentType: res.headers.get('content-type') || '',
      };
    } catch (e) {
      if (attempt === 0) continue;
      return { ok: false, status: 0, url, text: '', error: e.message };
    }
  }
}

// ---------- tiny HTML helpers (regex-grade; probe is heuristic by design) ----------

export function findTags(html, tagName) {
  return html.match(new RegExp(`<${tagName}\\b[^>]*>`, 'gi')) || [];
}

export function attrOf(tag, name) {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return m ? (m[1] ?? m[2] ?? m[3]) : undefined;
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'");
}

function hostOf(url, base) {
  try { return new URL(url, base).hostname; } catch { return null; }
}

function baseDomain(host) {
  return host.split('.').slice(-2).join('.');
}

// ---------- homepage analysis ----------

export function analyzeHtml(html, pageUrl) {
  const generators = findTags(html, 'meta')
    .filter((t) => /name\s*=\s*["']?generator/i.test(t))
    .map((t) => attrOf(t, 'content'))
    .filter(Boolean);

  const htmlLang = attrOf(findTags(html, 'html')[0] || '', 'lang') || null;

  const hreflang = findTags(html, 'link')
    .filter((t) => /rel\s*=\s*["']?alternate/i.test(t) && /hreflang/i.test(t))
    .map((t) => ({ lang: attrOf(t, 'hreflang'), href: attrOf(t, 'href') }))
    .filter((a) => a.lang && a.href);

  const forms = findTags(html, 'form').map((t) => ({
    action: decodeEntities(attrOf(t, 'action') || ''),
    method: (attrOf(t, 'method') || 'get').toLowerCase(),
    id: attrOf(t, 'id') || null,
    class: attrOf(t, 'class') || null,
  }));

  const iframes = findTags(html, 'iframe')
    .map((t) => decodeEntities(attrOf(t, 'src') || ''))
    .filter(Boolean);

  const ownDomain = baseDomain(new URL(pageUrl).hostname);
  const thirdPartyScriptDomains = [...new Set(
    findTags(html, 'script')
      .map((t) => attrOf(t, 'src'))
      .filter(Boolean)
      .map((src) => hostOf(decodeEntities(src), pageUrl))
      .filter((h) => h && baseDomain(h) !== ownDomain),
  )].sort();

  const animLibs = {};
  for (const lib of ['swiper', 'slick', 'owl', 'aos', 'gsap', 'animate']) {
    animLibs[lib] = (html.match(new RegExp(`\\b${lib}`, 'gi')) || []).length;
  }
  const animation = {
    lib_refs: animLibs,
    total_lib_refs: Object.values(animLibs).reduce((a, b) => a + b, 0),
    css_animation_refs: (html.match(/\banimation[-:]/gi) || []).length,
    css_transition_refs: (html.match(/\btransition[-:]/gi) || []).length,
  };

  const consentBanner =
    /(?:class|id)\s*=\s*["'][^"']*(?:consent|cookie|gdpr)/i.test(html);

  const wordpress =
    generators.some((g) => /wordpress/i.test(g)) || /\/wp-content\//i.test(html);

  return {
    generators, htmlLang, hreflang, forms, iframes,
    thirdPartyScriptDomains, animation, consentBanner, wordpress,
  };
}

// ---------- sitemap ----------

export function parseSitemapXml(xml) {
  const isIndex = /<sitemapindex[\s>]/i.test(xml);
  const isUrlset = /<urlset[\s>]/i.test(xml);
  const locs = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)]
    .map((m) => decodeEntities(m[1]));
  return { isIndex, isUrlset, locs };
}

// Resolve sitemap location: robots hints first, then conventional paths.
export async function probeSitemap(origin, robotsSitemaps) {
  const candidates = [...robotsSitemaps,
    `${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`, `${origin}/wp-sitemap.xml`];
  for (const candidate of [...new Set(candidates)]) {
    const res = await politeFetch(candidate);
    if (!res.ok || !/<(sitemapindex|urlset)[\s>]/i.test(res.text)) continue;
    const parsed = parseSitemapXml(res.text);
    if (!parsed.isIndex) {
      return { url: res.url, type: 'urlset', subsitemaps: [],
               total_urls: parsed.locs.length, urls: parsed.locs };
    }
    // sitemap index: follow one level, count URLs per sub-sitemap
    const subsitemaps = [];
    const urls = [];
    for (const subUrl of parsed.locs) {
      const sub = await politeFetch(subUrl);
      if (!sub.ok) { subsitemaps.push({ url: subUrl, url_count: null, error: `HTTP ${sub.status}` }); continue; }
      const subParsed = parseSitemapXml(sub.text);
      subsitemaps.push({ url: subUrl, url_count: subParsed.locs.length });
      urls.push(...subParsed.locs);
    }
    return { url: res.url, type: 'index', subsitemaps, total_urls: urls.length, urls };
  }
  return { url: null, type: 'none', subsitemaps: [], total_urls: 0, urls: [] };
}

// ---------- locales ----------

const LOCALE_SEG = /^[a-z]{2,3}(?:-[a-z]{2,4})?$/i;

// hreflang alternates → locale ids, URL map, mechanism.
// Locale ids come from URL path prefixes when distinct URLs exist (the id the
// site itself routes by), falling back to the hreflang primary subtag.
export function inferLocales(hreflang, homepageUrl, htmlLang) {
  const home = new URL(homepageUrl);
  const byHref = new Map(); // href -> langs[]
  for (const { lang, href } of hreflang) {
    let abs;
    try { abs = new URL(href, homepageUrl).href; } catch { continue; }
    if (!byHref.has(abs)) byHref.set(abs, []);
    byHref.get(abs).push(lang.toLowerCase());
  }

  if (byHref.size === 0) {
    const fallback = (htmlLang || 'en').toLowerCase().split('-')[0];
    return {
      locales: [fallback], default_locale: fallback, locale_urls: { [fallback]: homepageUrl },
      mechanism: 'unknown',
      mechanism_note: 'no hreflang alternates found — js-switcher or accept-language; needs human confirmation',
    };
  }

  const hosts = new Set([...byHref.keys()].map((h) => new URL(h).hostname));
  const paths = new Set([...byHref.keys()].map((h) => new URL(h).pathname));
  let mechanism, mechanism_note = null;
  if (hosts.size > 1) mechanism = 'subdomain';
  else if (paths.size > 1) mechanism = 'url-path';
  else {
    mechanism = 'unknown';
    mechanism_note = 'all hreflang alternates share one URL — js-switcher or accept-language; needs human confirmation';
  }

  const xDefaultHref = hreflang.find((a) => a.lang.toLowerCase() === 'x-default')?.href;
  const locale_urls = {};
  let default_locale = null;
  for (const [href, langs] of byHref) {
    const realLangs = langs.filter((l) => l !== 'x-default');
    const url = new URL(href);
    const firstSeg = url.pathname.split('/').filter(Boolean)[0];
    let id;
    if (mechanism === 'url-path' && firstSeg && LOCALE_SEG.test(firstSeg)) {
      id = firstSeg.toLowerCase();
    } else if (mechanism === 'subdomain' && url.hostname !== home.hostname
               && LOCALE_SEG.test(url.hostname.split('.')[0])) {
      id = url.hostname.split('.')[0].toLowerCase();
    } else {
      id = (realLangs[0] || htmlLang || 'en').toLowerCase().split('-')[0];
    }
    if (locale_urls[id] === undefined) locale_urls[id] = href;
    const isDefault = xDefaultHref
      ? new URL(xDefaultHref, homepageUrl).href === href
      : url.hostname === home.hostname && url.pathname === home.pathname;
    if (isDefault && !default_locale) default_locale = id;
  }
  const locales = Object.keys(locale_urls);
  if (!default_locale) default_locale = locales[0];
  return { locales, default_locale, locale_urls, mechanism, mechanism_note };
}
