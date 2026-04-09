const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const { build } = require('../src/build');
const { cluster } = require('../src/cluster');
const { exportGraph } = require('../src/export');
const { loadGraph, queryGraph, shortestPath } = require('../src/serve');

function makeGraph() {
  return build([
    {
      nodes: [
        { id: 'a', label: 'Alpha', file_type: 'code', kind: 'function', source_file: 'a.js' },
        { id: 'b', label: 'Beta', file_type: 'code', kind: 'function', source_file: 'b.js' },
      ],
      edges: [
        { source: 'a', target: 'b', relation: 'calls', confidence: 'EXTRACTED' },
      ],
    },
  ]);
}

test('exportGraph writes the standard output files', () => {
  const graph = makeGraph();
  const communities = cluster(graph);
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'graph-spec-export-'));
  const result = exportGraph(graph, outDir, communities, { wiki: true });

  assert.ok(fs.existsSync(result.graphJson));
  assert.ok(fs.existsSync(result.reportPath));
  assert.ok(fs.existsSync(result.htmlPath));
  assert.ok(fs.existsSync(result.svgPath));
  assert.ok(fs.existsSync(result.graphmlPath));
  assert.ok(fs.existsSync(result.cypherPath));
  assert.ok(fs.existsSync(result.wikiPath));
  assert.ok(fs.existsSync(result.wikiIndexPath));
});

test('queryGraph and shortestPath work from the exported graph', () => {
  const graph = makeGraph();
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'graph-spec-export-'));
  const { graphJson } = exportGraph(graph, outDir, cluster(graph));
  const loaded = loadGraph(graphJson);
  const text = queryGraph(loaded, 'alpha', { depth: 2 });
  assert.match(text, /Traversal:/);
  assert.deepEqual(shortestPath(loaded, 'a', 'b'), ['a', 'b']);
});
