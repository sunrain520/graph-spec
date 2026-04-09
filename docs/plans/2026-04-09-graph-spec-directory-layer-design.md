# graph-spec 目录分层技术方案

> 目标：把项目根目录中的配置、检测结果、缓存、锁和临时中间态统一收敛到 `.graph-spec/`，让根目录只保留用户源文件、显式配置入口、以及最终交付产物。

**Goal:** 将 `graph-spec` 的内部状态与用户交付产物彻底分离，消除根目录散落的 `.graphify_*` 临时文件，同时保留 `out_dir` 作为最终产物目录的灵活性。

**Decision:** 采用一个固定的项目内部目录 `.graph-spec/`，其中只放置所有运行时中间态；项目配置继续保留在根目录 `.graphify_config.json`。`out_dir` 继续作为最终输出目录，但不再承担内部缓存和临时文件的职责。

**Compatibility policy:** 不做兼容过渡。保留根目录 `.graphify_config.json` 作为唯一配置入口；不再读取任何旧临时文件，不做自动迁移，也不做自动回写。该变更视为一次明确的目录结构切换。

**Release policy:** 这是一次明确的 breaking change。发布时必须在 changelog、README 或 release note 中显式说明新布局；根目录 `.graphify_config.json` 是项目级配置的唯一入口，若缺失则回退默认 `graphify-out` 或要求调用方通过 `--out-dir` 显式指定。

---

## 1. 问题定义

当前实现里，项目根目录会出现多种内部文件，例如：

- `.graphify_detect.json`
- `.graphify_python`
- `.graphify_config.json`
- 其他构建过程中生成的中间态文件

同时，现有 `out_dir` 里也混入了一部分运行时状态，例如缓存、manifest、增量状态等。结果是：

- 根目录噪音高，`git status` 容易被内部状态污染
- 用户难以区分“最终产物”和“内部临时文件”
- 新增功能时容易继续在根目录或输出目录中散落状态文件
- 清理逻辑不统一，容易遗漏

---

## 2. 设计目标

1. 让项目根目录只承载“用户可见的输入与显式配置”。
2. 把所有内部状态集中到 `.graph-spec/`。
3. 把所有最终交付产物集中到 `out_dir`。
4. 保持 `out_dir` 的动态指定能力和命令行覆盖能力。
5. 提供明确、单一的路径解析入口，避免各模块自行拼路径。
6. 不引入兼容层，不保留旧根目录临时文件的读取逻辑。
7. 让后续新增功能默认复用同一个目录分层约定。

---

## 3. 非目标

- 不保留 `.graphify_config.json` 的根目录读取兼容。
- 不保留 `.graphify_detect.json`、`.graphify_python` 等旧临时文件的兼容读取。
- 不在此方案中引入环境变量配置层。
- 不把 `out_dir` 迁移到 `.graph-spec/` 内部。
- 不改变 `graph-spec` 的 CLI 语义，只改变目录归属。

---

## 4. 目录结构

### 4.1 项目根目录

```text
<project-root>/
  .graph-spec/
  docs/
  src/
  tests/
  README.md
  package.json
  ...
```

### 4.2 内部状态目录 `.graph-spec/`

```text
.graph-spec/
  runtime/
    detect.json
    manifest.json
    cache/
    tmp/
    ingest/
    locks/
    logs/
```

### 4.3 最终输出目录 `out_dir`

`out_dir` 仍然由配置文件或命令行参数决定，例如：

```text
docs/contents/graphify-out/
```

该目录只存放最终交付物，不应再存放内部状态文件。

建议最终输出物包括：

- `graph.json`
- `GRAPH_REPORT.md`
- `graph.html`
- `graph.svg`
- `graph.graphml`
- `cypher.txt`
- `wiki/`
- `obsidian/`

不建议把内部缓存、manifest、增量状态、临时下载文件放在这里。

---

## 5. 路径分层职责

| 目录或文件 | 职责 | 说明 |
|---|---|---|
| `.graphify_config.json` | 项目级配置 | 根目录唯一配置入口；可进版本控制 |
| `.graph-spec/runtime/detect.json` | 检测阶段中间结果 | 记录本次扫描、分类、增量判断等运行态数据 |
| `.graph-spec/runtime/manifest.json` | 增量清单 | 替代输出目录中的 `manifest.json` |
| `.graph-spec/runtime/cache/` | 语义/抽取缓存 | 替代输出目录中的 `cache/` |
| `.graph-spec/runtime/tmp/` | 一次性临时文件 | 下载、转换、拼装过程中的临时产物 |
| `.graph-spec/runtime/locks/` | 锁文件 | watch、长任务、并发构建等场景使用 |
| `.graph-spec/runtime/logs/` | 运行日志 | 内部排障信息，不属于用户交付物 |
| `out_dir/` | 最终产物 | 只存用户要消费的图谱结果和派生文档 |

---

## 6. 路径解析规则

### 6.1 基础函数

建议把所有路径入口收敛到一组基础函数，避免分散计算：

```js
getProjectStateDir(root)        // <root>/.graph-spec
getProjectConfigPath(root)      // <root>/.graphify_config.json
getRuntimeDir(root)             // <root>/.graph-spec/runtime
getRuntimePath(root, name)      // <root>/.graph-spec/runtime/<name>
resolveOutputDir(root, outDir)  // 仅解析最终输出目录
```

### 6.2 解析优先级

`resolveOutputDir(root, explicitOutDir)` 的优先级保持清晰：

1. 显式 `--out-dir`
2. 根目录 `.graphify_config.json` 中的 `out_dir`
3. 默认值 `graphify-out`

其中：

- `root` 是被分析项目的根目录
- `explicitOutDir` 是命令行传入的临时覆盖
- 配置文件路径固定为 `<root>/.graphify_config.json`

### 6.3 配置与扫描边界

`.graph-spec/` 是受控内部目录，不应作为普通输入源扫描。根目录 `.graphify_config.json` 必须被单独读取；watch 模式下需要监听该文件变化，以支持配置热重载。

### 6.4 路径约束

强制约束：`out_dir` 解析后的最终路径不得落在 `.graph-spec/` 内部。

如果检测到该情况，直接 `throw new Error(...)` 并停止执行，不创建任何输出。这样可以避免：

- 内部 runtime 路径和最终产物目录交叉
- watch / build 递归扫描
- 清理逻辑误删内部文件

### 6.5 `.gitignore` 约定

`.graph-spec/` 整个目录加入项目 `.gitignore`。原因：

- `runtime/` 是纯运行态，不应进入版本控制
- 每个使用者在本地首次运行时自动创建 `.graph-spec/`，无需从仓库继承

**CI/协作说明**：CI 和协作者可以依赖根目录 `.graphify_config.json`；如果需要临时覆盖输出目录，使用 `--out-dir`。`resolveOutputDir` 的默认值 `graphify-out` 是 CI 下的安全回退。

---

## 7. 配置文件方案

### 7.1 配置文件位置

项目配置文件固定为：

```text
.graphify_config.json
```

### 7.2 配置格式

当前最小配置只保留 `out_dir`：

```json
{
  "out_dir": "docs/contents/graphify-out"
}
```

### 7.3 配置语义

- 配置文件是**项目级配置**，控制默认输出目录
- 配置值相对于被分析目录解析
- 命令行 `--out-dir` 永远优先于配置文件
- 不读取根目录旧文件
- CI 和协作者可直接依赖该文件；如需临时覆盖，使用 `--out-dir`

### 7.4 配置文件职责边界

配置文件只负责：

- 最终输出目录
- 未来可能加入的少量全局项目参数

配置文件不负责：

- 运行时缓存
- 检测结果
- 临时下载文件
- 锁
- 日志

---

## 8. 运行时目录方案

### 8.1 `runtime/` 的职责

`runtime/` 是所有构建过程中状态的唯一落点，适合放：

- 本次检测摘要
- 中间 manifest
- 抽取缓存
- 临时文件
- 下载文件
- 转换文件
- 运行锁
- 调试日志

### 8.2 `detect.json`

建议用它记录：

- 本次扫描到的文件列表
- 分类结果
- 过滤结果
- 变更摘要

它不是最终产物，不应出现在 `out_dir/` 中。

### 8.3 `manifest.json`

建议从 `out_dir/` 移到 `runtime/`，因为它本质上是增量构建的内部状态，而不是交付给用户的产品。

### 8.4 `cache/`

建议也移动到 `runtime/cache/`，原因是：

- 它是加速构建的内部状态
- 用户通常不需要直接消费
- 放在 `out_dir/` 会污染交付目录

### 8.5 `tmp/`

一次性临时文件统一落在这里，例如：

- 文档转码中间件文件
- 抓取页面保存的暂存内容
- 语义提取前的中间文本

---

## 9. 模块影响分析

### 9.1 路径底座层

| 模块 | 需要改动的点 | 结果 |
|---|---|---|
| `src/config.js` | 读取根目录 `.graphify_config.json`；新增 state dir / runtime path helper | 配置与状态路径统一 |
| `src/cli.js` | 帮助文案、`config` 命令、安装命令说明更新 | 用户能看到新约定 |
| `src/pipeline.js` | 串联配置、运行态、最终输出路径 | 避免各模块各自推导路径 |

### 9.2 状态写入层

| 模块 | 需要改动的点 | 结果 |
|---|---|---|
| `src/detect.js` | 检测结果、manifest、缓存不再写根目录或 `out_dir` | 所有内部态进入 `.graph-spec/runtime/` |
| `src/cache.js` | 缓存目录从 `out_dir/cache` 改到 `runtime/cache` | 缓存不污染最终输出 |
| `src/manifest.js` | manifest 路径从 `out_dir/manifest.json` 改到 `runtime/manifest.json` | 增量状态内部化 |
| `src/watch.js` | 将 `ignored` 从正则改为函数，放行根目录 `.graphify_config.json`；屏蔽 `.graph-spec/runtime/` 和 `out_dir/` 写入 | 防止自触发循环，同时支持配置热重载 |
| `src/hooks.js` | hook 安装/重建逻辑读取新配置路径 | 安装过程不再依赖根目录旧配置 |
| `src/install.js` | CLAUDE / AGENTS 渲染读取 `.graphify_config.json` | 安装时一致使用新配置 |
| `src/ingest.js` | 下载/转换中间态写入 `runtime/tmp/` 或 `runtime/ingest/` | 临时产物集中管理 |

### 9.3 状态读取层

| 模块 | 需要改动的点 | 结果 |
|---|---|---|
| `src/export.js` | 只写最终交付物到 `out_dir` | 输出目录保持干净 |
| `src/serve.js` / `src/mcp.js` | 默认图路径仍从 `out_dir` 推导，但不依赖内部状态位置 | 客户端行为不变 |
| `src/benchmark.js` | 签名改为 `runBenchmark(graphPath, root, options)`，manifest 路径由 `getRuntimePath(root, 'manifest.json')` 推导，不再从 `path.dirname(graphPath)` 反推 | 解耦 manifest 位置与 out_dir |
| `src/security.js` | 视 `.graph-spec/` 为内部边界，拦截非法输出路径 | 防止路径越界和自包含 |
| `README.md` / `docs/user-manual.md` | 说明 `.graphify_config.json` 与 `--out-dir` 的关系 | 文档与实现一致 |

---

## 10. 文件发现与 watch 约束

### 10.1 文件发现必须忽略 `.graph-spec/`

检测器应将 `.graph-spec/runtime/`、`.graph-spec/tmp/`、`.graph-spec/locks/`、`.graph-spec/logs/` 等运行态目录视为保留目录并强制忽略，不依赖用户忽略文件。  
根目录 `.graphify_config.json` 是唯一需要单独读取和监听的项目配置文件，不通过普通文件扫描参与输入集。

### 10.2 watch 忽略规则与配置热重载

当前实现使用 `ignored: /(^|[\\/])\../`，会把 `.graph-spec/` 整体屏蔽，导致根目录配置的变化无法被监听。

实施时须将 chokidar 的 `ignored` 改为函数形式，对根目录 `.graphify_config.json` 特判放行：

```js
ignored: (filePath) => {
  const configPath = path.join(root, '.graphify_config.json');
  if (path.resolve(filePath) === path.resolve(configPath)) return false;
  return /(^|[\\/])\./.test(path.basename(filePath));
},
```

- `.graph-spec/runtime/**` 的任何写入不触发重建（被 dotdir 规则忽略）
- `.graphify_config.json` 变化触发配置重载并重建
- 其余 dotfile/dotdir 继续忽略

### 10.3 输出目录也要避免自扫

如果 `out_dir` 位于项目根目录内，扫描器仍应避免把输出目录当成输入源，防止图谱自包含和递归膨胀。

---

## 11. 错误处理与约束

### 11.1 缺少配置文件

如果 `.graphify_config.json` 不存在：

- 使用默认输出目录 `graphify-out`
- 自动创建 `.graph-spec/runtime/`
- 不报错

### 11.2 配置文件损坏

如果 `.graphify_config.json` 无法解析：

- 报警告
- 回退到默认输出目录
- 仍继续构建

### 11.3 `out_dir` 非法

如果 `out_dir` 解析后落在 `.graph-spec/` 内部：

- `throw new Error(...)` 硬中断
- 停止构建
- 不创建输出

### 11.4 旧文件残留

如果根目录仍存在旧的 `.graphify_*` 文件：

- 新版本不读取旧临时文件
- 不迁移
- 不自动删除

这是本方案明确接受的 breaking change。

---

## 12. 实施顺序建议

1. 新增 `src/paths.js` 或扩展 `src/config.js`，集中提供状态目录和输出目录解析函数。
2. 保持配置读取路径为根目录 `.graphify_config.json`，仅迁移运行态到 `.graph-spec/runtime/`。
3. 迁移 `manifest.json`、`cache/`、`detect.json` 等内部状态到 `.graph-spec/runtime/`。
4. 更新 detect / watch / hooks / install / cache / manifest / ingest / pipeline 的路径调用。
5. 更新 CLI 帮助文案和文档。
6. 更新测试用例，确保旧根目录文件不再生效。
7. 补充 `.gitignore` 忽略整个 `.graph-spec/` 目录；该目录完全属于本地内部状态，不进入版本控制。

---

## 13. 测试策略

### 13.1 单元测试

应覆盖：

- `getProjectStateDir(root)` 返回 `<root>/.graph-spec`
- `getProjectConfigPath(root)` 返回 `<root>/.graphify_config.json`
- `resolveOutputDir(root, explicitOutDir)` 的优先级
- 配置文件缺失时的默认回退
- 配置文件损坏时的容错
- `out_dir` 不能落在 `.graph-spec/` 内部
- 旧根目录布局存在且缺少 `.graphify_config.json` 时，应显式失败

### 13.2 集成测试

应覆盖：

- `build` 后 `.graph-spec/runtime/` 自动创建
- `build` 后根目录不再出现 `.graphify_detect.json`、`.graphify_python`
- `manifest.json` 和 `cache/` 不再写入 `out_dir`
- 文档转码中间文件（原 `out_dir/converted/`）写入 `runtime/ingest/` 或 `runtime/tmp/`，不再出现在 `out_dir`
- `watch` 不会因 `.graph-spec/runtime/` 的变化自触发
- 修改 `.graphify_config.json` 会触发配置重载并重建
- `install` 会从 `.graphify_config.json` 渲染助手指令
- 无 `.graphify_config.json` 时，`--out-dir` 参数生效，CI 场景可重复构建
- `runBenchmark(graphPath, root)` 能正确从 `getRuntimePath(root, 'manifest.json')` 读到 corpus words

### 13.3 验收测试

在一个临时项目中执行：

```bash
graph-spec build .
```

验收点：

- 根目录只出现 `.graph-spec/`
- `.graphify_config.json` 生效
- `out_dir/` 中只有最终交付物
- 不再出现根目录临时文件

---

## 14. 文档同步要求

此方案落地后，至少需要同步以下文档：

- `README.md`
- `docs/user-manual.md`
- `docs/testing/local-test-checklist.md`
- `docs/reviews/*` 中的功能对照文档

文档里需要明确写出：

- `.graphify_config.json` 是项目级配置，CI 和协作者可以依赖它
- `.graph-spec/runtime/` 是内部状态目录
- `--out-dir` 优先级高于配置文件；CI 可通过 `--out-dir` 临时覆盖
- 根目录旧文件不再支持

---

## 15. 结论

这个方案的核心不是“再加一个目录”，而是把 `graph-spec` 的目录职责重新划清：

- `.graph-spec/` 负责内部状态
- `out_dir/` 负责最终产物
- 根目录只保留用户真正需要看到和编辑的内容

由于用户明确要求“直接改彻底，不做兼容过渡”，本方案以 breaking change 方式实施最合适。这样可以一次性把状态文件、临时文件、缓存和配置收拢干净，后续功能扩展也不会继续污染项目根目录。
