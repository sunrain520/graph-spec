# graph-spec

`graph-spec` 是 `graphify` 的 Node.js 重构版，用于把代码库、文档库、论文、图片和 Office 文件转换成可查询的知识图，并且可以直接发布到 npm。

## 特性

- 支持 `graphify` 兼容别名
- 支持动态输出目录，默认仍是 `graphify-out/`
- 支持代码、文档、图片、PDF、Office 文件的混合分析，代码解析覆盖 `.jsx`、`.tsx`、`.mm`、`.jl` 等常见扩展
- 提供 `build`、`add`、`query`、`path`、`explain`、`benchmark`、`wiki`、`obsidian`、`neo4j`、`mcp`、`hook`、`install` 等常用入口
- 支持 `CLAUDE.md`、`AGENTS.md` 和 Claude Code hook 注入
- 支持 JSON、HTML、SVG、GraphML、Cypher、Wiki、Obsidian 导出，以及 Neo4j 直推

## 你能得到什么

- **God nodes**：图里最中心的概念，能帮你快速找到“什么是全局枢纽”
- **Surprising connections**：按结构和语义排序的跨文件连接，帮助你发现不明显的关联
- **Suggested questions**：图谱适合继续追问的问题，方便把探索往前推进
- **The why**：代码注释、设计说明和文档里的 rationale 会被抽成独立节点
- **Confidence scores**：推断出来的边会保留置信度，方便判断哪些是结构事实，哪些是模型推断
- **Semantic links**：没有直接调用关系、但语义相近的概念也可以被连起来
- **Hyperedges**：需要 3 个及以上节点表达的关系会保留为超边
- **Token benchmark**：可用于衡量图谱查询相对原始文件的上下文压缩效果
- **Auto-sync**：配合 `watch` 可以让图谱随着代码变化自动更新
- **Git hooks**：可选安装 post-commit 和 post-checkout 钩子，减少手动重建

## 安装

### 本地开发 / 未发布时

如果你是在本地仓库里直接试命令，先把 CLI 链接到当前 shell：

```bash
npm link
graph-spec claude install
```

也可以不做全局链接，直接执行入口文件：

```bash
node ./bin/graph-spec.js claude install
```

如果仓库里已经完成 `npm install`，也可以用：

```bash
npx graph-spec claude install
```

### 发布到 npm 后

```bash
npm install graph-spec
```

全局安装：

```bash
npm install -g graph-spec
```

## 快速开始

```bash
graph-spec build .
graph-spec add "https://example.com/article"
graph-spec query "authentication flow"
graph-spec path login token
graph-spec explain auth
graph-spec wiki
graph-spec obsidian
graph-spec neo4j
graph-spec mcp
```

兼容旧命令：

```bash
graphify build .
graphify query "authentication flow"
```

## URL 抓取与入图

`graph-spec add <url>` 会把外部内容抓取到 `.graph-spec/runtime/ingest/`，然后立刻重建图谱。

它支持这些常见来源：

- 普通网页：抓取 HTML 正文并转成 Markdown
- arXiv：提取论文标题、作者和摘要
- PDF：直接下载原文件，供后续扫描
- 图片：下载到内部 ingest 目录，后续可以被图谱流程识别
- X / Twitter：尽量抓取 oEmbed 信息和可读文本

示例：

```bash
graph-spec add "https://example.com/article"
graph-spec add "https://arxiv.org/abs/2401.00001"
graph-spec add "https://example.com/paper.pdf"
```

执行后，图谱构建会自动把 `.graph-spec/runtime/ingest/` 里的内容纳入检测与抽取，所以你通常不需要再手动运行 `build`。如果你想重新全量构建，也可以直接再跑一次：

```bash
graph-spec build .
```

## 与 LLM 协作

`graph.json` 不适合一次性塞进 prompt。更稳妥的工作流是先看摘要，再按需提取局部子图：

1. 先读 `graphify-out/GRAPH_REPORT.md`，获取 god nodes、社区和高层结构。
2. 再用 `graph-spec query` 把某个具体问题收窄成小子图。
3. 把这段精简输出交给 LLM 或支持 MCP 的客户端。

例如：

```bash
graph-spec query "show the auth flow" --graph graphify-out/graph.json
graph-spec query "what connects DigestAuth to Response?" --graph graphify-out/graph.json
```

如果你的客户端支持 tool calling 或 MCP，也可以直接连接 `graph.json`，让它把图谱当作结构化上下文来用：

```bash
graph-spec mcp graphify-out/graph.json
```

## 输出目录

默认输出目录是 `graphify-out/`。

如果需要动态指定输出目录，在项目根目录创建 `.graphify_config.json`。例如：

```json
{
  "out_dir": "docs/contents/graphify-out"
}
```

这里的 `out_dir` 是相对于项目根目录解析的，所以上面的配置会写到：

```text
./docs/contents/graphify-out/
```

如果你想临时覆盖配置，可以直接传命令行参数：

```bash
graph-spec build . --out-dir docs/contents/graphify-out
```

优先级是：`--out-dir` 高于 `.graphify_config.json`。

之后构建、查询、缓存、hook 和安装都会使用这个目录。

## 常用命令

```bash
graph-spec build [root]           # 构建知识图
graph-spec add <url>              # 抓取 URL 到 .graph-spec/runtime/ingest/ 并重建图谱
graph-spec query "<question>"     # 查询 graph.json
graph-spec path <source> <target>  # 查询最短路径
graph-spec explain <node>         # 查看节点详情与邻居
graph-spec benchmark [graph.json]  # 评估 token 降幅
graph-spec wiki [graph.json]       # 生成 wiki 文档
graph-spec obsidian [graph.json]   # 生成 Obsidian vault
graph-spec neo4j [graph.json]      # 生成 Neo4j Cypher
graph-spec mcp [graph.json]        # 启动 MCP stdio server
graph-spec hook install           # 安装 git hooks
graph-spec install                # 安装助手配置
graph-spec claude install         # 写入 CLAUDE.md + Claude hook
graph-spec codex install          # 写入 AGENTS.md
```

## 文档

- [用户手册](./docs/user-manual.md)
- [最终产物与目录结构](./docs/output-artifacts.md)
- [本地源码安装手册](./docs/local-source-installation.md)
- [本地测试清单](./docs/testing/local-test-checklist.md)

## 开发

```bash
npm test
npm pack
```
