const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { test } = require('node:test');

const { writeClaude, writeAgents, uninstallClaude, uninstallAgents } = require('../src/install');
const { install: installHooks, uninstall: uninstallHooks, status: hooksStatus } = require('../src/hooks');
const { _rebuildCode } = require('../src/watch');
const { runPipeline } = require('../src/pipeline');
const { runBenchmark } = require('../src/benchmark');

function makeTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'graph-spec-install-'));
}

test('installers write CLAUDE.md, AGENTS.md, and claude settings', () => {
  const root = makeTmp();
  const result = writeClaude(root);
  const agents = writeAgents(root, 'codex');
  assert.ok(fs.existsSync(result.target));
  assert.ok(fs.existsSync(result.settingsPath));
  assert.ok(fs.existsSync(agents.target));
  assert.ok(fs.readFileSync(result.target, 'utf8').includes('graph-spec'));
  assert.ok(fs.readFileSync(agents.target, 'utf8').includes('graph-spec'));
  assert.equal(uninstallClaude(root), true);
  assert.equal(uninstallAgents(root), true);
});

test('git hooks install and uninstall in a repository', () => {
  const root = makeTmp();
  execFileSync('git', ['init'], { cwd: root });
  const installed = installHooks(root);
  assert.ok(installed.includes('post-commit'));
  assert.ok(fs.existsSync(path.join(root, '.git', 'hooks', 'post-commit')));
  assert.match(hooksStatus(root), /installed/);
  const removed = uninstallHooks(root);
  assert.ok(removed.includes('post-commit'));
});

test('watch rebuild helper and benchmark work on generated graphs', () => {
  const root = makeTmp();
  fs.writeFileSync(path.join(root, 'app.js'), 'export function hello(x) { return x + 1 }\n', 'utf8');
  const rebuild = _rebuildCode(root);
  assert.ok(rebuild.ok);
  const result = runPipeline(root);
  const benchmark = runBenchmark(result.outputs.graphJson, { question: 'hello' });
  assert.ok(benchmark.query_tokens > 0);
  assert.ok(benchmark.reduction >= 0);
});

