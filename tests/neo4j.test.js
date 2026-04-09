const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const { build } = require('../src/build');
const { pushToNeo4j, toNeo4jCypher } = require('../src/neo4j');

function makeGraph() {
  return build([
    {
      nodes: [
        { id: 'a', label: 'Alpha', file_type: 'code', source_file: 'a.js' },
        { id: 'b', label: 'Beta', file_type: 'code', source_file: 'b.js' },
      ],
      edges: [
        { source: 'a', target: 'b', relation: 'calls', confidence: 'EXTRACTED' },
      ],
    },
  ]);
}

test('toNeo4jCypher writes MERGE statements', () => {
  const graph = makeGraph();
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'graph-spec-neo4j-'));
  const outputPath = toNeo4jCypher(graph, path.join(outDir, 'cypher.txt'), { 0: ['a', 'b'] });
  assert.ok(fs.existsSync(outputPath));
  const content = fs.readFileSync(outputPath, 'utf8');
  assert.match(content, /MERGE/);
  assert.match(content, /MATCH/);
});

test('pushToNeo4j sends node and edge queries', async () => {
  const graph = makeGraph();
  const queries = [];
  const fakeSession = {
    run: async (query, params) => {
      queries.push({ query, params });
      return {};
    },
    close: async () => {},
  };
  const fakeDriver = {
    session: () => fakeSession,
    close: async () => {},
  };

  const result = await pushToNeo4j(graph, {
    uri: 'bolt://example:7687',
    user: 'neo4j',
    password: 'secret',
    communities: { 0: ['a', 'b'] },
    driverFactory: () => fakeDriver,
  });

  assert.equal(result.nodes, 2);
  assert.equal(result.edges, 1);
  assert.ok(queries.length >= 3);
  assert.match(queries[0].query, /MERGE/);
});
