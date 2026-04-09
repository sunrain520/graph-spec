const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const { main } = require('../src/cli');
const { ingestUrl, saveQueryResult } = require('../src/ingest');

function makeTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'graph-spec-ingest-'));
}

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve(port);
    });
  });
}

test('ingestUrl saves a webpage as markdown', async () => {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end('<html><head><title>Sample Page</title></head><body><h1>Hello</h1><p>World</p></body></html>');
  });
  const port = await listen(server);
  const root = makeTmp();
  try {
    const result = await ingestUrl(`http://127.0.0.1:${port}/page`, path.join(root, 'raw'), {
      author: 'Alice',
      contributor: 'Bob',
    });
    assert.equal(result.type, 'webpage');
    assert.ok(fs.existsSync(result.outPath));
    const content = fs.readFileSync(result.outPath, 'utf8');
    assert.match(content, /Sample Page/);
    assert.match(content, /Hello/);
    assert.match(content, /World/);
  } finally {
    server.close();
  }
});

test('saveQueryResult writes a graph-ready note', () => {
  const root = makeTmp();
  const outPath = saveQueryResult('What is auth?', 'Answer goes here', path.join(root, 'memory'), {
    sourceNodes: ['node-a', 'node-b'],
  });
  assert.ok(fs.existsSync(outPath));
  const content = fs.readFileSync(outPath, 'utf8');
  assert.match(content, /What is auth\?/);
  assert.match(content, /source_nodes/);
  assert.match(content, /Answer goes here/);
});

test('cli add ingests a URL and rebuilds the graph', async () => {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end('<html><head><title>CLI Add</title></head><body><p>Added</p></body></html>');
  });
  const port = await listen(server);
  const root = makeTmp();
  const cwd = process.cwd();
  process.chdir(root);
  try {
    const result = await main(['add', `http://127.0.0.1:${port}/add`, '--target-dir', 'raw']);
    assert.ok(result);
    assert.ok(fs.existsSync(path.join(root, 'raw')));
    assert.ok(fs.existsSync(path.join(root, 'graphify-out', 'graph.json')));
  } finally {
    process.chdir(cwd);
    server.close();
  }
});
