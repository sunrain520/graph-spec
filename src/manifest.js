const fs = require('node:fs');
const path = require('node:path');
const { detect } = require('./detect');
const { fileHash } = require('./cache');
const { getRuntimePath } = require('./paths');

function loadManifest(root = '.') {
  const manifestPath = getRuntimePath(root, 'manifest.json');
  if (!fs.existsSync(manifestPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    return null;
  }
}

function saveManifest(files, root) {
  const manifestPath = getRuntimePath(root, 'manifest.json');
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  const payload = {
    generated_at: new Date().toISOString(),
    files,
  };
  fs.writeFileSync(manifestPath, JSON.stringify(payload, null, 2), 'utf8');
  return manifestPath;
}

function detectIncremental(root, options = {}) {
  const current = detect(root, options);
  const manifest = loadManifest(root) || { files: [] };
  const previous = new Map((manifest.files || []).map((item) => [item.path, item.hash]));
  const files = current.files.map((entry) => {
    const hash = fileHash(entry.path);
    return {
      path: entry.path,
      hash,
      type: entry.type,
      words: entry.words,
      changed: previous.get(entry.path) !== hash,
    };
  });
  const removed = Array.from(previous.keys()).filter((filePath) => !files.some((entry) => entry.path === filePath));
  return {
    ...current,
    files,
    removed,
  };
}

module.exports = {
  detectIncremental,
  loadManifest,
  saveManifest,
};
