const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { resolveOutputDir } = require('./config');

function fileHash(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function cacheDir(root = '.', outDir = null) {
  return path.join(resolveOutputDir(root, outDir), 'cache');
}

function cachePathFor(filePath, root = '.', outDir = null) {
  return path.join(cacheDir(root, outDir), `${fileHash(filePath)}.json`);
}

function loadCached(filePath, root = '.', outDir = null) {
  const file = cachePathFor(filePath, root, outDir);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveCached(filePath, result, root = '.', outDir = null) {
  const dir = cacheDir(root, outDir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(cachePathFor(filePath, root, outDir), JSON.stringify(result, null, 2), 'utf8');
}

function cachedFiles(root = '.', outDir = null) {
  const dir = cacheDir(root, outDir);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((file) => file.endsWith('.json'));
}

function clearCache(root = '.', outDir = null) {
  const dir = cacheDir(root, outDir);
  fs.rmSync(dir, { recursive: true, force: true });
}

function checkSemanticCache(filePaths, root = '.', outDir = null) {
  const cached = [];
  const uncached = [];
  for (const filePath of filePaths) {
    if (loadCached(filePath, root, outDir)) cached.push(filePath);
    else uncached.push(filePath);
  }
  return { cached, uncached };
}

function saveSemanticCache(extractions, root = '.', outDir = null) {
  for (const extraction of extractions) {
    if (!extraction || !extraction.meta || !extraction.meta.source_file) continue;
    saveCached(extraction.meta.source_file, extraction, root, outDir);
  }
}

module.exports = {
  cacheDir,
  cachePathFor,
  cachedFiles,
  checkSemanticCache,
  clearCache,
  fileHash,
  loadCached,
  saveCached,
  saveSemanticCache,
};
