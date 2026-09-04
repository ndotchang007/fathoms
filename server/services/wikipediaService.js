const USER_AGENT = 'Fathoms/1.0 (https://localhost; educational research reader)';
const API = 'https://en.wikipedia.org/w/api.php';

const ALLOWED_TAGS = new Set([
  'p', 'br', 'hr',
  'h1', 'h2', 'h3', 'h4',
  'ul', 'ol', 'li',
  'b', 'strong', 'i', 'em', 'u', 's', 'sub', 'sup', 'small',
  'blockquote', 'pre', 'code',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption',
  'figure', 'figcaption', 'img', 'span', 'div', 'a', 'abbr', 'dl', 'dt', 'dd',
]);

const VOID_TAGS = new Set(['br', 'hr', 'img']);

const STRIP_SECTIONS = /^(references|external links|see also|notes|further reading|bibliography|citations|sources|footnotes)$/i;

async function wikiFetch(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const err = new Error(`Wikipedia request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

function apiUrl(params) {
  const q = new URLSearchParams({ format: 'json', origin: '*', ...params });
  return `${API}?${q}`;
}

async function searchPages(query, limit = 1) {
  const data = await wikiFetch(apiUrl({
    action: 'query',
    list: 'search',
    srsearch: query,
    srlimit: String(limit),
    srnamespace: '0',
  }));
  return (data.query?.search || []).map((row) => row.title);
}

async function resolveTitle(query, context = '') {
  const trimmed = String(query || '').trim();
  if (!trimmed) return null;

  const direct = await wikiFetch(apiUrl({
    action: 'query',
    titles: trimmed,
    redirects: '1',
  }));
  const pages = Object.values(direct.query?.pages || {});
  if (pages[0] && pages[0].pageid && !pages[0].missing) {
    return pages[0].title;
  }

  const hint = String(context || '').trim();
  const searchQuery = hint && !trimmed.toLowerCase().includes(hint.toLowerCase())
    ? `${trimmed} ${hint}`
    : trimmed;
  const hits = await searchPages(searchQuery, 1);
  return hits[0] || null;
}

function decodeEntities(str) {
  return String(str)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function absWikiUrl(src) {
  if (!src) return '';
  let url = decodeEntities(src).trim();
  if (url.startsWith('//')) url = `https:${url}`;
  if (url.startsWith('/')) url = `https://en.wikipedia.org${url}`;
  return url;
}

function isSafeUrl(url) {
  return /^https?:\/\//i.test(url) || url.startsWith('/');
}

function sanitizeAttributes(tag, attrs) {
  const out = [];
  const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let m;
  while ((m = attrRe.exec(attrs))) {
    const name = m[1].toLowerCase();
    const value = m[3] ?? m[4] ?? m[5] ?? '';
    if (name.startsWith('on') || name === 'style' || name === 'srcset') continue;

    if (tag === 'img' && name === 'src') {
      const abs = absWikiUrl(value);
      if (!isSafeUrl(abs) || !/^https:\/\/upload\.wikimedia\.org\//i.test(abs)) continue;
      out.push(`src="${abs}"`);
      out.push('loading="lazy"');
      out.push('decoding="async"');
      continue;
    }

    if (tag === 'img' && (name === 'alt' || name === 'width' || name === 'height')) {
      out.push(`${name}="${value.replace(/"/g, '&quot;')}"`);
      continue;
    }

    if (tag === 'a' && name === 'href') {
      const abs = absWikiUrl(value);
      if (!isSafeUrl(abs)) continue;
      // Keep wiki links as data attrs for in-app navigation; drop external noise.
      if (/wikipedia\.org\/wiki\//i.test(abs)) {
        const title = decodeURIComponent(abs.split('/wiki/')[1] || '').replace(/_/g, ' ');
        if (title && !title.includes(':')) {
          out.push(`href="#"`);
          out.push(`data-wiki-title="${title.replace(/"/g, '&quot;')}"`);
          out.push('class="article-wiki-link"');
        }
      }
      continue;
    }

    if (name === 'class' && /(?:^|\s)(?:thumb|infobox|navbox|reference|mw-editsection|hatnote|shortdescription)/i.test(value)) {
      out.push(`class="${value.replace(/"/g, '&quot;')}"`);
    }
  }
  return out.join(' ');
}

function shouldDropClass(className = '') {
  return /(?:^|\s)(?:navbox|vertical-navbox|infobox|metadata|navbox-styles|reference|mw-editsection|noprint|sistersitebox|portal|ambox|tmbox|ombox|cmbox|fmbox|imbox|mmbox|side-box|toc|mw-empty-elt|hatnote|shortdescription)/i.test(className);
}

function sanitizeWikiHtml(rawHtml) {
  let html = String(rawHtml || '');

  // Drop noisy blocks early.
  html = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<link\b[^>]*>/gi, '')
    .replace(/<meta\b[^>]*>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<math[\s\S]*?<\/math>/gi, '')
    .replace(/<span[^>]*class="[^"]*mw-editsection[^"]*"[\s\S]*?<\/span>/gi, '')
    .replace(/<div[^>]*role="navigation"[^>]*>[\s\S]*?<\/div>/gi, '');

  const tokens = html.split(/(<[^>]+>)/g);
  const out = [];
  const stack = [];
  let skipDepth = 0;
  let sectionCount = 0;
  const maxSections = 8;

  for (const token of tokens) {
    if (!token) continue;

    if (token[0] !== '<') {
      if (skipDepth === 0) out.push(token);
      continue;
    }

    const close = /^<\/\s*([a-z0-9]+)/i.exec(token);
    if (close) {
      const tag = close[1].toLowerCase();
      if (skipDepth > 0) {
        if (stack.length && stack[stack.length - 1] === tag) {
          stack.pop();
          skipDepth--;
        }
        continue;
      }
      if (stack.length && stack[stack.length - 1] === tag) {
        stack.pop();
        out.push(`</${tag}>`);
      }
      continue;
    }

    const selfClosing = /^<\s*([a-z0-9]+)([^>]*)\/\s*>$/i.exec(token);
    const open = selfClosing || /^<\s*([a-z0-9]+)([^>]*)>/i.exec(token);
    if (!open) continue;

    const tag = open[1].toLowerCase();
    const attrs = open[2] || '';
    const classMatch = /\bclass\s*=\s*("([^"]*)"|'([^']*)')/i.exec(attrs);
    const className = classMatch ? (classMatch[2] || classMatch[3] || '') : '';

    if (skipDepth > 0) {
      if (!VOID_TAGS.has(tag) && !selfClosing) {
        stack.push(tag);
        skipDepth++;
      }
      continue;
    }

    if (!ALLOWED_TAGS.has(tag) || shouldDropClass(className)) {
      if (!VOID_TAGS.has(tag) && !selfClosing) {
        stack.push(tag);
        skipDepth = 1;
      }
      continue;
    }

    if (tag === 'h2' || tag === 'h3') {
      sectionCount += 1;
      if (sectionCount > maxSections) {
        break;
      }
    }

    // Skip reference superscripts.
    if (tag === 'sup' && /reference|mw-ref/i.test(className)) {
      if (!selfClosing) {
        stack.push(tag);
        skipDepth = 1;
      }
      continue;
    }

    const safeAttrs = sanitizeAttributes(tag, attrs);
    if (VOID_TAGS.has(tag) || selfClosing) {
      out.push(safeAttrs ? `<${tag} ${safeAttrs}>` : `<${tag}>`);
      continue;
    }

    stack.push(tag);
    out.push(safeAttrs ? `<${tag} ${safeAttrs}>` : `<${tag}>`);
  }

  while (stack.length) {
    out.push(`</${stack.pop()}>`);
  }

  // Remove empty headings / leftover reference lists and strip section titles we don't want.
  let cleaned = out.join('');
  cleaned = cleaned.replace(/<h2[^>]*>[\s\S]*?<\/h2>/gi, (block) => {
    const text = block.replace(/<[^>]+>/g, '').replace(/\[\s*edit\s*\]/gi, '').trim();
    if (STRIP_SECTIONS.test(text)) return '';
    return block;
  });

  // Cap overall length for a research skim.
  if (cleaned.length > 60000) {
    cleaned = `${cleaned.slice(0, 60000)}…`;
  }

  return cleaned.trim();
}

function extractLeadImage(html) {
  const match = /<img[^>]+src="(https:\/\/upload\.wikimedia\.org\/[^"]+)"/i.exec(html);
  return match ? match[1] : null;
}

async function fetchArticle(query, context = '') {
  const title = await resolveTitle(query, context);
  if (!title) {
    const err = new Error('No encyclopedia article found for that query');
    err.status = 404;
    throw err;
  }

  const data = await wikiFetch(apiUrl({
    action: 'parse',
    page: title,
    prop: 'text|displaytitle',
    redirects: '1',
    disableeditsection: '1',
  }));

  const parse = data.parse;
  if (!parse?.text?.['*']) {
    const err = new Error('Article content unavailable');
    err.status = 404;
    throw err;
  }

  const html = sanitizeWikiHtml(parse.text['*']);
  const pageUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;

  return {
    title: parse.title || title,
    displayTitle: String(parse.displaytitle || parse.title || title).replace(/<[^>]+>/g, ''),
    html,
    leadImage: extractLeadImage(html),
    url: pageUrl,
    attribution: 'Adapted from Wikipedia, available under CC BY-SA 4.0.',
    site: 'Wikipedia',
  };
}

module.exports = {
  fetchArticle,
  searchPages,
  resolveTitle,
};
