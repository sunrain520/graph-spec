const assert = require('node:assert/strict');
const { test } = require('node:test');

test('package metadata exists', () => {
  const pkg = require('../package.json');
  assert.equal(pkg.name, 'graph-spec');
  assert.equal(pkg.bin['graph-spec'], 'bin/graph-spec.js');
  assert.equal(pkg.bin.graphify, 'bin/graph-spec.js');
});

test('resolveOutputDir prefers explicit path and config file fallback', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const os = require('node:os');
  const { resolveOutputDir, DEFAULT_OUT_DIR } = require('../src/config');

  assert.equal(DEFAULT_OUT_DIR, 'graphify-out');
  assert.equal(resolveOutputDir('/tmp/project', 'docs/contents/graphify-out'), '/tmp/project/docs/contents/graphify-out');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'graph-spec-'));
  fs.writeFileSync(path.join(tmp, '.graphify_config.json'), JSON.stringify({ out_dir: 'docs/out' }), 'utf8');
  assert.equal(resolveOutputDir(tmp), path.join(tmp, 'docs/out'));
});

