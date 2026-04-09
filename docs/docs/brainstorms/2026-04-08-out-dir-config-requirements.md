---
date: 2026-04-08
topic: out-dir-config
---

# Custom Output Directory via Config File

## Problem Frame

graphify 默认将所有产物写入被分析目录下的 `graphify-out/`。对于有固定目录约定的团队（如将知识图谱放在 `docs/contents/graphify-out/`），每次运行都需要手动处理产物位置，或不得不更改默认目录。

直接改默认目录会增加上游 merge 冲突概率。在 skill.md 执行模板里做路径替换会导致 LLM 遗漏替换，且每次上游更新 skill.md 都产生大量冲突。

**目标用户**：所有 graphify-leo 用户，包括团队协作场景。

## Requirements

**配置文件**

- R1. 用户可在被分析目录根目录放置 `.graphify_config.json`，内含 `"out_dir"` 字段来指定输出目录
- R2. `out_dir` 值为相对路径时，相对于被分析目录（`target_root`）解析；为绝对路径时直接使用
- R3. 配置文件不存在、字段缺失或 JSON 解析失败时，均回退到默认 `graphify-out`，不抛出异常，JSON 解析失败时打印警告
- R4. 配置文件设计为团队共享，应提交到 git（不加入 `.gitignore`）

**路径解析**

- R5. 所有产物路径（`graph.json`、`GRAPH_REPORT.md`、`manifest.json`、`memory/`、`converted/`、`cache/`、`obsidian/`、`wiki/`、`needs_update` 等）均从同一解析函数 `resolve_output_dir` 派生
- R6. `resolve_output_dir` 的优先级：显式 `out_dir` 参数 > `.graphify_config.json` > 默认 `graphify-out`
- R7. `detect.py` 中 `memory/` 目录需继续被纳入扫描语义；`converted/` 需继续被排除为内部中间产物，两者均随 `out_dir` 动态确定

**skill.md 与上游兼容性**

- R8. `skill.md` 及各平台变体（`skill-codex.md` 等）的执行模板**零改动**，路径由 Python 函数内部读取配置决定，LLM 无需感知
- R9. 配置生效后，`/graphify .`、`/graphify . --update`、`/graphify . --watch` 等所有 skill 调用自动使用配置中的 `out_dir`

**watch 模式**

- R10. `python3 -m graphify.watch <path>` 自动读取配置文件决定输出目录
- R11. `python3 -m graphify.watch <path> --out-dir <dir>` 可显式覆盖配置文件（适合一次性运行不同目录的场景）
- R12. 监听器过滤逻辑随 `out_dir` 动态调整，不把自定义输出目录内的变化当作输入事件

**安装命令与持久化模板**

- R13. `graphify claude install`、`graphify codex install` 等安装命令自动读取配置文件，将 `out_dir` 渲染进 `CLAUDE.md`、`.claude/settings.json`、`AGENTS.md` 等模板
- R14. 安装命令新增可选 `--out-dir` 参数，可显式覆盖配置文件
- R15. 未设置配置且未传参时，安装模板回退到默认 `graphify-out`

**文档**

- R16. `README.md` 和 `README.zh-CN.md` 新增"自定义输出目录"章节，说明 `.graphify_config.json` 的格式、位置和典型用法

## Success Criteria

- 用户在项目根目录创建 `.graphify_config.json` 后，无需改动任何命令，`/graphify .` 的所有产物自动写入配置的目录
- 配置文件可提交到 git，团队所有成员共享同一输出目录约定
- `git merge upstream/v3` 后 skill.md 零冲突或只有非执行内容冲突
- 无配置文件时行为与现有版本完全一致

## Scope Boundaries

- 第一阶段不改造 git hook bash 脚本内容（`_HOOK_SCRIPT` / `_CHECKOUT_SCRIPT`），已安装的 hook 仍面向 `graphify-out`
- 不支持多目录场景（同一项目内不同子目录使用不同 `out_dir`）
- 不引入除 `.graphify_config.json` 以外的配置层（无环境变量、无 CLI 全局配置）

## Key Decisions

- **配置文件而非 skill 参数**：skill 参数需要 LLM 将值替换进 Python 内联字符串，不可靠；Python 函数内部读取文件是确定性行为
- **团队共享（提交 git）**：面向所有用户，团队协作场景应共享输出目录约定
- **相对于 target_root 解析**：产物与被分析目录在同一棵目录树下，符合用户直觉
- **skill.md 零改动**：减少上游 merge 冲突是核心约束，Python 内部读取是唯一满足此约束的方案

## Dependencies / Assumptions

- 上游 `safishamsi/graphify` 的 `v3` 分支不会引入同名 `.graphify_config.json` 或 `graphify/config.py`，否则需合并时人工判断

## Outstanding Questions

### Resolve Before Planning

- 无

### Deferred to Planning

- [Affects R7][Technical] `detect.py` 中 `detect()` 函数签名是否需要新增 `out_dir` 参数，还是在函数内部调用 `resolve_output_dir(root)` 即可
- [Affects R12][Technical] `watch.py` 事件过滤从 `"graphify-out" in path.parts` 改为基于 `out_dir` 的判断，需确认 Path 比较方式（`path.is_relative_to(out_dir)` vs `out_dir in path.parents`）
- [Affects R13][Needs research] `graphify claude install` 当前不接受位置参数；新增 `--out-dir` 时需确认 argparse 是否与现有子命令结构兼容

## Next Steps

→ `/spec:plan` 进行结构化实施规划
