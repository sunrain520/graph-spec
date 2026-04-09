const fs = require('node:fs');
const path = require('node:path');
const { resolveOutputDir } = require('./config');

const CODE_EXTENSIONS = new Set([
  '.py', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.go', '.rs', '.java', '.c', '.cc', '.cpp', '.cxx', '.h', '.hpp',
  '.rb', '.swift', '.kt', '.kts', '.cs', '.scala', '.php', '.lua',
  '.zig', '.ps1', '.ex', '.exs', '.m', '.mm', '.jl',
]);
const DOC_EXTENSIONS = new Set(['.md', '.txt', '.rst']);
const PAPER_EXTENSIONS = new Set(['.pdf']);
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);
const OFFICE_EXTENSIONS = new Set(['.docx', '.xlsx']);
const SENSITIVE_RE = [
  /(^|[\\/])\.(env|envrc)(\.|$)/i,
  /\.(pem|key|p12|pfx|cert|crt|der|p8)$/i,
  /(credential|secret|passwd|password|token|private_key)/i,
  /(id_rsa|id_dsa|id_ecdsa|id_ed25519)(\.pub)?$/i,
  /(\.netrc|\.pgpass|\.htpasswd)$/i,
  /(aws_credentials|gcloud_credentials|service.account)/i,
];
const PAPER_SIGNALS = [
  /\barxiv\b/i,
  /\bdoi\s*:/i,
  /\babstract\b/i,
  /\bproceedings\b/i,
  /\bjournal\b/i,
  /\bpreprint\b/i,
  /\\cite\{/,
  /\[\d+\]/,
  /\[\n\d+\n\]/,
  /eq\.\s*\d+|equation\s+\d+/i,
  /\d{4}\.\d{4,5}/,
  /\bwe propose\b/i,
  /\bliterature\b/i,
];

function isSensitive(filePath) {
  const name = path.basename(filePath);
  const full = String(filePath);
  return SENSITIVE_RE.some((pattern) => pattern.test(name) || pattern.test(full));
}

function looksLikePaper(filePath) {
  try {
    const text = fs.readFileSync(filePath, 'utf8').slice(0, 3000);
    const hits = PAPER_SIGNALS.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);
    return hits >= 3;
  } catch {
    return false;
  }
}

function classifyFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (CODE_EXTENSIONS.has(ext)) return 'code';
  if (PAPER_EXTENSIONS.has(ext)) return 'paper';
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  if (DOC_EXTENSIONS.has(ext)) return looksLikePaper(filePath) ? 'paper' : 'document';
  if (OFFICE_EXTENSIONS.has(ext)) return 'document';
  return null;
}

function countWords(filePath) {
  try {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.pdf') {
      return 0;
    }
    return fs.readFileSync(filePath, 'utf8').split(/\s+/).filter(Boolean).length;
  } catch {
    return 0;
  }
}

function readIgnorePatterns(root) {
  const patterns = [];
  for (const name of ['.graphspecignore', '.graphifyignore']) {
    const file = path.join(root, name);
    if (!fs.existsSync(file)) continue;
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      patterns.push(trimmed);
    }
  }
  return patterns;
}

function matchesPattern(relativePath, pattern) {
  const normalized = relativePath.split(path.sep).join('/');
  const clean = pattern.replace(/\\/g, '/');
  if (clean.endsWith('/')) {
    return normalized === clean.slice(0, -1) || normalized.startsWith(clean);
  }
  if (clean.includes('*')) {
    const escaped = clean
      .split('*')
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('.*');
    return new RegExp(`^${escaped}$`).test(normalized);
  }
  return normalized === clean || normalized.endsWith(`/${clean}`) || path.basename(normalized) === clean;
}

function isIgnored(filePath, root, patterns) {
  const relative = path.relative(root, filePath);
  if (!relative || relative.startsWith('..')) return false;
  return patterns.some((pattern) => matchesPattern(relative, pattern));
}

function collectFiles(root, options = {}) {
  const followSymlinks = Boolean(options.followSymlinks);
  const patterns = readIgnorePatterns(root);
  const results = [];

  function walk(current) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === '.' || entry.name === '..') continue;
      if (entry.isSymbolicLink() && !followSymlinks) continue;
      const full = path.join(current, entry.name);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        walk(full);
        continue;
      }
      if (!stat.isFile()) continue;
      if (isSensitive(full)) continue;
      if (isIgnored(full, root, patterns)) continue;
      const type = classifyFile(full);
      if (!type) continue;
      results.push(path.resolve(full));
    }
  }

  walk(path.resolve(root));
  results.sort();
  return results;
}

function detect(root, options = {}) {
  const resolvedRoot = path.resolve(root || '.');
  const outDir = resolveOutputDir(resolvedRoot, options.outDir);
  const convertedDir = path.join(outDir, 'converted');
  const cacheDir = path.join(outDir, 'cache');
  const manifestPath = path.join(outDir, 'manifest.json');
  const files = collectFiles(resolvedRoot, options);
  const classified = files.map((file) => ({
    path: file,
    type: classifyFile(file),
    words: countWords(file),
  }));
  const totalWords = classified.reduce((sum, entry) => sum + entry.words, 0);

  return {
    root: resolvedRoot,
    outDir,
    convertedDir,
    cacheDir,
    manifestPath,
    files: classified,
    totalWords,
  };
}

module.exports = {
  CODE_EXTENSIONS,
  DOC_EXTENSIONS,
  PAPER_EXTENSIONS,
  IMAGE_EXTENSIONS,
  OFFICE_EXTENSIONS,
  classifyFile,
  collectFiles,
  countWords,
  detect,
  isSensitive,
  looksLikePaper,
  readIgnorePatterns,
};
