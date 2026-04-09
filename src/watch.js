const fs = require('node:fs');
const path = require('node:path');
const chokidar = require('chokidar');
const { runPipeline } = require('./pipeline');
const { detect } = require('./detect');
const { getProjectStateDir } = require('./paths');
const { resolveOutputDir } = require('./config');

function _rebuildCode(watchPath, options = {}) {
  const result = runPipeline(watchPath, options);
  return {
    ok: true,
    outDir: result.outDir,
    graphPath: result.outputs.graphJson,
    reportPath: result.outputs.reportPath,
    files: result.detected.files.length,
  };
}

function _notifyOnly(watchPath) {
  const detected = detect(watchPath);
  process.stdout.write(`graph-spec: ${detected.files.length} file(s) detected\n`);
}

function _hasNonCode(changedPaths) {
  return changedPaths.some((item) => !item.endsWith('.py') && !item.endsWith('.js') && !item.endsWith('.ts') && !item.endsWith('.go') && !item.endsWith('.rs'));
}

function watch(watchPath, debounce = 3.0, options = {}) {
  const root = path.resolve(watchPath || '.');
  const stateDir = getProjectStateDir(root);
  const outDir = resolveOutputDir(root, options.outDir);
  const configPath = path.resolve(path.join(root, '.graphify_config.json'));

  let timer = null;
  const watcher = chokidar.watch(root, {
    ignored: (filePath) => {
      const resolved = path.resolve(filePath);
      if (resolved === configPath) return false;
      if (resolved === stateDir || resolved.startsWith(stateDir + path.sep)) return true;
      if (resolved === outDir || resolved.startsWith(outDir + path.sep)) return true;
      return /(^|[\\/])\./.test(path.basename(filePath));
    },
    ignoreInitial: true,
  });

  const trigger = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      _rebuildCode(root, options);
    }, Math.max(1, debounce) * 1000);
  };

  watcher.on('add', trigger).on('change', trigger).on('unlink', trigger).on('addDir', trigger).on('unlinkDir', trigger);
  return watcher;
}

module.exports = {
  _hasNonCode,
  _notifyOnly,
  _rebuildCode,
  watch,
};

