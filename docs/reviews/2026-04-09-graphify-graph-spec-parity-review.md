# graphify -> graph-spec 新旧功能对照与决策记录

日期：2026-04-09

本文用于明天逐项审查。目标不是只看“新项目能跑”，而是逐个功能对比旧项目 `graphify` 与新项目 `graph-spec`，把已经完成、适配实现、暂未补齐的内容全部写清楚。

## 结论先行

- 新项目已经完成核心知识图流水线：`detect -> extract -> build -> cluster -> export`
- 输出目录策略已经按旧项目的设计要求重构为动态解析，默认仍是 `graphify-out/`
- npm 发布所需的包元数据、入口、测试脚本和深层导入兼容性已经补齐
- 常用交互入口已经覆盖：`build`、`query`、`path`、`explain`、`benchmark`、`wiki`、`hook`、`install`
- 旧项目的主要入口现在已经补齐到可用状态，后续主要是继续优化实现细节和与上游行为的一致性

## 本轮决策记录

### 1. 包名与 CLI 名称

- 包名：`graph-spec`
- CLI 主入口：`graph-spec`
- 兼容别名：`graphify`
- 决策原因：保留旧命令名的同时，用新包名便于 npm 发布和区分重构版本

### 2. 输出目录策略

按旧项目 `docs/out-dir-design.md` 的约束，继续采用：

- 默认输出目录：`graphify-out/`
- 项目级配置文件：`.graphify_config.json`
- 显式参数优先级最高：`outDir`
- 所有产物都从统一的 `resolveOutputDir()` 派生

### 3. 安装与工作流注入

- `claude` / `codex` / `opencode` / `claw` / `droid` 的安装逻辑保留
- Claude 继续写入 `CLAUDE.md` 和 `.claude/settings.json`
- 其它平台继续写入 `AGENTS.md`
- 决策原因：这部分是旧项目“always-on”能力的核心，适合保留为项目级助手指令

### 4. 导出面

- 保留 `graph.json`、`GRAPH_REPORT.md`、`graph.html`、`graph.svg`、`graph.graphml`、`cypher.txt`
- 新增 `wiki/` 导出，和旧项目保持一致的思路
- 决策原因：旧项目围绕“人读报告 + 代理可遍历 wiki”设计，新项目不应丢失这层可读性

### 5. CLI 适配

- 新增 `path` 与 `explain`，用于最常用的图遍历和节点解释
- `query` 保留 BFS / DFS / budget 行为
- `build` 可选生成 wiki
- 决策原因：这些是低成本、高频率、旧项目中最容易被用户直接使用的能力

## 功能对照表

### A. 核心流水线

| 旧项目能力 | graph-spec 状态 | 说明 |
|---|---|---|
| 文件发现与分类 | 已完成 | 支持代码、文档、论文、图片、Office 文件，支持 ignore 规则 |
| AST/结构提取 | 已完成 | Node.js 版本用启发式多语言提取替代 Python/tree-sitter 主流程 |
| 图构建 | 已完成 | 支持节点、边、超边、跨文件关系 |
| 社区聚类 | 已完成 | 使用 graphology + Louvain |
| 报告输出 | 已完成 | 生成 `GRAPH_REPORT.md` |
| 结构化导出 | 已完成 | JSON / HTML / SVG / GraphML / Cypher |
| 缓存与 manifest | 已完成 | SHA256 缓存 + manifest 持久化 |

### B. 输出目录

| 旧项目能力 | graph-spec 状态 | 说明 |
|---|---|---|
| 默认 `graphify-out/` | 已完成 | 保持不变，符合旧设计 |
| `.graphify_config.json` | 已完成 | 已实现 `out_dir` 读取与解析 |
| 显式 `outDir` 覆盖 | 已完成 | CLI / pipeline / 安装路径都支持 |
| 所有产物统一派生 | 已完成 | `graph.json`、report、cache、manifest、wiki 等都从统一解析结果派生 |

### C. 交互查询

| 旧项目能力 | graph-spec 状态 | 说明 |
|---|---|---|
| `query` | 已完成 | 支持 `--dfs`、`--depth`、`--budget`、`--graph` |
| `path` | 已完成 | 新增，支持按节点名找最短路径 |
| `explain` | 已完成 | 新增，输出节点详情与邻居 |
| `benchmark` | 已完成 | 支持图查询成本估算 |

### D. 工作流注入

| 旧项目能力 | graph-spec 状态 | 说明 |
|---|---|---|
| `hook install/uninstall/status` | 已完成 | Git hook 安装与卸载 |
| `claude install/uninstall` | 已完成 | 写入 `CLAUDE.md` + Claude hook |
| `codex/opencode/claw/droid install/uninstall` | 已完成 | 写入 `AGENTS.md` |

### E. 旧项目外围能力

| 旧项目能力 | graph-spec 状态 | 说明 |
|---|---|---|
| `wiki` | 已完成 | 新增 wiki 导出与 CLI 入口 |
| `serve` / MCP stdio server | 已完成 | 已实现 MCP stdio server 和工具列表 |
| `add` / URL ingest | 已完成 | 已实现 URL 抓取、落盘和自动重建 |
| `obsidian` | 已完成 | 已实现 Obsidian vault、graph.json 和 canvas 导出 |
| `neo4j` / `neo4j-push` | 已完成 | 已实现 Cypher 导出和 Neo4j 直推 |

## 当前已确认的实现选择

### 1. CommonJS + 原生 Node

- 选择 CommonJS，减少发布与运行时复杂度
- 不加编译层，直接以 Node 运行

### 2. npm 发布兼容性

- 增加 `main` / `exports` / `files`
- 保留深层导入兼容性，确保 `require('graph-spec/src/watch')` 这类运行时调用可用

### 3. Wiki 输出

- 采用 `wiki/index.md + community article + god node article` 的结构
- 目标是让 agent 可以直接读 markdown，而不是只读 JSON

### 4. 兼容优先级

- 优先保证旧命令名兼容
- 次级目标是 Node 生态可发布、可测试、可维护
- 目前更关注实现细节是否与旧项目语义一致，而不是再新增一批外围入口

## 明天建议的审查顺序

1. 先审输出目录策略，确认 `.graphify_config.json` 语义
2. 再审 `build/query/path/explain/wiki` 的 CLI 体验
3. 再审安装与 hook 注入
4. 再审导出文件是否覆盖了你关心的消费场景
5. 最后对照实现细节与上游差异

## 需要继续补齐的项

- 主要剩余工作转为实现细节优化与上游同步

## 验证命令

```bash
npm test
npm pack
node bin/graph-spec.js build /path/to/project --wiki
node bin/graph-spec.js query "hello" --graph /path/to/project/graphify-out/graph.json
node bin/graph-spec.js path foo bar --graph /path/to/project/graphify-out/graph.json
node bin/graph-spec.js explain foo --graph /path/to/project/graphify-out/graph.json
```
