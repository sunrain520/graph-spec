const assert = require('node:assert/strict');
const { test } = require('node:test');

const { build } = require('../src/build');
const { cluster } = require('../src/cluster');
const { godNodes, surprisingConnections, suggestQuestions } = require('../src/analyze');
const { renderReport } = require('../src/report');

function makeGraph() {
  return build([
    {
      nodes: [
        { id: 'a', label: 'Alpha', file_type: 'code', kind: 'function' },
        { id: 'b', label: 'Beta', file_type: 'code', kind: 'function' },
        { id: 'c', label: 'Gamma', file_type: 'code', kind: 'function' },
        { id: 'd', label: 'Delta', file_type: 'code', kind: 'function' },
      ],
      edges: [
        { source: 'a', target: 'b', relation: 'calls', confidence: 'EXTRACTED' },
        { source: 'a', target: 'c', relation: 'calls', confidence: 'INFERRED' },
        { source: 'b', target: 'c', relation: 'calls', confidence: 'EXTRACTED' },
        { source: 'c', target: 'd', relation: 'calls', confidence: 'AMBIGUOUS' },
      ],
    },
  ]);
}

test('cluster assigns communities on the graph', () => {
  const graph = makeGraph();
  const communities = cluster(graph);
  assert.ok(Object.keys(communities).length >= 1);
  assert.ok(graph.nodes.get('a').community != null);
});

test('analysis exposes god nodes, surprising connections, and questions', () => {
  const graph = makeGraph();
  const communities = cluster(graph);
  const gods = godNodes(graph, 3);
  const bridges = surprisingConnections(graph, communities, 5);
  const questions = suggestQuestions(graph, communities, 5);

  assert.ok(gods.length > 0);
  assert.ok(bridges.length > 0);
  assert.equal(questions.length, 5);
});

test('renderReport includes the main sections', () => {
  const graph = makeGraph();
  const communities = cluster(graph);
  const report = renderReport(graph, { communities });
  assert.match(report, /# GRAPH_REPORT/);
  assert.match(report, /## God Nodes/);
  assert.match(report, /## Surprising Connections/);
  assert.match(report, /## Suggested Questions/);
});

