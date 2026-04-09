# graph-spec 重构设计

> 目标：将 `/Users/kuang/xiaobu/graphify` 复刻为一个可发布到 npm 的 Node.js 项目，同时保留原项目的核心体验、输出结构和技能安装能力。

**Goal:** 用 Node.js 重新实现 graphify 的知识图谱管线、CLI、安装器、导出器和查询能力，并提供 npm 发布和跨平台可用性。

**Architecture:** 采用单包结构，源代码放在 `src/`，以 CommonJS 运行时为主，避免发布时引入额外编译门槛。核心管线拆为 `detect -> extract -> build -> cluster -> analyze -> report -> export`，外围能力拆为 `cache / security / ingest / serve / watch / hooks / benchmark / manifest / install`。对原 Python 版做适配重构：主包名与 CLI 使用 `graph-spec`，同时保留 `graphify` 兼容别名；默认输出目录保持 `graphify-out/`，但通过项目级配置和显式参数动态覆盖，兼容原项目的输出语义与迁移成本。

**Tech Stack:** Node.js 20+、CommonJS、`commander`、`@kreuzberg/tree-sitter-language-pack`、`graphology`、`graphology-communities-louvain`、`chokidar`、`ignore`、`fast-glob`、`gray-matter`、`pdfjs-dist`、`mammoth`、`xlsx`、`node:test`。

---

## 1. 迁移原则

- 以“功能对齐 + Node 生态适配”为准，不追求 Python 级别逐行翻译。
- 先保住主路径：文件发现、代码抽取、图构建、聚类、报告、HTML/JSON 导出。
- 再补外围：查询、serve、watch、hook、install、ingest、benchmark、wiki、MCP。
- 任何新增代码都必须配套测试和 `CHANGELOG.md` 记录。

## 2. 兼容策略

- CLI 主命令：`graph-spec`
- 兼容别名：`graphify`
- 输出目录默认：`graphify-out/`
- 兼容读取：`graphify-out/`
- 忽略文件：优先 `.graphspecignore`，同时兼容 `.graphifyignore`
- 助手安装：生成 `CLAUDE.md`、`AGENTS.md`、`settings.json` 和对应 skill 文件
- 配置文件：`.graphify_config.json`，其中 `out_dir` 可将产物根目录动态切换到任意路径

## 3. 核心架构

### 3.1 文件发现

`src/detect.js` 负责遍历目标目录、识别代码/文档/论文/图片/Office 文件、处理忽略规则、排除敏感文件，并生成运行清单。它要支持符号链接、增量更新和缓存目录定位。

### 3.2 代码抽取

`src/extract.js` 使用 `@kreuzberg/tree-sitter-language-pack` 解析代码文件。它将树解析结果转成统一的节点/边结构，优先抽取：

- 文件级节点
- 类、函数、方法、导入、调用、继承、实现
- rationale 注释和 docstring
- 跨文件引用与推断边

语言支持按原项目对齐到 19 种，并保留语言注册表以便后续增减。

### 3.3 文档、论文和图片

文档和论文以文本抽取为主，图片和复杂内容通过可插拔语义提取器处理。语义提取器默认走 provider 接口，支持 OpenAI/Anthropic 兼容模型；如果未配置模型，退化为结构化文本摘要，保证离线可运行。

### 3.4 图模型

图层使用 `graphology` 表示无向图，节点和边属性保留原始来源、置信度、关系类型和可视化元数据。社区检测采用 Louvain 方案作为默认实现，并允许后续替换为 Leiden 兼容层。

### 3.5 分析与导出

分析层输出：

- `god_nodes`
- `surprising_connections`
- `suggest_questions`

导出层输出：

- `graph.json`
- `GRAPH_REPORT.md`
- `graph.html`
- `graph.svg`
- `graph.graphml`
- `cypher.txt`
- Obsidian vault
- wiki 页面
- Canvas 文件

### 3.6 运行时服务

`serve` 与 `mcp` 共享同一份图查询内核，支持 BFS/DFS、节点详情、邻居查询、最短路径、社区查询和图统计。`watch` 与 git hooks 复用同一个代码文件重建流程，避免重复实现。

### 3.7 输出目录解析

所有产物路径都必须经过单一解析函数计算：

- 默认读取目标目录下的 `.graphify_config.json`
- 如果其中存在 `out_dir`，就把该目录作为产物根目录
- 如果调用方显式传入 `outDir`，则优先级最高
- 如果配置文件缺失或解析失败，回退到 `graphify-out/`

这条规则必须同时作用于 `detect / watch / hooks / install / export / serve / benchmark / cache`，避免不同模块各自写死路径。

## 4. 数据格式

统一抽取输出采用：

```json
{
  "nodes": [
    {
      "id": "unique_id",
      "label": "display label",
      "source_file": "path/to/file",
      "source_location": "L42",
      "file_type": "code"
    }
  ],
  "edges": [
    {
      "source": "node_a",
      "target": "node_b",
      "relation": "calls",
      "confidence": "EXTRACTED"
    }
  ],
  "hyperedges": []
}
```

## 5. 风险与处理

- Tree-sitter 语言包下载失败：提供缓存目录、预下载命令和无网络降级。
- LLM 不可用：语义抽取退化为文本摘要，不阻塞图构建。
- 大仓库性能：采用 SHA256 缓存和按文件增量重建。
- 跨平台脚本差异：脚本只使用 Node 标准库和可移植 shell 模板。
- npm 发布稳定性：不依赖编译型原生扩展作为必需运行时依赖。
- 输出目录灵活化：统一通过 `resolveOutputDir()` 解析，防止局部模块继续写死 `graphify-out/`。

## 6. 验收标准

- `npm test` 通过。
- `npm pack` 成功。
- CLI 可完成主路径与安装路径。
- 典型仓库能生成图、报告和 HTML。
- 输出结构与原 Python 版一致到足以替换使用。
