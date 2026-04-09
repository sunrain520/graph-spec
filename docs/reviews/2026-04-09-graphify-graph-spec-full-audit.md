# graphify 与 graph-spec 功能核对结果

本文对 `/Users/kuang/xiaobu/graphify` 与 `/Users/kuang/xiaobu/graph-spec` 做一次全量功能核对，记录当前对齐状态、差异和额外能力。

## 核对基线

| 项目 | 提交点 | 说明 |
|---|---|---|
| `graphify` | `1a50f2d12bb16f3e5620e1f8944b38786de26026` | `origin/v3` 当前 HEAD |
| `graph-spec` | `c1f38f4` | `feat: complete nodejs graph-spec rewrite` |

## 结论摘要

- 核心建图链路已对齐：发现、抽取、构建、聚类、导出、查询都覆盖到了
- `graph-spec` 在 Node.js 生态下增加了 `config`、npm 发布、`graphify` 兼容别名等额外能力，并把 `obsidian`、`neo4j`、`mcp` 做成了 Node CLI 入口
- 主要未 1:1 对齐的内容集中在：
  - `graphify` 的 `--update`、`--cluster-only`、`--no-viz`
  - `graphify` 的 Trae / Trae CN 平台入口
  - `graphify` 的多语言 README 体系
  - `graphify` 的更强安全硬化与部分 hook 细节

## 功能核对总表

| 功能 | `graphify` 状态 | `graph-spec` 状态 | 结论 | 备注 |
|---|---|---|---|---|
| 默认构建流程 `build` / `/graphify .` | 已有 | 已有 | 已对齐 | 都支持对目录执行完整建图流程 |
| 动态输出目录 | 已有 | 已有 | 已对齐 | 都支持项目级配置控制输出目录 |
| 文件发现与分类 | 已有 | 已有 | 已对齐 | 都覆盖代码、文档、论文、图片、Office 文件 |
| 代码抽取 | 已有 | 已有 | 已对齐 | `graph-spec` 用 Node 实现，能力覆盖一致 |
| 多语言支持 | 已有 20 语言 | 已有，含 `.jl` | 已对齐 | `graph-spec` 已补 Julia 和扩展表同步 |
| 文档 / 论文 / 图片 / Office 抽取 | 已有 | 已有 | 已对齐 | 语义抽取与结构化内容导出均已具备 |
| 社区聚类 / god nodes | 已有 | 已有 | 已对齐 | 两边都提供社区分组和中心节点分析 |
| `graph.json` / `GRAPH_REPORT.md` | 已有 | 已有 | 已对齐 | 机器可读图与人类摘要都存在 |
| HTML / SVG / GraphML / Cypher 导出 | 已有 | 已有 | 已对齐 | `graph-spec` 默认输出更完整 |
| `query` / `path` / `explain` | 已有 | 已有 | 已对齐 | 交互式图谱查询能力一致 |
| `benchmark` / token reduction | 已有 | 已有 | 已对齐 | 都用于估算图谱相对原始文件的压缩收益 |
| `wiki` 生成 | 已有 | 已有 | 已对齐 | 都支持生成可导航的 Markdown 知识库 |
| `add` URL ingest | 已有 | 已有 | 已对齐 | 都支持网页、arXiv、Tweet，并保留作者/贡献者元数据 |
| `watch` 自动同步 | 已有 | 已有 | 已对齐 | 图谱随文件变化重建的能力已覆盖 |
| Git hooks | 已有 | 已有 | 已对齐 | 都能安装自动重建钩子 |
| Claude / Codex / OpenCode / OpenClaw / Droid 安装 | 已有 | 已有 | 已对齐 | 辅助文件和指导语已落到位 |
| Trae / Trae CN 安装 | 已有 | 未纳入 | graphify 专有 | 按当前约定不迁移这部分 |
| MCP stdio server | 通过 `python -m graphify.serve` | 通过 `graph-spec mcp` | 已对齐 | 入口形式不同，功能目标一致 |
| Neo4j 导出 / 直推 | 已有 | 已有 | 已对齐 | graphify 用 flag，graph-spec 用命令 + flag |
| Obsidian vault 导出 | 有 | 有 | 已对齐 | 两边都支持导出 Obsidian vault |
| `config` 命令 | 无 | 有 | graph-spec 额外能力 | 用于打印解析后的输出目录 |
| npm 发布产物 | 无 | 有 | graph-spec 额外能力 | `package.json`、`files`、`bin` 结构已面向 npm |
| `--update` / `--cluster-only` / `--no-viz` | 已有 | 无 | 待补齐 | graphify 的细粒度构建开关还没 1:1 迁移 |
| 多语言 README（含日文版） | 已有 | 无 | 未对齐 | graphify 侧有 `README.ja-JP.md`，graph-spec 目前不做多语言套件 |
| Penpax / 展示性 README 更新 | 已有 | 无 | 未对齐 | 这是文档展示改动，不影响核心功能 |
| 更强的 URL / 路径安全硬化 | 已有 | 部分 | 部分对齐 | `graphify` 有更完整 SSRF/私网防护，graph-spec 目前更轻量 |
| 安装指南与平台说明 | 已有 | 已有 | 已对齐 | graph-spec 已提供 README + 用户手册 |

## `graph-spec` 额外能力

| 功能 | `graphify` | `graph-spec` | 说明 |
|---|---|---|---|
| `config` 命令 | 无 | 有 | 可打印解析后的输出目录 |
| npm 包发布 | 无 | 有 | 面向 npm 仓库分发 |
| `graphify` 兼容别名 | 无 | 有 | 保留旧命令名，方便迁移 |

## `graphify` 仍然专有的内容

| 功能 | `graphify` | `graph-spec` | 说明 |
|---|---|---|---|
| Trae / Trae CN | 有 | 无 | 已明确不纳入本轮迁移 |
| `--update` | 有 | 无 | 仍需单独设计增量重建语义 |
| `--cluster-only` | 有 | 无 | graph-spec 目前没有独立聚类-only 模式 |
| `--no-viz` | 有 | 无 | graph-spec 目前默认输出全部图示产物 |
| 多语言 README 体系 | 有 | 无 | graph-spec 先保持单一中文文档主线 |
| `README.ja-JP.md` | 有 | 无 | 目前不做日文化文档分支 |

## 备注

- 本表按“当前功能面”核对，不按实现语言逐行等价
- 对齐结论以用户可见行为为准
- 若后续新增增量，只需从 [`docs/alignment/graphify-alignment-log.md`](/Users/kuang/xiaobu/graph-spec/docs/alignment/graphify-alignment-log.md) 记录的基线继续对照
