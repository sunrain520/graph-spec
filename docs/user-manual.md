# graph-spec 用户手册

本文面向最终使用者，说明 `graph-spec` 如何安装、构建知识图、查询结果、配置输出目录，以及如何把图谱接入自己的工作流和工具链。

## 1. 这是什么

`graph-spec` 会扫描一个目录，把代码、文档、论文、图片和 Office 文件整理成一张知识图，然后输出成多个可消费的文件：

- `graph.json`：机器可读的图数据
- `GRAPH_REPORT.md`：面向人类的一页摘要
- `graph.html`：可交互的 HTML 报告
- `graph.svg`：静态图示
- `graph.graphml`：供 Gephi / yEd 等工具使用
- `cypher.txt`：供 Neo4j 使用的 Cypher 语句
- `wiki/`：面向 agent 的 markdown 知识库
- `obsidian/`：Obsidian vault

## 2. 安装

### 本地安装

```bash
npm install graph-spec
```

### 全局安装

```bash
npm install -g graph-spec
```

安装后可直接使用：

```bash
graph-spec --help
```

## 3. 最小工作流

### 3.1 构建知识图

```bash
graph-spec build .
```

默认会在当前目录下生成 `graphify-out/`。

### 3.2 查询知识图

```bash
graph-spec query "authentication flow"
```

`query` 会沿着图谱走出一个局部子图，适合回答“某个东西和什么相关”的问题，而不是一次性展开整份仓库。

### 3.3 查看最短路径

```bash
graph-spec path login token
```

### 3.4 查看节点说明

```bash
graph-spec explain auth
```

### 3.5 生成 wiki

```bash
graph-spec wiki
```

`wiki` 更适合做成可持续浏览的知识库，让人和 agent 都能按链接跳转，而不是重新扫描原始文件。

### 3.6 抓取 URL 并加入图谱

```bash
graph-spec add "https://example.com/article"
```

会把网页保存到 `raw/`，然后自动重建知识图。

### 3.7 生成 Obsidian vault

```bash
graph-spec obsidian
```

会输出：

- 每个节点一个 Markdown 笔记
- 每个社区一个 `_COMMUNITY_*.md`
- `.obsidian/graph.json`
- `graph.canvas`

### 3.8 导出 Neo4j

```bash
graph-spec neo4j
```

这会生成 `cypher.txt`，你可以手动导入 Neo4j。

如果要直接推送到 Neo4j：

```bash
graph-spec neo4j push --neo4j-push bolt://localhost:7687 --neo4j-user neo4j --neo4j-password <password>
```

### 3.9 启动 MCP server

```bash
graph-spec mcp
```

这会启动一个 stdio MCP server，供 Claude 或其它 MCP 客户端直接连接。

如果你想让 LLM 直接消费图谱，比较稳妥的方式是先看摘要，再按需取局部：

1. 先读 `graphify-out/GRAPH_REPORT.md`，了解 god nodes、社区和整体结构。
2. 再用 `query` 把具体问题收窄成一个小子图。
3. 把精简后的输出交给 LLM，而不是一次性塞入整份 `graph.json`。

## 4. 输出目录

### 默认目录

默认输出目录仍然是：

```text
graphify-out/
```

### 动态指定目录

如果你想把输出放到别的地方，在项目根目录创建 `.graphify_config.json`：

```json
{
  "out_dir": "docs/contents/graphify-out"
}
```

支持相对路径和绝对路径。所有派生产物都会基于这个目录生成。

### 目录内会有哪些文件

- `graph.json`
- `GRAPH_REPORT.md`
- `graph.html`
- `graph.svg`
- `graph.graphml`
- `cypher.txt`
- `wiki/`
- `cache/`
- `manifest.json`

## 5. 命令参考

### `build`

```bash
graph-spec build [root]
```

对指定目录执行完整构建流程。

可用参数：

- `--out-dir <path>`：显式覆盖输出目录
- `--wiki`：构建时顺便生成 wiki
- `--wiki-dir <path>`：指定 wiki 输出位置

### `query`

```bash
graph-spec query "<question>" [--dfs] [--depth N] [--budget N] [--graph path]
```

说明：

- `--dfs`：深度优先遍历
- `--depth`：遍历深度
- `--budget`：输出预算，单位按 token 估算
- `--graph`：指定 `graph.json` 路径

### `path`

```bash
graph-spec path <source> <target> [--graph path]
```

用于查找两个节点之间的最短路径。

### `explain`

```bash
graph-spec explain <node> [--graph path]
```

输出节点详情、来源文件、社区信息和邻居列表。

### `benchmark`

```bash
graph-spec benchmark [graph.json]
```

用于估算查询图谱相比直接读原始文件能节省多少 token。

### `wiki`

```bash
graph-spec wiki [graph.json] [wiki-output-dir]
```

输出一个可被 agent 直接遍历的 markdown 知识库。

### `obsidian`

```bash
graph-spec obsidian [graph.json] [obsidian-output-dir]
```

输出一个 Obsidian vault，适合直接打开和浏览。

### `neo4j`

```bash
graph-spec neo4j [graph.json] [cypher-output-file]
```

如果使用 `push` 子命令，则可以直接推送到 Neo4j：

```bash
graph-spec neo4j push [graph.json] [neo4j-uri]
```

推送时可通过这些参数指定认证信息：

- `--neo4j-user`
- `--neo4j-password`
- `--neo4j-push`

### `hook`

```bash
graph-spec hook install
graph-spec hook uninstall
graph-spec hook status
```

用于安装或移除 git hooks。

### `install`

```bash
graph-spec install [--platform claude|codex|opencode|claw|droid]
```

用于安装平台相关的助手指令文件。

### 平台命令

```bash
graph-spec claude install
graph-spec claude uninstall
graph-spec codex install
graph-spec codex uninstall
graph-spec opencode install
graph-spec opencode uninstall
graph-spec claw install
graph-spec claw uninstall
graph-spec droid install
graph-spec droid uninstall
```

### `mcp`

```bash
graph-spec mcp [graph.json]
```

启动 MCP stdio server 后，可以把它接到 Claude Desktop 或其它 MCP 客户端。

## 6. 支持的输入类型

### 代码

支持常见代码文件，例如：

- `.js`
- `.ts`
- `.py`
- `.go`
- `.rs`
- `.java`
- `.c`
- `.cpp`
- `.rb`
- `.cs`
- `.kt`
- `.scala`
- `.php`
- `.swift`
- `.lua`
- `.zig`
- `.ps1`
- `.ex`
- `.exs`
- `.m`
- `.mm`
- `.jsx`
- `.tsx`
- `.jl`

### 文档和媒体

- Markdown / 文本
- PDF
- 图片
- Word / Excel

### 忽略规则

支持 `.graphifyignore` 和 `.gitignore` 风格的排除规则。

示例：

```gitignore
node_modules/
dist/
vendor/
*.generated.js
```

## 7. 助手集成

### Claude Code

```bash
graph-spec claude install
```

会写入：

- `CLAUDE.md`
- `.claude/settings.json`

### Codex / OpenCode / OpenClaw / Factory Droid

```bash
graph-spec codex install
graph-spec opencode install
graph-spec claw install
graph-spec droid install
```

会写入项目根目录的 `AGENTS.md`。

## 8. Git hooks

安装后会在 git 仓库里放入自动重建钩子：

```bash
graph-spec hook install
```

卸载：

```bash
graph-spec hook uninstall
```

查看状态：

```bash
graph-spec hook status
```

## 9. 常见问题

### 图谱没有生成

检查以下事项：

- 当前目录是否存在可扫描文件
- 是否被 `.graphifyignore` 或 `.gitignore` 排除了
- 输出目录是否有写权限

### 查询没有结果

尝试：

- 改成更具体的关键词
- 使用 `graph-spec path` 或 `graph-spec explain`
- 先确认已经执行过 `graph-spec build`

### 想换输出目录

在项目根目录添加 `.graphify_config.json`，然后重新执行构建即可。

### 需要重新打包发布

```bash
npm test
npm pack
```

## 10. 已完成的扩展入口

上面这些扩展入口已经可以使用：

- `add`：抓取 URL 并加入图谱
- `obsidian`：生成 Obsidian vault
- `neo4j`：生成 Cypher，或直接推送到 Neo4j
- `mcp`：启动 MCP stdio server

如果你后续只想看核心建图功能，也可以只用 `build / query / wiki` 这一组命令。
