const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const { main } = require('../src/cli');
const { runPipeline } = require('../src/pipeline');
const { resolveOutputDir } = require('../src/config');

function makeTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'graph-spec-cli-'));
}

test('cli config prints the resolved output directory', () => {
  const root = makeTmp();
  const chunks = [];
  const original = process.stdout.write;
  process.stdout.write = (chunk) => {
    chunks.push(String(chunk));
    return true;
  };
  try {
    main(['config', root]);
  } finally {
    process.stdout.write = original;
  }
  assert.equal(chunks.join('').trim(), resolveOutputDir(root));
});

test('cli build and query run end to end', () => {
  const root = makeTmp();
  fs.writeFileSync(path.join(root, 'app.js'), 'export function hello(x) { return x + 1 }\n', 'utf8');
  const buildResult = main([root]);
  assert.ok(buildResult);
  const pipeline = runPipeline(root);
  const text = main(['query', 'hello', '--graph', pipeline.outputs.graphJson]);
  assert.ok(String(text).includes('Traversal:'));
  const pathText = main(['path', 'hello', 'hello', '--graph', pipeline.outputs.graphJson]);
  assert.ok(String(pathText).includes('hello'));
  const explainText = main(['explain', 'hello', '--graph', pipeline.outputs.graphJson]);
  assert.ok(String(explainText).includes('Node:'));
  const wikiDir = path.join(root, 'wiki');
  const wikiResult = main(['wiki', pipeline.outputs.graphJson, wikiDir]);
  assert.ok(wikiResult);
  assert.ok(fs.existsSync(path.join(wikiDir, 'index.md')));
  const obsidianDir = path.join(root, 'obsidian');
  const obsidianResult = main(['obsidian', pipeline.outputs.graphJson, obsidianDir]);
  assert.ok(obsidianResult);
  assert.ok(fs.existsSync(path.join(obsidianDir, 'graph.canvas')));
  const cypherPath = path.join(root, 'cypher.txt');
  const neo4jResult = main(['neo4j', pipeline.outputs.graphJson, cypherPath]);
  assert.ok(neo4jResult);
  assert.ok(fs.existsSync(cypherPath));
});
