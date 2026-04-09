const fs = require('node:fs');
const path = require('node:path');
const { validateUrl } = require('./security');
const { getRuntimePath } = require('./paths');

function yamlString(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, ' ')
    .trim();
}

function safeFilename(url, suffix) {
  const parsed = new URL(url);
  const base = `${parsed.hostname}${parsed.pathname}`.replace(/[^\w.-]+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  return `${base.slice(0, 80) || 'ingest'}${suffix}`;
}

function detectUrlType(url) {
  const lower = String(url).toLowerCase();
  if (lower.includes('twitter.com') || lower.includes('x.com')) return 'tweet';
  if (lower.includes('arxiv.org')) return 'arxiv';
  const parsed = new URL(url);
  const pathname = parsed.pathname.toLowerCase();
  if (pathname.endsWith('.pdf')) return 'pdf';
  if (pathname.match(/\.(png|jpg|jpeg|gif|webp)$/)) return 'image';
  return 'webpage';
}

async function fetchText(url) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`request failed with status ${response.status}`);
  }
  return response.text();
}

async function fetchBinary(url) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`request failed with status ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer);
}

function htmlToMarkdown(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<h[1-6][^>]*>/gi, '\n# ')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

async function fetchWebpage(url, options = {}) {
  const html = await fetchText(url);
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : url;
  const body = htmlToMarkdown(html).slice(0, options.maxBodyChars || 12000);
  const now = new Date().toISOString();
  const content = [
    '---',
    `source_url: "${yamlString(url)}"`,
    'type: "webpage"',
    `title: "${yamlString(title)}"`,
    `captured_at: "${now}"`,
    `contributor: "${yamlString(options.contributor || options.author || 'unknown')}"`,
    '---',
    '',
    `# ${title}`,
    '',
    `Source: ${url}`,
    '',
    '---',
    '',
    body,
    '',
  ].join('\n');
  return { content, filename: safeFilename(url, '.md'), type: 'webpage' };
}

async function fetchTweet(url, options = {}) {
  const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(url.replace('x.com', 'twitter.com'))}&omit_script=true`;
  let author = 'unknown';
  let text = `Tweet at ${url}`;
  try {
    const payload = JSON.parse(await fetchText(oembedUrl));
    author = payload.author_name || author;
    text = htmlToMarkdown(payload.html || text);
  } catch {
    // Fallback to URL stub.
  }
  const now = new Date().toISOString();
  const content = [
    '---',
    `source_url: "${yamlString(url)}"`,
    'type: "tweet"',
    `author: "${yamlString(author)}"`,
    `captured_at: "${now}"`,
    `contributor: "${yamlString(options.contributor || options.author || 'unknown')}"`,
    '---',
    '',
    `# Tweet by @${author}`,
    '',
    text,
    '',
    `Source: ${url}`,
    '',
  ].join('\n');
  return { content, filename: safeFilename(url, '.md'), type: 'tweet' };
}

async function fetchArxiv(url, options = {}) {
  const match = String(url).match(/(\d{4}\.\d{4,5})/);
  if (!match) {
    return fetchWebpage(url, options);
  }
  const paperId = match[1];
  const apiUrl = `https://export.arxiv.org/abs/${paperId}`;
  let title = paperId;
  let authors = '';
  let abstract = '';
  try {
    const html = await fetchText(apiUrl);
    const titleMatch = html.match(/class="title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i);
    const authorsMatch = html.match(/class="authors"[^>]*>([\s\S]*?)<\/div>/i);
    const abstractMatch = html.match(/class="abstract[^"]*"[^>]*>([\s\S]*?)<\/blockquote>/i);
    if (titleMatch) title = titleMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (authorsMatch) authors = authorsMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (abstractMatch) abstract = abstractMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  } catch {
    // Keep fallback metadata.
  }
  const now = new Date().toISOString();
  const content = [
    '---',
    `source_url: "${yamlString(url)}"`,
    `arxiv_id: "${paperId}"`,
    'type: "paper"',
    `title: "${yamlString(title)}"`,
    `paper_authors: "${yamlString(authors)}"`,
    `captured_at: "${now}"`,
    `contributor: "${yamlString(options.contributor || options.author || 'unknown')}"`,
    '---',
    '',
    `# ${title}`,
    '',
    `**Authors:** ${authors}`,
    `**arXiv:** ${paperId}`,
    '',
    '## Abstract',
    '',
    abstract,
    '',
    `Source: ${url}`,
    '',
  ].join('\n');
  return { content, filename: `arxiv_${paperId.replace('.', '_')}.md`, type: 'paper' };
}

async function ingestUrl(url, root = '.', options = {}) {
  const normalized = validateUrl(url);
  const dir = getRuntimePath(path.resolve(root), 'ingest');
  fs.mkdirSync(dir, { recursive: true });
  const type = detectUrlType(normalized);
  let result;

  if (type === 'pdf') {
    const filename = safeFilename(normalized, '.pdf');
    const outPath = path.join(dir, filename);
    fs.writeFileSync(outPath, await fetchBinary(normalized));
    return { outPath, type, url: normalized };
  }

  if (type === 'image') {
    const suffix = path.extname(new URL(normalized).pathname) || '.jpg';
    const filename = safeFilename(normalized, suffix);
    const outPath = path.join(dir, filename);
    fs.writeFileSync(outPath, await fetchBinary(normalized));
    return { outPath, type, url: normalized };
  }

  if (type === 'tweet') {
    result = await fetchTweet(normalized, options);
  } else if (type === 'arxiv') {
    result = await fetchArxiv(normalized, options);
  } else {
    result = await fetchWebpage(normalized, options);
  }

  let outPath = path.join(dir, result.filename);
  let counter = 1;
  while (fs.existsSync(outPath)) {
    const ext = path.extname(result.filename);
    const stem = path.basename(result.filename, ext);
    outPath = path.join(dir, `${stem}_${counter}${ext}`);
    counter += 1;
  }
  fs.writeFileSync(outPath, result.content, 'utf8');
  return { outPath, type: result.type, url: normalized };
}

function saveQueryResult(question, answer, memoryDir, options = {}) {
  const dir = path.resolve(memoryDir);
  fs.mkdirSync(dir, { recursive: true });
  const now = new Date();
  const slug = String(question).toLowerCase().replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 50) || 'query';
  const filename = `query_${now.toISOString().replace(/[-:]/g, '').replace(/\..+/, '')}_${slug}.md`;
  const lines = [
    '---',
    `type: "${yamlString(options.queryType || 'query')}"`,
    `date: "${now.toISOString()}"`,
    `question: "${yamlString(question)}"`,
    'contributor: "graph-spec"',
    '---',
    '',
    `# ${question}`,
    '',
    answer,
    '',
  ];
  if (options.sourceNodes && options.sourceNodes.length > 0) {
    lines.splice(5, 0, `source_nodes: [${options.sourceNodes.slice(0, 10).map((item) => `"${yamlString(item)}"`).join(', ')}]`);
  }
  const outPath = path.join(dir, filename);
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  return outPath;
}

module.exports = {
  detectUrlType,
  fetchArxiv,
  fetchBinary,
  fetchText,
  fetchTweet,
  fetchWebpage,
  htmlToMarkdown,
  ingestUrl,
  safeFilename,
  saveQueryResult,
  yamlString,
};
