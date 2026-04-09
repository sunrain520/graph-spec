const assert = require('node:assert/strict');
const { test } = require('node:test');

const { build } = require('../src/build');
const { toolDefinitions, callTool } = require('../src/mcp');

function makeGraph() {
  return build([
    {
      nodes: [
        { id: 'parse', label: 'parse', file_type: 'code', source_file: 'parser.py', source_location: 'L1', community: 0 },
        { id: 'render', label: 'render', file_type: 'code', source_file: 'render.py', source_location: 'L2', community: 1 },
      ],
      edges: [
        { source: 'parse', target: 'render', relation: 'references', confidence: 'INFERRED' },
      ],
    },
  ]);
}

test('mcp tool definitions expose the expected graph tools', () => {
  const defs = toolDefinitions(makeGraph());
  const names = defs.map((item) => item.name);
  assert.ok(names.includes('query_graph'));
  assert.ok(names.includes('shortest_path'));
  assert.ok(names.includes('graph_stats'));
});

test('mcp query_graph returns traversal text', () => {
  const graph = makeGraph();
  const result = callTool(graph, 'query_graph', { question: 'parse' });
  assert.equal(result.isError, false);
  assert.match(result.content[0].text, /Traversal:/);
});

test('mcp shortest_path returns a path text', () => {
  const graph = makeGraph();
  const result = callTool(graph, 'shortest_path', { source: 'parse', target: 'render' });
  assert.equal(result.isError, false);
  assert.match(result.content[0].text, /parse/);
  assert.match(result.content[0].text, /render/);
});
