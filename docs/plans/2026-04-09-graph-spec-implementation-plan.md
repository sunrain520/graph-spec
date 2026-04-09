# graph-spec Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 graphify 的核心与外围能力迁移为 Node.js/npm 项目，并完成全量自动化测试与打包验证。

**Architecture:** 先落地可运行的仓库骨架，再按“配置解析 -> 文件发现 -> 图模型 -> 代码抽取 -> 文档/语义抽取 -> 分析/导出 -> CLI/安装器 -> 服务/缓存/测试”逐层推进。每一层先写测试，再写最小实现，再回归更大范围测试，避免一次性堆叠复杂度。输出目录解析必须统一接入 `.graphify_config.json` 和显式 `outDir` 覆盖，不能在各模块里继续写死路径。

**Tech Stack:** Node.js 20+、CommonJS、`commander`、`@kreuzberg/tree-sitter-language-pack`、`graphology`、`graphology-communities-louvain`、`chokidar`、`ignore`、`fast-glob`、`gray-matter`、`pdfjs-dist`、`mammoth`、`xlsx`、`node:test`。

---

### Task 1: 仓库骨架与发布配置

**Files:**
- Create: `src/config.js`
- Create: `package.json`
- Create: `bin/graph-spec.js`
- Create: `src/index.js`
- Create: `src/cli.js`
- Create: `README.md`
- Create: `.gitignore`
- Modify: `CHANGELOG.md`

**Step 1: Write the failing test**

```js
const assert = require('node:assert/strict');
const { test } = require('node:test');

test('package metadata exists', () => {
  const pkg = require('../package.json');
  assert.equal(pkg.name, 'graph-spec');
  assert.equal(pkg.bin['graph-spec'], 'bin/graph-spec.js');
});

test('resolveOutputDir prefers explicit config', () => {
  const { resolveOutputDir } = require('../src/config');
  const dir = resolveOutputDir('/tmp/project', 'docs/contents/graphify-out');
  assert.equal(dir, '/tmp/project/docs/contents/graphify-out');
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/package.test.js`
Expected: FAIL because `package.json`, `src/config.js`, and bin wiring are missing.

**Step 3: Write minimal implementation**

Create a publishable `package.json`, CLI entrypoint, `src/config.js`, and a tiny `src/index.js` export.

**Step 4: Run test to verify it passes**

Run: `node --test tests/package.test.js`
Expected: PASS.

**Step 5: Commit**

```bash
git add package.json bin/graph-spec.js src/index.js src/cli.js src/config.js README.md CHANGELOG.md tests/package.test.js
git commit -m "feat: scaffold graph-spec npm package"
```

### Task 2: 文件发现与忽略规则

**Files:**
- Create: `src/detect.js`
- Create: `tests/detect.test.js`

**Step 1: Write the failing test**

Cover `.graphspecignore`, `.graphifyignore`, secret-file skipping, code/doc/paper/image classification, and `resolveOutputDir()`-driven `converted/` and `cache/` locations.

**Step 2: Run test to verify it fails**

Run: `node --test tests/detect.test.js`
Expected: FAIL.

**Step 3: Write minimal implementation**

Implement directory walking, ignore matching, file classification, and word counting.

**Step 4: Run test to verify it passes**

Run: `node --test tests/detect.test.js`
Expected: PASS.

### Task 3: 图结构、校验与构建

**Files:**
- Create: `src/validate.js`
- Create: `src/build.js`
- Create: `src/graph.js`
- Create: `tests/build.test.js`

**Step 1: Write the failing test**

Verify node/edge validation, undirected graph construction, preserved edge direction metadata, and hyperedge storage.

**Step 2: Run test to verify it fails**

Run: `node --test tests/build.test.js`
Expected: FAIL.

**Step 3: Write minimal implementation**

Implement validation helpers and graph assembly helpers.

**Step 4: Run test to verify it passes**

Run: `node --test tests/build.test.js`
Expected: PASS.

### Task 4: 代码抽取引擎

**Files:**
- Create: `src/extract.js`
- Create: `src/languages.js`
- Create: `tests/extract.test.js`

**Step 1: Write the failing test**

Use representative fixtures for Python, JavaScript, Go, Rust, Java, C/C++, Ruby, C#, Kotlin, Scala, PHP, Swift, Lua, Zig, PowerShell, Elixir, and Objective-C.

**Step 2: Run test to verify it fails**

Run: `node --test tests/extract.test.js`
Expected: FAIL.

**Step 3: Write minimal implementation**

Wire in `@kreuzberg/tree-sitter-language-pack`, map parser output to graph nodes/edges, and normalize confidence labels.

**Step 4: Run test to verify it passes**

Run: `node --test tests/extract.test.js`
Expected: PASS.

### Task 5: 聚类、分析与报告

**Files:**
- Create: `src/cluster.js`
- Create: `src/analyze.js`
- Create: `src/report.js`
- Create: `tests/analyze.test.js`

**Step 1: Write the failing test**

Assert community assignment, god-node ranking, surprising connections, and report content.

**Step 2: Run test to verify it fails**

Run: `node --test tests/analyze.test.js`
Expected: FAIL.

**Step 3: Write minimal implementation**

Implement Louvain clustering, scores, analysis heuristics, and markdown report rendering.

**Step 4: Run test to verify it passes**

Run: `node --test tests/analyze.test.js`
Expected: PASS.

### Task 6: 导出、查询与服务

**Files:**
- Create: `src/export.js`
- Create: `src/serve.js`
- Create: `tests/export.test.js`

**Step 1: Write the failing test**

Verify `graph.json`, `GRAPH_REPORT.md`, `graph.html`, `graph.graphml`, `cypher.txt`, and query traversal output.

**Step 2: Run test to verify it fails**

Run: `node --test tests/export.test.js`
Expected: FAIL.

**Step 3: Write minimal implementation**

Implement JSON/HTML/GraphML/Cypher export and the BFS/DFS query server helpers.

**Step 4: Run test to verify it passes**

Run: `node --test tests/export.test.js`
Expected: PASS.

### Task 7: 安装器、hook、watch、benchmark、cache

**Files:**
- Create: `src/cache.js`
- Create: `src/security.js`
- Create: `src/ingest.js`
- Create: `src/hooks.js`
- Create: `src/watch.js`
- Create: `src/benchmark.js`
- Create: `src/manifest.js`
- Create: `tests/install.test.js`

**Step 1: Write the failing test**

Cover `.claude/settings.json`, `CLAUDE.md`, `AGENTS.md`, git hook install/uninstall/status, watch rebuild, and semantic cache round-trip.

**Step 2: Run test to verify it fails**

Run: `node --test tests/install.test.js`
Expected: FAIL.

**Step 3: Write minimal implementation**

Implement installers, hook templates, rebuild helper, cache hashing, and security guards.

**Step 4: Run test to verify it passes**

Run: `node --test tests/install.test.js`
Expected: PASS.

### Task 8: 文档与发布校验

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Create: `docs/release.md`
- Create: `tests/pack.test.js`

**Step 1: Write the failing test**

Check that `npm pack` produces the expected files and that the package can be installed and executed from the tarball.

**Step 2: Run test to verify it fails**

Run: `npm pack && node --test tests/pack.test.js`
Expected: FAIL until packaging is correct.

**Step 3: Write minimal implementation**

Tune `files`, `exports`, bins, and docs until the tarball is clean.

**Step 4: Run test to verify it passes**

Run: `npm pack && node --test tests/pack.test.js`
Expected: PASS.
