// site-migrate :: lib/extract-markdown — tolerant HTML parser + HTML→MDX-safe
// markdown converter. No deps. Used by extract.mjs only.

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const RAWTEXT = new Set(['script', 'style', 'noscript', 'textarea']);
const BLOCK = new Set(['address', 'article', 'aside', 'blockquote', 'div', 'dl', 'dd', 'dt', 'fieldset', 'figure', 'figcaption', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'li', 'main', 'nav', 'ol', 'p', 'pre', 'section', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'ul', 'video', 'iframe', 'picture']);

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…',
  mdash: '—', ndash: '–', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  copy: '©', reg: '®', trade: '™', deg: '°', laquo: '«', raquo: '»', times: '×',
  middot: '·', bull: '•', shy: '', zwnj: '', zwj: '', eacute: 'é', egrave: 'è',
};

export function decodeEntities(s) {
  return String(s).replace(/&(#[xX]?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (m, e) => {
    if (e[0] === '#') {
      const cp = /^#[xX]/.test(e) ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      try { return Number.isFinite(cp) ? String.fromCodePoint(cp) : m; } catch { return m; }
    }
    const k = e.toLowerCase();
    return Object.prototype.hasOwnProperty.call(ENTITIES, k) ? ENTITIES[k] : m;
  });
}

function parseAttrs(s) {
  const attrs = {};
  if (!s) return attrs;
  const re = /([\w:.-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m;
  while ((m = re.exec(s))) {
    attrs[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return attrs;
}

// Tolerant parser → tree of {type:'el',tag,attrs,children} / {type:'text',text}
export function parseHTML(html) {
  const root = { type: 'el', tag: '#root', attrs: {}, children: [] };
  const stack = [root];
  const top = () => stack[stack.length - 1];
  const addText = (t) => { if (t) top().children.push({ type: 'text', text: t }); };
  const tagRe = /<!--[\s\S]*?-->|<!\[[\s\S]*?\]>|<![^>]*>|<\/\s*([a-zA-Z][\w:-]*)\s*>|<([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)(\/?)>/g;
  let last = 0, m;

  const closeTo = (tag) => {
    for (let i = stack.length - 1; i >= 1; i--) {
      if (stack[i].tag === tag) { stack.length = i; return true; }
    }
    return false;
  };

  while ((m = tagRe.exec(html))) {
    if (m.index > last) addText(html.slice(last, m.index));
    last = tagRe.lastIndex;
    if (m[1]) { closeTo(m[1].toLowerCase()); continue; }
    if (!m[2]) continue; // comment/doctype
    const tag = m[2].toLowerCase();
    // implicit closes
    if (top().tag === 'p' && BLOCK.has(tag) && tag !== 'p') closeTo('p');
    if (tag === 'p' && top().tag === 'p') closeTo('p');
    if (tag === 'li' && (top().tag === 'li')) closeTo('li');
    if ((tag === 'td' || tag === 'th') && (top().tag === 'td' || top().tag === 'th')) stack.length -= 1;
    if (tag === 'tr') { while (['td', 'th', 'tr'].includes(top().tag)) stack.length -= 1; }
    const node = { type: 'el', tag, attrs: parseAttrs(m[3]), children: [] };
    top().children.push(node);
    const selfClosed = !!m[4] || VOID.has(tag);
    if (!selfClosed) {
      if (RAWTEXT.has(tag)) {
        const rest = html.slice(last);
        const ci = rest.search(new RegExp(`</${tag}\\s*>`, 'i'));
        if (ci === -1) { last = html.length; tagRe.lastIndex = last; }
        else {
          node.children.push({ type: 'text', text: rest.slice(0, ci) });
          const closeLen = rest.slice(ci).match(new RegExp(`</${tag}\\s*>`, 'i'))[0].length;
          last += ci + closeLen;
          tagRe.lastIndex = last;
        }
      } else {
        stack.push(node);
      }
    }
  }
  if (last < html.length) addText(html.slice(last));
  return root;
}

export function find(node, pred) {
  if (node.type === 'el' && node.tag !== '#root' && pred(node)) return node;
  if (node.children) for (const c of node.children) {
    if (c.type !== 'el') continue;
    const r = find(c, pred);
    if (r) return r;
  }
  return null;
}

export function findAll(node, pred, out = []) {
  if (node.type === 'el' && node.tag !== '#root' && pred(node)) out.push(node);
  if (node.children) for (const c of node.children) if (c.type === 'el') findAll(c, pred, out);
  return out;
}

export function textOf(node) {
  if (node.type === 'text') return decodeEntities(node.text);
  if (!node.children) return '';
  return node.children.map(textOf).join('');
}

function removeAll(node, pred) {
  if (!node.children) return;
  node.children = node.children.filter((c) => !(c.type === 'el' && pred(c)));
  for (const c of node.children) if (c.type === 'el') removeAll(c, pred);
}

const NOISE = new Set(['script', 'style', 'noscript', 'template', 'link', 'meta', 'header', 'nav', 'footer', 'aside']);

// Main-content heuristic for full-page HTML: main > [role=main] > article >
// dominant text block under body.
export function extractMainContent(root) {
  removeAll(root, (n) => NOISE.has(n.tag));
  const main =
    find(root, (n) => n.tag === 'main') ||
    find(root, (n) => n.attrs?.role === 'main') ||
    find(root, (n) => n.tag === 'article');
  if (main) return main;
  let cur = find(root, (n) => n.tag === 'body') || root;
  for (let depth = 0; depth < 50; depth++) {
    const total = textOf(cur).replace(/\s+/g, ' ').length || 1;
    const kids = cur.children.filter((c) => c.type === 'el');
    const dominant = kids.find((k) => textOf(k).replace(/\s+/g, ' ').length / total >= 0.8);
    if (!dominant) break;
    cur = dominant;
  }
  return cur;
}

// ---- markdown rendering ----------------------------------------------------

const THIRD_PARTY_IFRAME = [
  /(^|\.)youtube(-nocookie)?\.com$/i, /(^|\.)youtu\.be$/i,
  /(^|\.)vimeo\.com$/i,
  /(^|\.)google\.[a-z.]+$/i, /(^|\.)maps\.googleapis\.com$/i, /(^|\.)maps\.gstatic\.com$/i,
  /(^|\.)line\.me$/i, /(^|\.)line-scdn\.net$/i,
];

export function isAllowedIframe(src) {
  try {
    const u = new URL(src, 'https://x.invalid/');
    if (u.hostname === 'x.invalid') return false;
    const ok = THIRD_PARTY_IFRAME.some((re) => re.test(u.hostname));
    // google only when it's an embed (maps/calendar)
    if (/google\./i.test(u.hostname)) return /\/maps|\/embed|calendar/i.test(u.pathname + u.search) || /^maps\./i.test(u.hostname);
    return ok;
  } catch { return false; }
}

function escMd(t) {
  return t.replace(/[<{}]/g, (c) => ({ '<': '\\<', '{': '\\{', '}': '\\}' }[c]));
}

function collapse(t) { return t.replace(/\s+/g, ' '); }

export function pickImgSrc(attrs) {
  // largest srcset candidate wins; else src; ignore data: URIs
  const srcset = attrs['srcset'] || attrs['data-srcset'];
  if (srcset) {
    let best = null, bestW = -1;
    for (const part of srcset.split(',')) {
      const [u, d] = part.trim().split(/\s+/);
      if (!u || u.startsWith('data:')) continue;
      const w = d ? parseFloat(d) || 0 : 0;
      if (w > bestW) { bestW = w; best = u; }
    }
    if (best) return best;
  }
  const src = attrs['src'] && !attrs['src'].startsWith('data:') ? attrs['src'] : (attrs['data-src'] || attrs['data-lazy-src'] || '');
  return src && !src.startsWith('data:') ? src : '';
}

// opts: { rewriteUrl(url)->url, addGap(str), baseUrl }
export function toMarkdown(node, opts) {
  const ctx = {
    rewriteUrl: opts.rewriteUrl || ((u) => u),
    addGap: opts.addGap || (() => {}),
  };
  const blocks = renderBlocks(node.children || [], ctx, 0);
  return blocks.filter(Boolean).join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}

const INLINE_TAGS = new Set(['a', 'abbr', 'b', 'bdi', 'bdo', 'br', 'cite', 'code', 'data', 'del', 'dfn', 'em', 'i', 'img', 'ins', 'kbd', 'mark', 'q', 's', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var', 'wbr', 'font', 'label']);

function isInlineNode(n) {
  return n.type === 'text' || INLINE_TAGS.has(n.tag);
}

function renderInline(nodes, ctx) {
  let out = '';
  for (const n of nodes) {
    if (n.type === 'text') { out += escMd(collapse(decodeEntities(n.text))); continue; }
    const kids = n.children || [];
    switch (n.tag) {
      case 'br': out += '<br />'; break;
      case 'img': {
        const src = pickImgSrc(n.attrs);
        if (src) out += `![${collapse(n.attrs.alt || '').replace(/[\[\]]/g, '')}](${ctx.rewriteUrl(src)})`;
        break;
      }
      case 'a': {
        const href = n.attrs.href || '';
        const inner = renderInline(kids, ctx).trim();
        if (!href || href.startsWith('javascript:')) { out += inner; break; }
        out += inner ? `[${inner}](${ctx.rewriteUrl(href)})` : '';
        break;
      }
      case 'strong': case 'b': {
        const inner = renderInline(kids, ctx).trim();
        out += inner ? `**${inner}**` : '';
        break;
      }
      case 'em': case 'i': case 'cite': case 'dfn': {
        const inner = renderInline(kids, ctx).trim();
        out += inner ? `*${inner}*` : '';
        break;
      }
      case 'code': case 'kbd': case 'var': {
        const inner = textOf(n).trim();
        out += inner ? `\`${inner.replace(/`/g, '\\`')}\`` : '';
        break;
      }
      case 'del': case 's': {
        const inner = renderInline(kids, ctx).trim();
        out += inner ? `~~${inner}~~` : '';
        break;
      }
      case 'wbr': break;
      default:
        out += renderInline(kids, ctx);
    }
  }
  return out;
}

function renderBlocks(nodes, ctx, depth) {
  const blocks = [];
  let inlineRun = [];
  const flush = () => {
    if (!inlineRun.length) return;
    const text = renderInline(inlineRun, ctx).trim();
    if (text) blocks.push(text);
    inlineRun = [];
  };
  for (const n of nodes) {
    if (isInlineNode(n)) { inlineRun.push(n); continue; }
    flush();
    const b = renderBlock(n, ctx, depth);
    if (b) blocks.push(b);
  }
  flush();
  return blocks;
}

function renderBlock(n, ctx, depth) {
  const kids = n.children || [];
  switch (n.tag) {
    case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6': {
      const text = renderInline(kids, ctx).trim();
      return text ? `${'#'.repeat(+n.tag[1])} ${text}` : '';
    }
    case 'p': {
      return renderInline(kids, ctx).trim();
    }
    case 'ul': case 'ol':
      return renderList(n, ctx, depth);
    case 'blockquote': {
      const inner = renderBlocks(kids, ctx, depth).join('\n\n');
      return inner ? inner.split('\n').map((l) => `> ${l}`.trimEnd()).join('\n') : '';
    }
    case 'pre': {
      const code = textOf(n).replace(/^\n+|\s+$/g, '');
      return code ? '```\n' + code + '\n```' : '';
    }
    case 'hr': return '---';
    case 'table': return renderTable(n, ctx);
    case 'figure': {
      const parts = [];
      const caption = find(n, (x) => x.tag === 'figcaption');
      const inner = renderBlocks(kids.filter((k) => k !== caption), ctx, depth).join('\n\n');
      if (inner) parts.push(inner);
      if (caption) {
        const ct = renderInline(caption.children || [], ctx).trim();
        if (ct) parts.push(`*${ct}*`);
      }
      return parts.join('\n\n');
    }
    case 'picture': {
      // best source wins; fall back to nested img
      const sources = findAll(n, (x) => x.tag === 'source');
      const img = find(n, (x) => x.tag === 'img');
      let src = '';
      for (const s of sources) { const c = pickImgSrc(s.attrs); if (c) { src = c; break; } }
      if (!src && img) src = pickImgSrc(img.attrs);
      if (!src) return '';
      const alt = collapse(img?.attrs.alt || '').replace(/[\[\]]/g, '');
      return `![${alt}](${ctx.rewriteUrl(src)})`;
    }
    case 'iframe': {
      const src = n.attrs.src || n.attrs['data-src'] || '';
      if (src && isAllowedIframe(src)) {
        const a = [];
        a.push(`src=${JSON.stringify(src)}`);
        if (n.attrs.width) a.push(`width=${JSON.stringify(n.attrs.width)}`);
        if (n.attrs.height) a.push(`height=${JSON.stringify(n.attrs.height)}`);
        if (n.attrs.title) a.push(`title=${JSON.stringify(n.attrs.title)}`);
        if (n.attrs.allow) a.push(`allow=${JSON.stringify(n.attrs.allow)}`);
        if ('allowfullscreen' in n.attrs) a.push('allowFullScreen');
        a.push('loading="lazy"', 'style={{border:0}}');
        return `<iframe ${a.join(' ')} />`;
      }
      ctx.addGap(`iframe:${src || 'unknown-src'}`);
      return '';
    }
    case 'form': {
      ctx.addGap(`form:${n.attrs.action || n.attrs.id || n.attrs.class || 'unknown'}`);
      return '';
    }
    case 'video': {
      const src = n.attrs.src || find(n, (x) => x.tag === 'source')?.attrs.src || '';
      const a = ['controls'];
      if (src) a.push(`src=${JSON.stringify(ctx.rewriteUrl(src))}`);
      if (n.attrs.poster) a.push(`poster=${JSON.stringify(ctx.rewriteUrl(n.attrs.poster))}`);
      return src || n.attrs.poster ? `<video ${a.join(' ')} />` : '';
    }
    case 'dl': {
      const parts = [];
      for (const c of kids) {
        if (c.type !== 'el') continue;
        const text = renderInline(c.children || [], ctx).trim();
        if (!text) continue;
        if (c.tag === 'dt') parts.push(`**${text}**`);
        else if (c.tag === 'dd') parts.push(text);
      }
      return parts.join('\n\n');
    }
    case 'header': case 'nav': case 'footer': case 'aside':
      return ''; // chrome — never content
    case 'object': case 'embed': case 'canvas': case 'audio': {
      ctx.addGap(`widget:${n.tag}${n.attrs.src ? ':' + n.attrs.src : ''}`);
      return '';
    }
    default:
      // div/section/article/main/fieldset/etc — transparent containers
      return renderBlocks(kids, ctx, depth).join('\n\n');
  }
}

function renderList(listEl, ctx, depth) {
  const ordered = listEl.tag === 'ol';
  const items = (listEl.children || []).filter((c) => c.type === 'el' && c.tag === 'li');
  const out = [];
  let i = 0;
  for (const li of items) {
    i += 1;
    const marker = ordered ? `${i}. ` : '- ';
    const indent = ' '.repeat(marker.length);
    const inner = renderBlocks(li.children || [], ctx, depth + 1).join('\n\n');
    const lines = (inner || '').split('\n');
    out.push(marker + (lines[0] || '') + lines.slice(1).map((l) => '\n' + indent + l).join(''));
  }
  return out.join('\n');
}

function renderTable(tableEl, ctx) {
  const rows = findAll(tableEl, (n) => n.tag === 'tr');
  if (!rows.length) return '';
  const cellText = (tr) =>
    (tr.children || [])
      .filter((c) => c.type === 'el' && (c.tag === 'td' || c.tag === 'th'))
      .map((c) => renderInline(c.children || [], ctx).trim().replace(/\|/g, '\\|').replace(/\n/g, ' '));
  const matrix = rows.map(cellText).filter((r) => r.length);
  if (!matrix.length) return '';
  const width = Math.max(...matrix.map((r) => r.length));
  const pad = (r) => { while (r.length < width) r.push(''); return r; };
  const header = pad(matrix[0]);
  const body = matrix.slice(1).map(pad);
  const line = (r) => `| ${r.join(' | ')} |`;
  const sep = `| ${header.map(() => '---').join(' | ')} |`;
  return [line(header), sep, ...body.map(line)].join('\n');
}

// Collect media URLs (img src/srcset, picture sources, video src/poster) from a tree.
export function collectMediaUrls(root) {
  const urls = new Set();
  for (const img of findAll(root, (n) => n.tag === 'img')) {
    const s = pickImgSrc(img.attrs);
    if (s) urls.add(s);
  }
  for (const src of findAll(root, (n) => n.tag === 'source')) {
    const s = pickImgSrc(src.attrs) || src.attrs.src;
    if (s && !s.startsWith('data:')) urls.add(s);
  }
  for (const v of findAll(root, (n) => n.tag === 'video')) {
    if (v.attrs.poster) urls.add(v.attrs.poster);
    if (v.attrs.src && !v.attrs.src.startsWith('data:')) urls.add(v.attrs.src);
  }
  return [...urls];
}

// Detect unrendered WP shortcodes in raw HTML (e.g. [gallery ids="1,2"]).
export function detectShortcodes(html) {
  const known = new Set(['gallery', 'caption', 'embed', 'audio', 'video', 'playlist', 'contact-form-7', 'wpforms', 'gravityform', 'shortcode']);
  const found = new Set();
  const re = /\[([a-z][a-z0-9_-]*)((?:\s+[^\]\n]*)?)\]/g;
  let m;
  while ((m = re.exec(html))) {
    const name = m[1];
    if (known.has(name) || /=/.test(m[2])) found.add(name);
  }
  return [...found];
}
