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

test('detect resolves output directory from config file', () => {
  const root = makeTmp();
  fs.writeFileSync(path.join(root, '.graphify_config.json'), JSON.stringify({ out_dir: 'docs/contents/graphify-out' }), 'utf8');
  fs.writeFileSync(path.join(root, 'keep.py'), 'print("ok")\n');

  const result = detect(root);
  assert.equal(result.outDir, path.join(root, 'docs/contents/graphify-out'));
  assert.equal(result.convertedDir, path.join(root, 'docs/contents/graphify-out', 'converted'));
  assert.equal(result.cacheDir, path.join(root, 'docs/contents/graphify-out', 'cache'));
  assert.equal(result.files.length, 1);
  assert.equal(result.files[0].type, 'code');
});

