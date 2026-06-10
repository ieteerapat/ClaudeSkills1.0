// site-migrate :: lib/normalize — shared masking/canonicalization layer.
// Imported by capture.mjs AND compare.mjs: the same code runs on both sides,
// which is what makes parity honest. Pure functions only (stabilizePage and
// maskRegions operate on a playwright page handed in by the caller — no deps
// are imported here).

// ---------------------------------------------------------------------------
// tiny HTML parser (input is browser-serialized DOM, i.e. balanced markup)
// ---------------------------------------------------------------------------

const VOID = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
  'param', 'source', 'track', 'wbr',
]);
const RAWTEXT = new Set(['script', 'style', 'textarea', 'title']);

function parseTag(html, start) {
  // start points at '<'; returns { name, attrs, end } where end is index after '>'
  let i = start + 1;
  const nameStart = i;
  while (i < html.length && /[a-zA-Z0-9:-]/.test(html[i])) i++;
  const name = html.slice(nameStart, i).toLowerCase();
  const attrs = [];
  while (i < html.length) {
    while (i < html.length && /\s/.test(html[i])) i++;
    if (html[i] === '>') return { name, attrs, end: i + 1 };
    if (html[i] === '/' && html[i + 1] === '>') return { name, attrs, end: i + 2 };
    // attribute name
    const aStart = i;
    while (i < html.length && !/[\s=>/]/.test(html[i])) i++;
    if (i === aStart) { i++; continue; } // stray char, skip
    const aName = html.slice(aStart, i).toLowerCase();
    while (i < html.length && /\s/.test(html[i])) i++;
    if (html[i] !== '=') { attrs.push([aName, '']); continue; }
    i++; // past '='
    while (i < html.length && /\s/.test(html[i])) i++;
    let value = '';
    if (html[i] === '"' || html[i] === "'") {
      const q = html[i]; i++;
      const vEnd = html.indexOf(q, i);
      value = html.slice(i, vEnd === -1 ? html.length : vEnd);
      i = vEnd === -1 ? html.length : vEnd + 1;
    } else {
      const vStart = i;
      while (i < html.length && !/[\s>]/.test(html[i])) i++;
      value = html.slice(vStart, i);
    }
    attrs.push([aName, decodeEntities(value)]);
  }
  return { name, attrs, end: i };
}

function decodeEntities(s) {
  if (!s.includes('&')) return s;
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&');
}

function escapeText(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

export function parseHtml(html) {
  const root = { type: 'root', children: [] };
  const stack = [root];
  const top = () => stack[stack.length - 1];
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt === -1) {
      top().children.push({ type: 'text', text: decodeEntities(html.slice(i)) });
      break;
    }
    if (lt > i) top().children.push({ type: 'text', text: decodeEntities(html.slice(i, lt)) });
    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt + 4);
      i = end === -1 ? html.length : end + 3; // comments dropped (capture noise)
      continue;
    }
    if (html[lt + 1] === '!' || html[lt + 1] === '?') {
      const end = html.indexOf('>', lt);
      top().children.push({ type: 'doctype', raw: html.slice(lt, end === -1 ? html.length : end + 1) });
      i = end === -1 ? html.length : end + 1;
      continue;
    }
    if (html[lt + 1] === '/') {
      const end = html.indexOf('>', lt);
      const name = html.slice(lt + 2, end === -1 ? html.length : end).trim().toLowerCase();
      // lenient close: pop to matching open if present
      for (let s = stack.length - 1; s > 0; s--) {
        if (stack[s].name === name) { stack.length = s; break; }
      }
      i = end === -1 ? html.length : end + 1;
      continue;
    }
    if (!/[a-zA-Z]/.test(html[lt + 1] || '')) { // bare '<' in text
      top().children.push({ type: 'text', text: '<' });
      i = lt + 1;
      continue;
    }
    const { name, attrs, end } = parseTag(html, lt);
    const el = { type: 'element', name, attrs, children: [] };
    top().children.push(el);
    i = end;
    if (VOID.has(name)) continue;
    if (RAWTEXT.has(name)) {
      const closeRe = new RegExp(`</${name}\\s*>`, 'i');
      const m = closeRe.exec(html.slice(i));
      const rawEnd = m ? i + m.index : html.length;
      el.children.push({ type: 'raw', text: html.slice(i, rawEnd) });
      i = m ? rawEnd + m[0].length : html.length;
      continue;
    }
    stack.push(el);
  }
  return root;
}

// ---------------------------------------------------------------------------
// minimal CSS selector matching (simple compound selectors; for selectors with
// combinators only the rightmost compound is matched — acceptable for a
// canonicalizer whose only requirement is determinism on both sides)
// ---------------------------------------------------------------------------

function compileSelectorList(selectorList) {
  return selectorList.split(',').map((s) => compileCompound(s.trim())).filter(Boolean);
}

function compileCompound(sel) {
  // take rightmost compound if combinators present
  const parts = sel.split(/[\s>+~]+/).filter(Boolean);
  const compound = parts[parts.length - 1];
  if (!compound) return null;
  const tests = [];
  const re = /([a-zA-Z0-9*_-]+)|\.([a-zA-Z0-9_-]+)|#([a-zA-Z0-9_-]+)|\[\s*([a-zA-Z0-9_-]+)\s*(?:([*^$~|]?=)\s*(?:"([^"]*)"|'([^']*)'|([^\]\s]*)))?\s*\]/g;
  let m;
  let consumed = 0;
  while ((m = re.exec(compound)) !== null) {
    if (m.index !== consumed) return null; // unsupported syntax (e.g. :pseudo)
    consumed = re.lastIndex;
    if (m[1] !== undefined) {
      const tag = m[1].toLowerCase();
      if (tag !== '*') tests.push((el) => el.name === tag);
    } else if (m[2] !== undefined) {
      const cls = m[2];
      tests.push((el) => getAttr(el, 'class').split(/\s+/).includes(cls));
    } else if (m[3] !== undefined) {
      const id = m[3];
      tests.push((el) => getAttr(el, 'id') === id);
    } else {
      const attr = m[4].toLowerCase();
      const op = m[5];
      const val = m[6] ?? m[7] ?? m[8];
      if (op === undefined || val === undefined) {
        tests.push((el) => hasAttr(el, attr));
      } else if (op === '=') tests.push((el) => getAttr(el, attr) === val);
      else if (op === '*=') tests.push((el) => getAttr(el, attr).includes(val));
      else if (op === '^=') tests.push((el) => getAttr(el, attr).startsWith(val));
      else if (op === '$=') tests.push((el) => getAttr(el, attr).endsWith(val));
      else if (op === '~=') tests.push((el) => getAttr(el, attr).split(/\s+/).includes(val));
      else tests.push((el) => getAttr(el, attr) === val || getAttr(el, attr).startsWith(val + '-'));
    }
  }
  if (consumed !== compound.length || tests.length === 0) return null;
  return (el) => tests.every((t) => t(el));
}

function getAttr(el, name) {
  const a = el.attrs.find(([k]) => k === name);
  return a ? a[1] : '';
}
function hasAttr(el, name) {
  return el.attrs.some(([k]) => k === name);
}

function walk(node, fn) {
  if (!node.children) return;
  for (const child of node.children) {
    if (child.type === 'element') {
      fn(child, node);
      walk(child, fn);
    }
  }
}

// ---------------------------------------------------------------------------
// query-param stripping
// ---------------------------------------------------------------------------

function paramMatchers(patterns) {
  return (patterns || []).map(
    (p) => new RegExp('^' + p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$', 'i')
  );
}

export function stripQueryParams(url, matchers) {
  const qIdx = url.indexOf('?');
  if (qIdx === -1 || matchers.length === 0) return url;
  const hashIdx = url.indexOf('#', qIdx);
  const base = url.slice(0, qIdx);
  const query = url.slice(qIdx + 1, hashIdx === -1 ? url.length : hashIdx);
  const hash = hashIdx === -1 ? '' : url.slice(hashIdx);
  const kept = query
    .split('&')
    .filter((pair) => {
      const name = pair.split('=')[0];
      return !matchers.some((m) => m.test(name));
    });
  return kept.length ? `${base}?${kept.join('&')}${hash}` : `${base}${hash}`;
}

const URL_ATTRS = new Set(['href', 'src', 'action', 'poster', 'data-src', 'data-lazy-src']);

// ---------------------------------------------------------------------------
// normalizeHtml — the canonicalizer
// ---------------------------------------------------------------------------

export function normalizeHtml(html, maskRules = {}) {
  const root = parseHtml(html);
  const qMatchers = paramMatchers(maskRules.strip_query_params);
  const textPatterns = (maskRules.text_patterns || []).map((r) => ({
    re: new RegExp(r.pattern, 'g'),
    replace: r.replace,
  }));
  const attrPatterns = (maskRules.mask_attribute_patterns || []).map((r) => ({
    attr: r.attr.toLowerCase(),
    re: new RegExp(r.pattern),
  }));
  const removeSel = [];
  const textSel = [];
  for (const rule of maskRules.mask_selectors || []) {
    const compiled = compileSelectorList(rule.selector);
    if (rule.mode === 'remove') removeSel.push(...compiled);
    else if (rule.mode === 'text') textSel.push(...compiled);
  }
  const removeScripts = maskRules.remove_scripts || [];

  const applyTextPatterns = (s) => {
    for (const { re, replace } of textPatterns) s = s.replace(re, replace);
    return s;
  };
  const stripUrlsInCss = (s) =>
    s.replace(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/g, (_, q, u) => `url(${q}${stripQueryParams(u, qMatchers)}${q})`);

  // pass 1: structural removal
  const prune = (node) => {
    if (!node.children) return;
    node.children = node.children.filter((child) => {
      if (child.type !== 'element') return true;
      if (child.name === 'script') {
        const src = getAttr(child, 'src');
        const body = child.children.map((c) => c.text || '').join('');
        if (removeScripts.some((p) => src.includes(p) || body.includes(p))) return false;
      }
      if (removeSel.some((match) => match(child))) return false;
      return true;
    });
    for (const child of node.children) prune(child);
  };
  prune(root);

  // pass 2: text-blanking, attribute masking, url stripping, patterns
  walk(root, (el) => {
    if (textSel.some((match) => match(el))) blankText(el);
    el.attrs = el.attrs.filter(([k, v]) => {
      const rule = attrPatterns.find((r) => r.attr === k);
      if (!rule) return true;
      if (k === 'class') return true; // token-filtered below
      return !rule.re.test(v);
    });
    el.attrs = el.attrs.map(([k, v]) => {
      if (k === 'class') {
        const rules = attrPatterns.filter((r) => r.attr === 'class');
        if (rules.length) {
          v = v.split(/\s+/).filter((t) => t && !rules.some((r) => r.re.test(t))).join(' ');
        }
      }
      if (URL_ATTRS.has(k)) v = stripQueryParams(v, qMatchers);
      if (k === 'srcset' || k === 'data-srcset') {
        v = v.split(',').map((part) => {
          const bits = part.trim().split(/\s+/);
          bits[0] = stripQueryParams(bits[0], qMatchers);
          return bits.join(' ');
        }).join(', ');
      }
      if (k === 'style') v = stripUrlsInCss(v);
      return [k, applyTextPatterns(v)];
    });
    for (const child of el.children || []) {
      if (child.type === 'text') {
        child.text = applyTextPatterns(child.text).replace(/\s+/g, ' ');
      } else if (child.type === 'raw') {
        child.text = applyTextPatterns(el.name === 'style' ? stripUrlsInCss(child.text) : child.text);
      }
    }
  });
  // collapse whitespace in top-level stray text too
  for (const child of root.children) {
    if (child.type === 'text') child.text = child.text.replace(/\s+/g, ' ');
  }

  return serialize(root).trim() + '\n';
}

function blankText(el) {
  for (const child of el.children || []) {
    if (child.type === 'text' || child.type === 'raw') child.text = '';
    else if (child.type === 'element') blankText(child);
  }
}

function serialize(node) {
  if (node.type === 'text') {
    return node.text === '' ? '' : escapeText(node.text);
  }
  if (node.type === 'raw') return node.text;
  if (node.type === 'doctype') return node.raw;
  if (node.type === 'root') return node.children.map(serialize).join('');
  // element: sorted attributes for stable serialization
  const attrs = [...node.attrs]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([k, v]) => (v === '' ? ` ${k}=""` : ` ${k}="${escapeAttr(v)}"`))
    .join('');
  const open = `<${node.name}${attrs}>`;
  if (VOID.has(node.name)) return open;
  return `${open}${node.children.map(serialize).join('')}</${node.name}>`;
}

// ---------------------------------------------------------------------------
// extractText — visible text content, whitespace-collapsed
// ---------------------------------------------------------------------------

const INVISIBLE = new Set(['script', 'style', 'noscript', 'template', 'head', 'iframe', 'svg']);

export function extractText(html) {
  const root = typeof html === 'string' ? parseHtml(html) : html;
  const out = [];
  const visit = (node) => {
    if (node.type === 'text') { out.push(node.text); return; }
    if (node.type === 'element' && (INVISIBLE.has(node.name) || hasAttr(node, 'hidden'))) return;
    for (const child of node.children || []) visit(child);
  };
  visit(root);
  return out.join(' ').replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// stabilizePage — playwright page-side capture stabilization
// ---------------------------------------------------------------------------

const CONSENT_ACCEPT_SELECTORS = [
  '#onetrust-accept-btn-handler',
  '.cky-btn-accept',
  '#cookie_action_close_header',
  '.cmplz-accept',
  '.cc-allow', '.cc-accept', '.cc-btn.cc-dismiss',
  '#cn-accept-cookie',
  '[id*="cookie"] button[class*="accept"]',
  '[class*="cookie"] [class*="accept"]',
  '[class*="consent"] [class*="accept"]',
  '[aria-label*="accept cookies" i]',
];

export async function stabilizePage(page, maskRules = {}) {
  const freeze = maskRules.freeze || {};
  try { await page.waitForLoadState('networkidle', { timeout: 20000 }); } catch { /* keep going */ }

  if (freeze.animations !== false) {
    await page.addStyleTag({
      content:
        '*, *::before, *::after { animation: none !important; transition: none !important; ' +
        'caret-color: transparent !important; scroll-behavior: auto !important; }',
    }).catch(() => {});
  }

  // auto-dismiss consent banners (click common accept controls)
  await page.evaluate((selectors) => {
    for (const sel of selectors) {
      try {
        document.querySelectorAll(sel).forEach((el) => {
          if (el instanceof HTMLElement) el.click();
        });
      } catch { /* invalid selector for this engine — skip */ }
    }
  }, CONSENT_ACCEPT_SELECTORS).catch(() => {});

  // lazyload: force-eager
  if (freeze.lazyload === 'force-eager' || freeze.lazyload === undefined) {
    await page.evaluate(() => {
      document.querySelectorAll('img[loading="lazy"], iframe[loading="lazy"]')
        .forEach((el) => el.setAttribute('loading', 'eager'));
      document.querySelectorAll('img[data-src], source[data-srcset], img[data-lazy-src]')
        .forEach((el) => {
          const src = el.getAttribute('data-src') || el.getAttribute('data-lazy-src');
          if (src && !el.getAttribute('src')) el.setAttribute('src', src);
          const srcset = el.getAttribute('data-srcset');
          if (srcset && !el.getAttribute('srcset')) el.setAttribute('srcset', srcset);
        });
    }).catch(() => {});
  }

  // scroll to bottom then top to flush IntersectionObserver-driven lazy content
  await page.evaluate(async () => {
    const step = Math.max(window.innerHeight, 400);
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let y = 0; y <= document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await sleep(60);
    }
    window.scrollTo(0, document.body.scrollHeight);
    await sleep(150);
    window.scrollTo(0, 0);
  }).catch(() => {});

  // carousels: first slide, autoplay off
  if (freeze.carousels === 'first-slide' || freeze.carousels === undefined) {
    await page.evaluate(() => {
      document.querySelectorAll('.swiper').forEach((el) => {
        const sw = el.swiper;
        if (sw) {
          try { sw.autoplay && sw.autoplay.stop(); sw.slideTo(0, 0, false); } catch {}
        }
      });
      const jq = window.jQuery;
      if (jq && jq.fn && jq.fn.slick) {
        try {
          jq('.slick-slider').slick('slickPause');
          jq('.slick-slider').slick('slickGoTo', 0, true);
        } catch {}
      }
    }).catch(() => {});
  }

  // remove mode:"remove" mask selectors page-side (consent backstop etc.)
  const removeSelectors = (maskRules.mask_selectors || [])
    .filter((r) => r.mode === 'remove')
    .map((r) => r.selector);
  await page.evaluate((sels) => {
    for (const sel of sels) {
      try { document.querySelectorAll(sel).forEach((n) => n.remove()); } catch {}
    }
  }, removeSelectors).catch(() => {});

  // settle: fonts + a beat for layout
  await page.evaluate(() => (document.fonts ? document.fonts.ready.then(() => undefined) : undefined)).catch(() => {});
  await page.waitForTimeout(300);
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
}

// ---------------------------------------------------------------------------
// maskRegions — document-relative bounding boxes to black out on screenshots.
// mode "pixel" selectors plus (backstop) "remove"/"text" selectors — removed
// nodes simply yield no boxes.
// ---------------------------------------------------------------------------

export async function maskRegions(page, maskRules = {}) {
  const selectors = (maskRules.mask_selectors || [])
    .filter((r) => r.mode === 'pixel' || r.mode === 'remove' || r.mode === 'text')
    .map((r) => r.selector);
  if (selectors.length === 0) return [];
  return page.evaluate((sels) => {
    const out = [];
    for (const sel of sels) {
      let nodes = [];
      try { nodes = Array.from(document.querySelectorAll(sel)); } catch { continue; }
      for (const n of nodes) {
        const r = n.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        out.push({
          selector: sel,
          x: Math.max(0, Math.round(r.left + window.scrollX)),
          y: Math.max(0, Math.round(r.top + window.scrollY)),
          width: Math.ceil(r.width),
          height: Math.ceil(r.height),
        });
      }
    }
    return out;
  }, selectors);
}
