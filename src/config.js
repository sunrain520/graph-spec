const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_OUT_DIR = 'graphify-out';
const CONFIG_FILE = '.graphify_config.json';

function loadConfig(targetRoot) {
  const root = path.resolve(targetRoot || '.');
  const file = path.join(root, CONFIG_FILE);

  if (!fs.existsSync(file)) {
    return {};
  }

  try {
    const raw = fs.readFileSync(file, 'utf8');
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : {};
  } catch (error) {
    process.stderr.write(`[graph-spec] Warning: failed to read ${CONFIG_FILE}: ${error.message}\n`);
    return {};
  }
}

function resolveOutputDir(targetRoot, outDir) {
  const root = path.resolve(targetRoot || '.');
  const config = outDir == null ? loadConfig(root) : {};
  const configured = outDir == null ? config.out_dir : outDir;
  const resolved = configured || DEFAULT_OUT_DIR;
  return path.isAbsolute(resolved) ? path.resolve(resolved) : path.resolve(root, resolved);
}

module.exports = {
  CONFIG_FILE,
  DEFAULT_OUT_DIR,
  loadConfig,
  resolveOutputDir,
};

