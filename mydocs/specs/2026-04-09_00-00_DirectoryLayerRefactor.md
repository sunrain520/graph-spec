# Spec: graph-spec 目录分层重构

> 版本：v2（PLAN 阶段）
> 阶段：PLAN [LOCKED]
> Spec 路径：mydocs/specs/2026-04-09_00-00_DirectoryLayerRefactor.md
> Codemap：mydocs/codemap/2026-04-09_00-00_graph-spec项目总图.md

---

## 0. 热上下文

- **当前阶段**：PLAN
- **Approval Status**：待用户输入 `Plan Approved`
- **Goal**：将所有内部运行态收敛到 `.graph-spec/runtime/`，`out_dir` 只存最终交付物
- **In Scope**：见 §2
- **Open Questions**：已全部确认（见 §1.4）
- **活跃 Checklist**：见 §4.3
- **Next Action**：用户输入 `Plan Approved` 后进入 EXECUTE

---

## 1. Research Findings

### 1.1 需求来源

- 需求文档：`docs/plans/2026-04-09-graph-spec-directory-layer-design.md`
- 核心决策：Breaking Change，不保留旧路径兼容，不做自动迁移

### 1.2 现状分析（代码事实）

| 模块 | 当前行为 | 问题 |
|---|---|---|
| `src/detect.js:144-165` | `detect()` 返回 cacheDir/convertedDir/manifestPath，均派生自 outDir | 内部状态耦合 outDir |
| `src/cache.js:12-14` | `cacheDir(root, outDir)` → outDir/cache/ | 缓存写 outDir |
| `src/manifest.js:7` | `loadManifest()` 默认路径 → outDir/manifest.json | manifest 写 outDir |
| `src/benchmark.js:13` | `path.dirname(graphPath)/manifest.json` | 反推 outDir，脆弱 |
| `src/watch.js:31` | `ignored: /(^|[\\/])\../` | 屏蔽所有 dotfile，含 .graphify_config.json |
| `src/ingest.js:174` | `targetDir = path.join('.', 'raw')` | 临时文件写根目录 |
| `src/pipeline.js:18,25,39` | cache/manifest 均传 outDir | 内部状态路径耦合 outDir |

### 1.4 Open Questions（已确认）

| # | 问题 | 决策 |
|---|---|---|
| Q1 | 路径 helpers 新文件 vs 扩展 config.js | ✅ 新建 `src/paths.js` |
| Q2 | detect() 返回值保留字段 vs 删除 | ✅ 方案 A 仅适用于 cacheDir/manifestPath（有消费者）；convertedDir 无任何外部消费者，本次 Breaking Change 直接删除该字段 |
| Q3 | ingest 参数 root vs targetDir | ✅ 方案 A：签名改为 `ingestUrl(url, root, options)` |
| Q4 | benchmark 签名 | ✅ `runBenchmark(graphPath, root, options)` |
| Q5 | manifest 接口 | ✅ `loadManifest(root)` / `saveManifest(files, root)` |

---

## 2. In Scope

1. 新建 `src/paths.js`
2. `src/config.js`：out_dir 路径校验
3. `src/cache.js`：缓存迁移至 runtime/cache/，移除 outDir 参数
4. `src/manifest.js`：manifest 迁移至 runtime/manifest.json，API 改以 root 为核心
5. `src/detect.js`：collectFiles 忽略 .graph-spec/；detect() 删除 convertedDir 字段，cacheDir/manifestPath 改为 runtime 路径
6. `src/pipeline.js`：路径传参更新
7. `src/watch.js`：ignored 改为函数形式
8. `src/benchmark.js`：新增 root 参数
9. `src/ingest.js`：签名改为 `ingestUrl(url, root, options)`
10. `src/cli.js`：联动更新
11. `tests/detect.test.js`：更新断言，补充 .graph-spec 忽略测试
12. `tests/ingest.test.js`：更新 ingestUrl 调用签名
13. `.gitignore`：加入 `.graph-spec/`

## 3. Out of Scope

- README.md、docs/user-manual.md 文档同步
- 环境变量配置层
- 旧 .graphify_* 文件自动迁移或删除
- `src/serve.js` / `src/mcp.js` / `src/security.js`：三者均不接触 cache/manifest/runtime 路径，行为不变，本轮无需修改。out_dir 路径校验统一在 `config.js:resolveOutputDir` 落点，不依赖 security.js 新增工具函数。
- `collectFiles` 递归进入 `.git/` 等其他隐藏目录（pre-existing issue，超出本轮范围，后续单独处理）

---

## 4. Plan

### 4.1 File Changes

| 文件 | 操作 |
|---|---|
| `src/paths.js` | 新建 |
| `src/config.js` | 修改（加校验） |
| `src/cache.js` | 修改（移除 outDir 参数） |
| `src/manifest.js` | 修改（API 改为 root） |
| `src/detect.js` | 修改（ignore + 返回值） |
| `src/pipeline.js` | 修改（更新调用） |
| `src/watch.js` | 修改（ignored 函数化） |
| `src/benchmark.js` | 修改（新增 root 参数） |
| `src/ingest.js` | 修改（签名变更） |
| `src/cli.js` | 修改（联动调用） |
| `tests/detect.test.js` | 修改（断言更新） |
| `tests/ingest.test.js` | 修改（调用签名更新） |
| `.gitignore` | 修改（增加 .graph-spec/） |

### 4.2 Function Signatures

**`src/paths.js`（新建）**
```js
getProjectStateDir(root: string): string
  // → path.join(path.resolve(root), '.graph-spec')

getProjectConfigPath(root: string): string
  // → path.join(path.resolve(root), '.graphify_config.json')

getRuntimeDir(root: string): string
  // → path.join(getProjectStateDir(root), 'runtime')

getRuntimePath(root: string, name: string): string
  // → path.join(getRuntimeDir(root), name)
```

**`src/config.js`（修改）**
```js
resolveOutputDir(targetRoot: string, outDir?: string): string
  // 新增：若解析结果落在 .graph-spec/ 内，throw new Error(...)
```

**`src/cache.js`（修改，移除 outDir 参数）**
```js
cacheDir(root?: string): string
cachePathFor(filePath: string, root?: string): string
loadCached(filePath: string, root?: string): object | null
saveCached(filePath: string, result: object, root?: string): void
cachedFiles(root?: string): string[]
clearCache(root?: string): void
checkSemanticCache(filePaths: string[], root?: string): { cached, uncached }
saveSemanticCache(extractions: object[], root?: string): void
```

**`src/manifest.js`（修改）**
```js
loadManifest(root?: string): object | null
  // 内部：getRuntimePath(root, 'manifest.json')

saveManifest(files: object[], root: string): string
  // 内部：getRuntimePath(root, 'manifest.json')

detectIncremental(root: string, options?: object): object
  // 改用 loadManifest(root)，不依赖 detect().manifestPath
```

**`src/detect.js`（修改）**
```js
detect(root: string, options?: object): {
  root, outDir,
  // convertedDir 已删除（无任何外部消费者，Breaking Change 顺带清理）
  cacheDir:     getRuntimePath(root, 'cache'),         // 原: outDir/cache
  manifestPath: getRuntimePath(root, 'manifest.json'), // 原: outDir/manifest.json
  files, totalWords
}
// collectFiles 内部新增：walk 时遇到 getProjectStateDir(root) 路径直接跳过
```

**`src/benchmark.js`（修改）**
```js
runBenchmark(graphPath: string, root?: string, options?: object): object
  // manifest 路径：getRuntimePath(path.resolve(root || '.'), 'manifest.json')
  // root 语义决策：
  //   - CLI 始终传 path.resolve('.') 作为 root（当前工作目录）
  //   - 不新增 --root flag
  //   - 不允许通过 path.dirname(graphPath) 反推 root（outDir 迁移后两者无固定关系）
  // manifest 缺失行为（实现要求，不可静默）：
  //   - 若 manifest 文件不存在，必须向 stderr 输出警告：
  //     "[graph-spec] Warning: manifest not found at <path>; corpus_words will be 0"
  //   - corpusWords = 0，reduction = 0，函数仍正常返回（不 throw）
  //   - 典型场景：graphPath 来自外部项目；结果仅反映 graph 查询文本，不反映原始语料体量
```

**`src/ingest.js`（修改）**
```js
ingestUrl(url: string, root?: string, options?: object): Promise<object>
  // targetDir 内部推导：getRuntimePath(path.resolve(root), 'ingest')
```

### 4.3 Implementation Checklist

- [ ] **1.** 新建 `src/paths.js`，导出 `getProjectStateDir / getProjectConfigPath / getRuntimeDir / getRuntimePath`
- [ ] **2.** 修改 `src/config.js`：`import paths.js`；在 `resolveOutputDir` 末尾加路径校验 throw
- [ ] **3.** 修改 `src/cache.js`：所有函数签名移除 `outDir` 参数，改用 `getRuntimePath(root, 'cache')`
- [ ] **4.** 修改 `src/manifest.js`：`loadManifest(root)` / `saveManifest(files, root)`，内部用 `getRuntimePath`；`detectIncremental` 改用 `loadManifest(root)`
- [ ] **5.** 修改 `src/detect.js`：`collectFiles` 内 walk 时遇到 `getProjectStateDir(root)` 路径跳过；`detect()` 删除 `convertedDir` 字段，`cacheDir`/`manifestPath` 改为 `getRuntimePath` 推导
- [ ] **6.** 修改 `src/pipeline.js`：`loadCached/saveCached` 移除 `outDir` 参数；`saveManifest` 传 `resolvedRoot`
- [ ] **7.** 修改 `src/watch.js`：`ignored` 改为如下基于完整归一化路径的函数（必须精确，不能用 basename 判断）：
  ```js
  const stateDir = getProjectStateDir(root);
  const outDir   = resolveOutputDir(root, options.outDir);
  const configPath = path.resolve(path.join(root, '.graphify_config.json'));
  ignored: (filePath) => {
    const resolved = path.resolve(filePath);
    if (resolved === configPath) return false;                              // 放行配置文件
    if (resolved === stateDir || resolved.startsWith(stateDir + path.sep)) return true;  // 屏蔽 .graph-spec/
    if (resolved === outDir   || resolved.startsWith(outDir   + path.sep)) return true;  // 屏蔽 out_dir/
    return /(^|[\\/])\./.test(path.basename(filePath));                    // 屏蔽其他 dotfile
  }
  ```
- [ ] **8.** 修改 `src/benchmark.js`：签名加 `root` 参数；manifest 路径改为 `getRuntimePath(root, 'manifest.json')`；manifest 不存在时向 stderr 输出 `[graph-spec] Warning: manifest not found at <path>; corpus_words will be 0`，不 throw
- [ ] **9.** 修改 `src/ingest.js`：签名改为 `ingestUrl(url, root, options)`，内部推导 `getRuntimePath(root, 'ingest')`
- [ ] **10.** 修改 `src/cli.js`：
  - `case 'add'`：`root = path.resolve('.')` 提前到 ingestUrl 调用前；改为 `ingestUrl(rest[0], root, { author, contributor })`；移除 `flags.targetDir` 及 `--target-dir` 帮助文案
  - `case 'benchmark'`：新增 `const root = path.resolve('.')`（当前工作目录，不从 graphPath 反推；外部路径时 manifest 静默降级为 0）；改为 `runBenchmark(graphPath, root, { question, depth, mode })`
- [ ] **11.** 修改 `tests/detect.test.js`：删除 `convertedDir` 断言；更新 `cacheDir`/`manifestPath` 断言为 runtime 路径；新增 `.graph-spec/` 目录内文件不被扫描的测试
- [ ] **12.** 修改 `tests/ingest.test.js`（两处）：
  - 直接调用测试（line 32-47）：`ingestUrl(url, path.join(root, 'raw'), ...)` → `ingestUrl(url, root, ...)`；断言路径从 `raw/` 改为 `.graph-spec/runtime/ingest/`
  - CLI 测试（line 59-77）：移除 `--target-dir` 参数；断言从 `path.join(root, 'raw')` 改为 `path.join(root, '.graph-spec', 'runtime', 'ingest')`
- [ ] **13.** 修改 `.gitignore`：增加 `.graph-spec/`

---

## 5. Execute Log

| 步骤 | 文件 | 状态 | 备注 |
|---|---|---|---|
| 1 | `src/paths.js` | ✅ | 新建 |
| 2 | `src/config.js` | ✅ | out_dir 路径校验 |
| 3 | `src/cache.js` | ✅ | 移除 outDir 参数 |
| 4 | `src/manifest.js` | ✅ | API 改为 root |
| 5 | `src/detect.js` | ✅ | 删除 convertedDir，skip stateDir |
| 6 | `src/pipeline.js` | ✅ | cache/manifest 调用更新 |
| 7 | `src/watch.js` | ✅ | ignored 函数精确化 |
| 8 | `src/benchmark.js` | ✅ | root 参数 + stderr 警告 |
| 9 | `src/ingest.js` | ✅ | 签名改 (url, root) |
| 10 | `src/cli.js` | ✅ | add/benchmark 联动 |
| 11 | `tests/detect.test.js` | ✅ | 断言更新 + 跳过测试 |
| 12 | `tests/ingest.test.js` | ✅ | 两处更新 |
| 13 | `.gitignore` | ✅ | 增加 .graph-spec/ |
| +偏差 | `tests/install.test.js` | ✅ | 发现遗漏旧签名，已修复 |

**测试结果**：32/32 PASS

---

## 6. Review Verdict

**结论：PASS — 执行后复盘**

对照源码（detect.js / cache.js / manifest.js / pipeline.js / watch.js / benchmark.js / ingest.js / cli.js / tests/）逐行核验，全部通过。以下是两处需在执行时注意的细节，不阻塞进入 EXECUTE：

### 6.1 需执行时注意（不修改 Spec，记录为实现提示）

**提示 A — `detect.js` 和 `watch.js` 需新增 import**

Checklist 5 和 7 均隐含了新增 import，但未显式列出：
- `detect.js`：需在顶部加 `const { getProjectStateDir } = require('./paths')`
- `watch.js`：需加 `const { getProjectStateDir } = require('./paths')` 和 `const { resolveOutputDir } = require('./config')`（watch.js 当前未 import config.js）

执行时自行添加，不属于设计缺陷。

**提示 B — `collectFiles` 路径比较需精确**

Checklist 5 说"遇到 `getProjectStateDir(root)` 路径跳过"，实现时须确保比较发生在正确位置：

```js
// collectFiles 顶部（walk 闭包外）
const resolvedRoot = path.resolve(root);
const stateDir = getProjectStateDir(resolvedRoot);

function walk(current) {
  ...
  if (stat.isDirectory()) {
    if (full === stateDir) continue;  // full 由 path.resolve(root) 派生，已是绝对路径
    walk(full);
    continue;
  }
```

`full = path.join(current, entry.name)` 由绝对路径递推，`getProjectStateDir` 内部也调用 `path.resolve`，两者可直接 `===` 比较，无需额外 `path.resolve(full)`。

### 6.2 已确认无误项

| 检查项 | 结论 |
|--------|------|
| §1.2 现状分析行号与源码对齐 | ✅ 全部准确 |
| §1.4 Q2 与 Checklist 5 一致（convertedDir 删除） | ✅ |
| §4.2 watch.js ignored 函数逻辑 | ✅ 路径归一化正确 |
| §4.2 benchmark.js manifest 缺失 → stderr 警告，不 throw | ✅ |
| Checklist 12 覆盖 ingest.test.js 两处（直接调用 + CLI 测试） | ✅ |
| Checklist 10 benchmark root 推导为 `path.resolve('.')` | ✅ |
| Out of Scope 中记录 .git/ 遍历 pre-existing issue | ✅ |
| pipeline.js 中 `detected.outDir` 仍传给 exportGraph（不受本轮影响） | ✅ |
| `saveQueryResult` 不受本轮签名变更影响 | ✅ |

---

## 7. Review Matrix（REVIEW EXECUTE）

### 轴 1：Spec 质量与目标达成

| 检查项 | 结论 |
|---|---|
| 内部运行态收敛至 `.graph-spec/runtime/` | PASS |
| `out_dir` 只存最终交付物 | PASS |
| Breaking Change，无兼容层 | PASS |
| 32/32 测试通过 | PASS |

### 轴 2：Spec-Code 一致性

| 检查项 | 结论 | 备注 |
|---|---|---|
| Checklist 1-13 全部实现 | PASS | |
| Plan 偏差：`tests/install.test.js` | PARTIAL | Plan 未列，执行时发现并修复，授权偏差 |

### 轴 3：代码自身质量

| 检查项 | 结论 | 说明 |
|---|---|---|
| `detect.js:136` isIgnored 传 raw root | PASS | detect() 始终先 resolve，pre-existing，无回归 |
| `watch.js` outDir 启动时固定 | PASS | pre-existing 限制，非回归 |
| `benchmark.js` manifest 损坏时无警告（只静默降级） | PARTIAL | 不存在时有警告，损坏时无，行为不一致。低风险，后续对齐 |
| `config.js` throw 路径缺专项测试 | PARTIAL | 建议补充，不阻塞 |

### Overall Verdict：PASS

**Blocking Issues**：无

**非阻塞后续**：
1. `benchmark.js`：manifest 损坏时也应 stderr 警告，与 not-found 对齐
2. `tests/`：补充 `resolveOutputDir` throw 路径测试

---

## 8. Plan-Execution Diff

| 类型 | 说明 |
|---|---|
| 计划内全部完成 | Checklist 1-13 均已实现 |
| 授权偏差 | `tests/install.test.js` — Plan 未列，执行时发现 `runBenchmark` 旧签名调用，修复后测试通过 |

---

## 8. Change Log

| 时间 | 阶段 | 变更 |
|---|---|---|
| 2026-04-09 | RESEARCH | 首版 Spec 创建 |
| 2026-04-09 | PLAN | 用户确认全部 Q1-Q5，进入 PLAN，完成详细设计 |
| 2026-04-09 | PLAN | 修复三个审查问题：watch ignored 精确化、benchmark root 语义收口、serve/mcp/security scope 澄清 |
| 2026-04-09 | PLAN | 修复四个新审查问题：convertedDir 确认为死字段并删除、benchmark root 推导写入 checklist、ingest.test.js CLI 测试纳入 checklist 12、.git/ 遍历问题记入 Out of Scope |
| 2026-04-09 | EXECUTE | 13 个 checklist 全部完成 + install.test.js 授权偏差修复，32/32 测试通过 |
| 2026-04-09 | REVIEW | Overall Verdict: PASS，两个非阻塞建议记录在案 |
| 2026-04-09 | PLAN | benchmark manifest 缺失从"静默 0"升级为 stderr 警告，避免产品语义误判；checklist 8 同步更新 |
| 2026-04-09 | PLAN | §6 Review Verdict 填充：PASS，记录两处实现提示（detect/watch 需新增 import、collectFiles stateDir 路径比较位置） |
