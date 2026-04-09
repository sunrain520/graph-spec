const fs = require('node:fs');
const path = require('node:path');

function sanitizeLabel(text) {
  return String(text || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 256);
}

function validateUrl(url) {
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`unsupported url protocol: ${parsed.protocol}`);
  }
  return parsed.toString();
}

function validateGraphPath(graphPath, base = path.resolve('graphify-out')) {
  const resolvedBase = path.resolve(base);
  const resolved = path.resolve(graphPath);
  if (!resolved.startsWith(resolvedBase)) {
    throw new Error(`graph path must live under ${resolvedBase}`);
  }
  if (!fs.existsSync(resolved)) {
    throw new Error(`graph file not found: ${resolved}`);
  }
  return resolved;
}

module.exports = {
  sanitizeLabel,
  validateGraphPath,
  validateUrl,
};

