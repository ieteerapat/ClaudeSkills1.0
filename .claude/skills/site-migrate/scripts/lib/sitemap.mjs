// site-migrate :: lib/sitemap — polite sitemap fetching + parsing (no deps).
// Sequential requests only; retries on 5xx (slim-seo sub-sitemaps are generated
// on demand and can 504 while warming).

const UA = 'Mozilla/5.0 (compatible; site-migrate-seed)';
const MIN_DELAY_MS = 600;
const RETRY_BACKOFF_MS = [2000, 5000, 10000, 20000, 30000];

let lastRequestAt = 0;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Polite GET: ≥MIN_DELAY_MS between requests, custom UA, retry on 5xx/network.
// Returns { status, headers, text } or throws after exhausting retries.
export async function politeFetch(url, { retries = RETRY_BACKOFF_MS.length, timeoutMs = 120000 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const wait = lastRequestAt + MIN_DELAY_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': UA },
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.status >= 500) {
        lastErr = new Error(`HTTP ${res.status} for ${url}`);
      } else {
        return { status: res.status, headers: res.headers, text: await res.text() };
      }
    } catch (e) {
      lastErr = e;
    }
    if (attempt < retries) {
      const backoff = RETRY_BACKOFF_MS[Math.min(attempt, RETRY_BACKOFF_MS.length - 1)];
      console.error(`[fetch] ${lastErr.message} — retry ${attempt + 1}/${retries} in ${backoff / 1000}s`);
      await sleep(backoff);
    }
  }
  throw lastErr;
}

function extractLocs(xml) {
  const locs = [];
  const re = /<loc>\s*([^<]+?)\s*<\/loc>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    locs.push(m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#0?39;/g, "'").replace(/&quot;/g, '"'));
  }
  return locs;
}

export function isSitemapIndex(xml) {
  return /<sitemapindex[\s>]/i.test(xml);
}

// Fetch a sitemap URL; if it is an index, return its sub-sitemap URLs under
// { index: [...] }; if a urlset, return { urls: [...] }.
export async function fetchSitemap(url) {
  const { status, text } = await politeFetch(url);
  if (status !== 200) throw new Error(`HTTP ${status} for ${url}`);
  if (isSitemapIndex(text)) return { index: extractLocs(text) };
  if (/<urlset[\s>]/i.test(text)) return { urls: extractLocs(text) };
  throw new Error(`not a sitemap (no <sitemapindex>/<urlset>): ${url}`);
}
