const path = require('node:path');
const { detect } = require('./detect');
const { build } = require('./build');
const { extract } = require('./extract');
const { cluster } = require('./cluster');
const { exportGraph } = require('./export');
const { loadCached, saveCached, fileHash } = require('./cache');
const { saveManifest } = require('./manifest');
const { resolveOutputDir } = require('./config');

function runPipeline(root = '.', options = {}) {
  const resolvedRoot = path.resolve(root);
  const outDir = resolveOutputDir(resolvedRoot, options.outDir);
  const detected = detect(resolvedRoot, { ...options, outDir });
  const extractions = [];

  for (const entry of detected.files) {
    const cached = loadCached(entry.path, resolvedRoot);
    if (cached) {
      extractions.push(cached);
      continue;
    }
    const extraction = extract(entry.path, { root: resolvedRoot });
    extraction.meta = { ...(extraction.meta || {}), source_file: entry.path };
    saveCached(entry.path, extraction, resolvedRoot);
    extractions.push(extraction);
  }

  const graph = build(extractions);
  const communities = cluster(graph);
  const outputs = exportGraph(graph, outDir, communities, options);
  saveManifest(
    detected.files.map((entry) => ({
      path: entry.path,
      hash: fileHash(entry.path),
      type: entry.type,
      words: entry.words,
    })),
    resolvedRoot,
  );

  return {
    root: resolvedRoot,
    outDir,
    graph,
    communities,
    detected,
    outputs,
  };
}

module.exports = {
  runPipeline,
};
