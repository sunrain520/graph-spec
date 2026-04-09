## graph-spec

This project has a graph-spec knowledge graph at /Users/kuang/xiaobu/graph-spec/docs/contents/graphify-out/.

Rules:
- Before answering architecture or codebase questions, read /Users/kuang/xiaobu/graph-spec/docs/contents/graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If /Users/kuang/xiaobu/graph-spec/docs/contents/graphify-out/wiki/index.md exists, navigate it instead of reading source files
- After modifying code files in this session, run `node -e "require('graph-spec/src/watch')._rebuildCode(process.cwd())"` to keep the graph current

<!-- spec-first:lang:start -->
## 语言与治理策略（由 spec-first 管理）

**语言设置：** `zh`

### 语言规则
- 回复、状态更新、生成文档、评审意见、计划说明等所有自然语言输出使用**中文**
- 允许混用英文技术术语，不要求强行翻译常见技术词
- 代码标识符（变量、函数、类、模块、文件名中的技术标识）保持英文
- 新增代码注释使用中文，简洁清晰，不写空洞注释
- 代码、命令、路径、配置键、环境变量名、API 名称、协议名等技术标识不因语言偏好而被翻译

### Changelog 治理规则
**代码变动铁律（无例外）**
- 任何对项目源码的新增、删除、修改，必须同步在项目根目录 `CHANGELOG.md` 中添加一条记录
- 无此记录的代码变动，一律拒绝生成
- 记录格式以仓库现行格式为准
- **示例：** `- vX.Y.Z YYYY-MM-DD 作者: 一句话摘要`
- 用户可见变更在末尾追加 `(user-visible)`
<!-- spec-first:lang:end -->
