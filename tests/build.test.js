const assert = require('node:assert/strict');
const { test } = require('node:test');

const { build, buildFromJSON } = require('../src/build');
const { validateExtraction } = require('../src/validate');

test('validateExtraction catches malformed payloads', () => {
  const errors = validateExtraction({
    nodes: [{ id: 'a' }],
    edges: [{ source: 'a', target: 'b' }],
  });
  assert.ok(errors.some((message) => message.includes("missing required field 'label'")));
});

test('buildFromJSON preserves edge direction metadata and hyperedges', () => {
  const graph = buildFromJSON({
    nodes: [
      { id: 'a', label: 'A', source_file: 'a.js', file_type: 'code' },
      { id: 'b', label: 'B', source_file: 'b.js', file_type: 'code' },
    ],
    edges: [
      { source: 'a', target: 'b', relation: 'calls', confidence: 'EXTRACTED' },
    ],
    hyperedges: [
      { type: 'flow', nodes: ['a', 'b'] },
    ],
  });

  assert.equal(graph.edges.length, 1);
  assert.equal(graph.edges[0]._src, 'a');
  assert.equal(graph.edges[0]._tgt, 'b');
  assert.equal(graph.hyperedges.length, 1);
  assert.equal(graph.hyperedges[0].type, 'flow');
});

test('build merges multiple extractions', () => {
  const graph = build([
    {
      nodes: [{ id: 'a', label: 'A', file_type: 'code' }],
      edges: [],
    },
    {
      nodes: [{ id: 'b', label: 'B', file_type: 'code' }],
      edges: [{ source: 'a', target: 'b', relation: 'imports', confidence: 'INFERRED' }],
    },
  ]);

  assert.equal(graph.nodes.size, 2);
  assert.equal(graph.edges.length, 1);
  assert.equal(graph.edges[0].relation, 'imports');
});

