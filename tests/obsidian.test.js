const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const { build } = require('../src/build');
const { toObsidian, toCanvas } = require('../src/obsidian');

function makeGraph() {
  return build([
    {
      nodes: [
        { id: 'parse', label: 'parse', file_type: 'code', source_file: 'parser.py' },
        { id: 'validate', label: 'validate', file_type: 'code', source_file: 'parser.py' },
        { id: 'render', label: 'render', file_type: 'code', source_file: 'renderer.py' },
      ],
      edges: [
        { source: 'parse', target: 'validate', relation: 'calls', confidence: 'EXTRACTED' },
        { source: 'parse', target: 'render', relation: 'references', confidence: 'INFERRED' },
      ],
    },
  ]);
}

test('toObsidian writes node notes, community notes, graph json, and canvas', () => {
  const graph = makeGraph();
  const communities = { 0: ['parse', 'validate'], 1: ['render'] };
  const labels = { 0: 'Parsing Layer', 1: 'Rendering Layer' };
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'graph-spec-obsidian-'));
  const count = toObsidian(graph, communities, outDir, {
    communityLabels: labels,
    cohesion: { 0: 0.9, 1: 1 },
  });

  assert.ok(count >= 5);
  assert.ok(fs.existsSync(path.join(outDir, 'parse.md')));
  assert.ok(fs.existsSync(path.join(outDir, '_COMMUNITY_Parsing_Layer.md')));
  assert.ok(fs.existsSync(path.join(outDir, 'graph.canvas')));
  assert.ok(fs.existsSync(path.join(outDir, '.obsidian', 'graph.json')));

  const note = fs.readFileSync(path.join(outDir, 'parse.md'), 'utf8');
  assert.match(note, /Connections/);
  assert.match(note, /\[\[validate\]\]/);
});

test('toCanvas writes a canvas file', () => {
  const graph = makeGraph();
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'graph-spec-obsidian-'));
  const canvasPath = path.join(outDir, 'graph.canvas');
  toCanvas(graph, { 0: ['parse', 'validate'], 1: ['render'] }, canvasPath, {
    communityLabels: { 0: 'Parsing Layer', 1: 'Rendering Layer' },
  });
  assert.ok(fs.existsSync(canvasPath));
  const content = fs.readFileSync(canvasPath, 'utf8');
  assert.match(content, /nodes/);
  assert.match(content, /edges/);
});
