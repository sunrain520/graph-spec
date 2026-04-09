# graph-spec 最终产物与目录结构

本文档说明 `graph-spec` 在一次完整构建后，会把哪些产物写到哪个目录，以及这些目录分别承担什么职责。

## 1. 目录分层

`graph-spec` 运行时会涉及三类目录：

1. **项目级输出目录**：`out_dir`
   - 用于存放最终交付物
   - 默认值是 `graphify-out/`
   - 可通过项目根目录的 [`.graphify_config.json`](../.graphify_config.json) 或命令行 `--out-dir` 覆盖

2. **项目内部状态目录**：`.graph-spec/runtime/`
   - 用于保存运行过程中的内部状态、缓存和抓取中间态
   - 不应当手工编辑，也不应当作为最终交付物提交

3. **可选导出目录**
   - `wiki/` 和 Obsidian vault 都属于可选导出
   - 默认挂在 `out_dir` 下面，也可以通过命令行指定其他路径

## 2. 最终交付物写入哪里

最终的图谱交付物全部写入 `out_dir`。

如果没有额外配置，默认目录结构类似：

```text
project-root/
  .graphify_config.json          # 可选：输出目录配置
  .graph-spec/
    runtime/
      manifest.json              # 内部状态
      cache/                     # 内部缓存
      ingest/                    # add 命令抓取内容的内部落点
  graphify-out/
    graph.json
    GRAPH_REPORT.md
    graph.html
    graph.svg
    graph.graphml
    cypher.txt
    wiki/
    obsidian/
```

如果你把 `out_dir` 改成 `docs/contents/graphify-out/`，那上面的最终交付物就会写到：

```text
project-root/
  docs/
    contents/
      graphify-out/
        graph.json
        GRAPH_REPORT.md
        graph.html
        graph.svg
        graph.graphml
        cypher.txt
        wiki/
        obsidian/
```

## 3. 产物速览表

### 3.1 最终交付物

| 文件/目录 | 说明 | 默认位置 |
|---|---|---|
| `graph.json` | 机器可读的图数据，供 `query`、`path`、`explain`、`mcp` 和外部脚本使用 | `<out_dir>/graph.json` |
| `GRAPH_REPORT.md` | 人类可读的图谱报告，包含社区摘要、god nodes、跨社区关系和问题建议 | `<out_dir>/GRAPH_REPORT.md` |
| `graph.html` | 交互式 HTML 视图，可直接浏览节点和社区结构 | `<out_dir>/graph.html` |
| `graph.svg` | 静态 SVG 图，适合插入文档、Markdown、Notion、GitHub | `<out_dir>/graph.svg` |
| `graph.graphml` | GraphML 导出，适合 Gephi、yEd 等图工具 | `<out_dir>/graph.graphml` |
| `cypher.txt` | Neo4j Cypher 脚本，用于手工导入或推送前导出 | `<out_dir>/cypher.txt` |
| `wiki/` | Markdown 知识 wiki 目录，通常包含 `index.md`、社区页、god node 页 | `<out_dir>/wiki/` |
| `obsidian/` | Obsidian vault，包含节点笔记、社区笔记、`graph.canvas`、`.obsidian/graph.json` | `<out_dir>/obsidian/` |

### 3.2 内部运行态

| 文件/目录 | 说明 | 默认位置 |
|---|---|---|
| `manifest.json` | 记录扫描到的文件清单、hash、类型，用于增量构建 | `.graph-spec/runtime/manifest.json` |
| `cache/` | 单文件抽取结果缓存，加速后续构建 | `.graph-spec/runtime/cache/` |
| `ingest/` | `add <url>` 抓取到的原始内容或下载文件，是内部输入，不是最终交付物 | `.graph-spec/runtime/ingest/` |

### 3.3 配置文件

| 文件 | 说明 | 默认位置 |
|---|---|---|
| `.graphify_config.json` | 项目级配置文件，主要用于指定 `out_dir` | 项目根目录 |

## 3. 最终产物清单

### 3.1 `graph.json`

- 机器可读的图数据
- 供 `query`、`path`、`explain`、`mcp`、外部脚本消费
- 也是后续继续导出 wiki、Obsidian、Neo4j 的基础数据

### 3.2 `GRAPH_REPORT.md`

- 面向人阅读的图谱报告
- 包含社区摘要、god nodes、跨社区连接和问题建议
- 适合直接发给用户、放进 PR 或作为项目说明文档

### 3.3 `graph.html`

- 交互式 HTML 视图
- 可直接在浏览器打开
- 适合快速浏览节点和社区结构

### 3.4 `graph.svg`

- 静态 SVG 视图
- 适合插入文档、Markdown、Notion、GitHub

### 3.5 `graph.graphml`

- GraphML 导出
- 适合导入 Gephi、yEd 等图工具

### 3.6 `cypher.txt`

- Neo4j Cypher 脚本
- 可用于手工导入 Neo4j
- 如果启用了 `neo4j push`，也会作为推送前的标准导出格式之一

### 3.7 `wiki/`

- 由 `--wiki` 生成的 Markdown wiki 目录
- 目录里通常包含：
  - `index.md`
  - 社区页面
  - God node 页面
- 默认位置是 `<out_dir>/wiki/`
- 可通过 `--wiki-dir` 改到别的位置

### 3.8 `obsidian/`

- 由 `--obsidian` 生成的 Obsidian vault
- 默认位置是 `<out_dir>/obsidian/`
- 可通过 `--obsidian-dir` 指定其他 vault 路径
- 典型文件包括：
  - 每个节点对应的 Markdown 笔记
  - `_COMMUNITY_*.md` 社区笔记
  - `graph.canvas`
  - `.obsidian/graph.json`

## 4. 内部状态目录 `.graph-spec/runtime/`

这一层是给程序自己用的，不属于最终交付物。

### 4.1 `manifest.json`

- 记录本次项目扫描到的文件清单、hash 和类型
- 用于增量构建
- 位置：`.graph-spec/runtime/manifest.json`

### 4.2 `cache/`

- 缓存单个文件的抽取结果
- 用于加速后续构建和增量更新
- 位置：`.graph-spec/runtime/cache/`

### 4.3 `ingest/`

- `add <url>` 抓取到的原始内容或下载文件
- 是内部输入，不是最终交付物
- 位置：`.graph-spec/runtime/ingest/`

## 5. 输出目录与配置优先级

输出目录的优先级如下：

1. 命令行 `--out-dir`
2. 项目根目录 `.graphify_config.json` 里的 `out_dir`
3. 默认值 `graphify-out/`

也就是说：

```bash
graph-spec build . --out-dir docs/contents/graphify-out
```

会比 `.graphify_config.json` 里的配置优先。

## 6. 哪些文件不属于最终交付物

以下内容不算最终产物：

- `.graph-spec/runtime/manifest.json`
- `.graph-spec/runtime/cache/`
- `.graph-spec/runtime/ingest/`
- 项目根目录的 `.graphify_config.json`

这些文件是运行态和配置态，不是面向读者或下游工具的交付物。

## 7. 推荐的理解方式

可以把 `graph-spec` 的输出分成三层：

- **输入层**：项目源文件、URL 抓取内容
- **中间层**：`.graph-spec/runtime/`
- **交付层**：`out_dir`

只要记住这条分层，后续看任何命令都会比较清楚：

- `build` 负责把源文件变成图谱交付物
- `wiki` 负责把图谱交付物变成可浏览的知识 wiki
- `obsidian` 负责把图谱交付物变成 Obsidian vault
- `neo4j` 负责把图谱交付物变成图数据库导入脚本

## 8. 命令与产物对应关系

| 命令 | 主要产物 | 说明 |
|---|---|---|
| `graph-spec build` | `graph.json`、`GRAPH_REPORT.md`、`graph.html`、`graph.svg`、`graph.graphml`、`cypher.txt` | 完整构建流程，默认会把交付物写入 `out_dir` |
| `graph-spec add <url>` | 上述 `build` 产物 + `.graph-spec/runtime/ingest/` 下的抓取内容 | 先抓取 URL，再重建图谱；抓取内容属于内部输入，不是最终交付物 |
| `graph-spec query` | 终端输出 | 基于已有 `graph.json` 做局部查询，不新增文件 |
| `graph-spec path` | 终端输出 | 计算两个节点之间的最短路径，不新增文件 |
| `graph-spec explain` | 终端输出 | 解释单个节点，不新增文件 |
| `graph-spec wiki` | `<out_dir>/wiki/` | 生成可浏览的 Markdown wiki |
| `graph-spec obsidian` | `<out_dir>/obsidian/` | 生成 Obsidian vault |
| `graph-spec neo4j` | `<out_dir>/cypher.txt` 或直接推送到 Neo4j | 生成导入脚本，或直接写入图数据库 |
| `graph-spec mcp` | 终端服务 | 启动 MCP stdio server，不落盘新的图谱文件 |

### 8.1 额外说明

- `build` 是所有产物的基础入口，其他导出大多都依赖 `graph.json`。
- `wiki` 和 `obsidian` 默认会放在 `out_dir` 下面，但也可以通过参数改到别的目录。
- `query`、`path`、`explain`、`mcp` 主要是消费产物，不负责生成新的最终文件。

## 9. 目录树示意

下面是一次典型运行后可能看到的目录结构示意。实际文件会随命令参数、输入类型和是否启用可选导出而变化。

```text
project-root/
  .graphify_config.json
  .graph-spec/
    runtime/
      manifest.json
      cache/
      ingest/
  graphify-out/                      # 或者你配置的自定义 out_dir
    graph.json
    GRAPH_REPORT.md
    graph.html
    graph.svg
    graph.graphml
    cypher.txt
    wiki/
      index.md
      Community_A.md
      God_Node_X.md
    obsidian/
      Node_A.md
      Node_B.md
      _COMMUNITY_*.md
      graph.canvas
      .obsidian/
        graph.json
```

### 9.1 目录职责

| 目录 | 职责 |
|---|---|
| 项目根目录 | 存放源码、配置文件和入口文档 |
| `.graph-spec/runtime/` | 存放内部状态、缓存和抓取中间态 |
| `out_dir` | 存放最终交付物 |
| `out_dir/wiki/` | 存放可浏览的知识 wiki |
| `out_dir/obsidian/` | 存放 Obsidian vault |

## 10. 数据流示意

```text
源文件 / URL
  ↓
detect
  ↓
.graph-spec/runtime/manifest.json
  ↓
extract / build
  ↓
out_dir/graph.json
  ↓
├─ GRAPH_REPORT.md
├─ graph.html
├─ graph.svg
├─ graph.graphml
├─ cypher.txt
├─ wiki/
└─ obsidian/
```

### 10.1 这条流里最容易混淆的点

- `.graph-spec/runtime/` 是内部工作区，不是最终结果
- `graph.json` 是最终图谱数据，是后续导出的基础
- `wiki/`、`obsidian/`、`cypher.txt` 都是从 `graph.json` 再派生出来的产物
- `add <url>` 只是把外部内容放进内部 ingest 目录，最终还是要经过 `build` 才会变成交付物
