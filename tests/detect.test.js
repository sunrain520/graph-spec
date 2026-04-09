const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const { classifyFile, collectFiles, detect } = require('../src/detect');

function makeTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'graph-spec-detect-'));
}

test('classifyFile identifies supported file kinds', () => {
  assert.equal(classifyFile('/tmp/a.py'), 'code');
  assert.equal(classifyFile('/tmp/a.md'), 'document');
  assert.equal(classifyFile('/tmp/a.pdf'), 'paper');
  assert.equal(classifyFile('/tmp/a.png'), 'image');
  assert.equal(classifyFile('/tmp/a.docx'), 'document');
});

test('collectFiles respects ignore files and skips secrets', () => {
  const root = makeTmp();
  fs.writeFileSync(path.join(root, '.graphifyignore'), 'ignored/\n*.generated.py\n');
  fs.mkdirSync(path.join(root, 'ignored'), { recursive: true });
  fs.writeFileSync(path.join(root, 'keep.py'), 'print("ok")\n');
  fs.writeFileSync(path.join(root, 'ignored', 'skip.py'), 'print("no")\n');
  fs.writeFileSync(path.join(root, 'token.txt'), 'secret token\n');
  fs.writeFileSync(path.join(root, 'build.generated.py'), 'print("no")\n');

  const files = collectFiles(root);
  assert.deepEqual(files.map((file) => path.relative(root, file)), ['keep.py']);
});

test('collectFiles skips .graph-spec/ internal state directory', () => {
  const root = makeTmp();
  fs.writeFileSync(path.join(root, 'keep.py'), 'print("ok")\n');
  const stateDir = path.join(root, '.graph-spec', 'runtime', 'cache');
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(path.join(stateDir, 'should_not_appear.py'), 'print("internal")\n');

  const files = collectFiles(root);
  assert.deepEqual(files.map((file) => path.relative(root, file)), ['keep.py']);
});

test('collectFiles includes ingested runtime notes', () => {
  const root = makeTmp();
  fs.writeFileSync(path.join(root, 'keep.py'), 'print("ok")\n');
  const ingestDir = path.join(root, '.graph-spec', 'runtime', 'ingest');
  fs.mkdirSync(ingestDir, { recursive: true });
  fs.writeFileSync(path.join(ingestDir, 'ingested.md'), '# Ingested\n');

  const files = collectFiles(root);
  assert.deepEqual(
    files.map((file) => path.relative(root, file)).sort(),
    ['.graph-spec/runtime/ingest/ingested.md', 'keep.py'].sort(),
  );
});

test('detect resolves output directory from config file', () => {
  const root = makeTmp();
  fs.writeFileSync(path.join(root, '.graphify_config.json'), JSON.stringify({ out_dir: 'docs/contents/graphify-out' }), 'utf8');
  fs.writeFileSync(path.join(root, 'keep.py'), 'print("ok")\n');

  const result = detect(root);
  assert.equal(result.outDir, path.join(root, 'docs/contents/graphify-out'));
  assert.equal(result.cacheDir, path.join(root, '.graph-spec', 'runtime', 'cache'));
  assert.equal(result.manifestPath, path.join(root, '.graph-spec', 'runtime', 'manifest.json'));
  assert.equal(result.convertedDir, undefined);
  assert.equal(result.files.length, 1);
  assert.equal(result.files[0].type, 'code');
});
