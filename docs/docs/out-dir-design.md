# 输出目录改造技术方案

## 背景

当前项目默认将产物输出到被分析目录下的 `graphify-out/`。该约定广泛存在于 Python 代码、git hooks、security 规则、skill 文档和测试中。

如果直接把默认目录改成 `docs/contents/graphify-out/`，虽然能满足当前使用习惯，但会显著增加未来与上游项目合并时的冲突概率。

本方案在两个约束下寻找最优解：

1. **可合并性**：默认行为与上游保持一致，skill.md 执行模板不改动
2. **稳定性**：自定义路径由 Python 函数内部读取配置决定，不依赖 LLM 行为

因此选择：

- 默认输出目录仍保持 `graphify-out/`
- 新增项目级配置文件 `.graphify_config.json`，一次设置，所有后续运行自动生效
- Python 函数内部读取配置，skill.md 执行模板**零改动**

## 目标

- 保持默认行为不变：`/graphify .` 未配置时仍输出到 `graphify-out/`
- 新增配置文件机制：项目根目录放 `.graphify_config.json` 后自动切换输出目录
- 所有派生产物都随输出根目录变化
- 将输出路径从分散硬编码收敛为统一解析函数
- skill.md 执行模板保持与上游同步，不引入上游合并冲突

## 非目标

- 不修改默认目录为 `docs/contents/graphify-out`
- 不在第一阶段改造 git hook bash 脚本内容
- 不为了这次改造大规模重构主流程之外的业务逻辑

## 设计原则

- 配置读取在 Python 内部完成，不依赖 LLM 行为
- 所有输出路径通过 `resolve_output_dir` 单一入口解析
- 默认值保持与上游一致
- skill.md 及各平台变体执行模板不改动，上游更新可直接 merge
- 文档、测试、代码行为保持一致

## 产物矩阵

下面所有路径都必须从 `out_dir` 派生，不能继续写死：

- `graph.json`
- `GRAPH_REPORT.md`
- `graph.html`
- `graph.svg`
- `graph.graphml`
- `cypher.txt`
- `cost.json`
- `manifest.json`
- `needs_update`
- `wiki/`
- `obsidian/`
- `memory/`
- `cache/`
- `converted/`

## 架构前提

> **`/graphify` 是 AI 对话中的 slash command（skill 指令），不是 shell 命令。**
>
> - 用户在对话窗口输入 `/graphify .`，LLM 执行 skill.md 中的 Python 片段
> - skill.md 的 Python 片段调用 Python 库函数（`detect`、`watch` 等）
> - Python 函数**内部**调用 `resolve_output_dir`，自动读取 `.graphify_config.json`
> - skill.md 执行模板不需要任何改动，LLM 无需感知输出目录配置

**各组件的 `out_dir` 来源**：

| 组件 | `out_dir` 来源 |
|------|---------------|
| skill.md 驱动的主构建 | Python 函数内部读 `.graphify_config.json` |
| `python3 -m graphify.watch` | 优先读 `.graphify_config.json`，`--out-dir` 参数可覆盖 |
| `graphify claude install` 等安装命令 | 读 `.graphify_config.json`，`--out-dir` 参数可覆盖 |
| git hook（第二阶段） | 读 `.graphify_config.json` |

## 配置文件规范

**位置**：被分析目录的根目录（与 `graphify-out/` 同级）

**文件名**：`.graphify_config.json`

**格式**：

```json
{
  "out_dir": "docs/contents/graphify-out"
}
```

**路径解析规则**：

- 相对路径：相对于被分析目录（`target_root`）解析
- 绝对路径：Python `Path` 除法原生支持，`Path('/any') / '/abs/path'` 直接返回 `/abs/path`
- 未设置或文件不存在：回退到默认 `graphify-out`
- JSON 解析失败：记录警告，回退到默认 `graphify-out`，不抛出异常

**典型设置流程**：

```bash
# 在项目根目录创建配置文件
echo '{"out_dir": "docs/contents/graphify-out"}' > .graphify_config.json

# 之后所有运行都自动使用该目录，无需每次传参
/graphify .
/graphify . --update
python3 -m graphify.watch .
graphify claude install
```

**不建议提交到 git**（每个项目自定义，通常加入 `.gitignore`）：

```
.graphify_config.json
```

## 路径规则

默认行为（无配置文件，在对话中输入）：

```
/graphify .
```

输出目录：

```text
./graphify-out/
```

自定义行为（有配置文件后，在对话中输入）：

```
/graphify .
/graphify ./raw
```

`.graphify_config.json` 内容为 `{"out_dir": "docs/contents/graphify-out"}` 时，输出目录分别为：

```text
./docs/contents/graphify-out/
./raw/docs/contents/graphify-out/
```

说明：

- `out_dir` 相对于被分析目录（`target_root`）解析，而非 CWD
- 若后续用户反馈该语义不直观，可再单独评估是否切换为相对于 CWD 解析

## 核心改造思路

### 1. `graphify/config.py`（新文件）

引入独立配置模块，这是整个改造的核心：

```python
from __future__ import annotations
import json
from pathlib import Path


def load_config(target_root: Path) -> dict:
    """Read .graphify_config.json from target_root. Returns {} on any failure."""
    cfg_file = target_root / ".graphify_config.json"
    if not cfg_file.exists():
        return {}
    try:
        return json.loads(cfg_file.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"[graphify] Warning: failed to read .graphify_config.json: {e}")
        return {}


def resolve_output_dir(target_root: Path, out_dir: str | None = None) -> Path:
    """Resolve the output directory for a given target_root.

    Priority:
      1. Explicit out_dir argument (highest)
      2. .graphify_config.json in target_root
      3. Default: graphify-out
    """
    if out_dir is None:
        out_dir = load_config(target_root).get("out_dir")
    return target_root / (out_dir or "graphify-out")
```

要求：

- 新文件，不修改任何现有文件即可引入，上游 merge 零冲突
- `out_dir` 参数为显式覆盖（`watch.py --out-dir` 等场景），平时传 `None`
- 所有输出路径均从该函数返回值派生

### 2. 所有输出路径统一派生

产物矩阵中的全部路径统一改为基于 `resolve_output_dir` 的返回值（完整列表见"产物矩阵"章节）：

| 原写死路径 | 改为 |
|---|---|
| `graphify-out/graph.json` | `out_dir / "graph.json"` |
| `graphify-out/GRAPH_REPORT.md` | `out_dir / "GRAPH_REPORT.md"` |
| `graphify-out/graph.html` | `out_dir / "graph.html"` |
| `graphify-out/manifest.json` | `out_dir / "manifest.json"` |
| `graphify-out/needs_update` | `out_dir / "needs_update"` |
| `graphify-out/memory` | `out_dir / "memory"` |
| `graphify-out/cache` | `out_dir / "cache"` |
| `graphify-out/converted` | `out_dir / "converted"` |
| `graphify-out/obsidian` | `out_dir / "obsidian"` |
| `graphify-out/wiki` | `out_dir / "wiki"` |

`detect.py` 中的 `load_manifest` / `save_manifest` / `detect_incremental` 已有 `manifest_path` 参数，调用方传入 `str(out_dir / "manifest.json")` 即可，无需修改函数签名。

### 3. 统一模板渲染入口

`__main__.py` 中写入用户环境的模板需通过统一渲染入口生成。安装命令读取配置文件（或接受 `--out-dir` 覆盖）后，将 `out_dir` 渲染进模板：

```python
def render_install_section(out_dir_str: str = "graphify-out") -> str:
    """Return the CLAUDE.md / AGENTS.md graphify section with the correct out_dir."""
    ...
```

安装命令优先级：

1. `--out-dir` 参数（显式覆盖）
2. `.graphify_config.json` 中的 `out_dir`
3. 默认 `graphify-out`

## 代码改造范围

### `graphify/config.py`（新建）

见"核心改造思路"第 1 节。零冲突，不修改任何现有文件。

### `graphify/detect.py`

改造点：

- `detect()` 函数中的 `memory_dir` 和 `converted_dir`：由硬编码改为调用 `resolve_output_dir(root)`
- `_MANIFEST_PATH` 模块常量保持不变（向后兼容），调用方改为传入 `str(resolve_output_dir(root) / "manifest.json")`

说明：

- `memory/` 不只是输出路径，也是扫描语义的一部分（自定义目录下的 `memory/` 需继续被纳入扫描）
- `converted/` 同理（需继续被排除为内部中间产物）
- 因此不是简单的字符串替换，而是让 `detect()` 通过 `resolve_output_dir` 动态确定这两个目录

### `graphify/security.py`

改造点：

- `validate_graph_path` 的 `base` 参数默认值由 `Path("graphify-out").resolve()` 改为调用 `resolve_output_dir(Path("."))`

说明：

- 调用方（skill 执行时）应传入 `base=resolve_output_dir(target_root)` 而非依赖默认值

### `graphify/watch.py`

改造点：

- `_rebuild_code(watch_path)`：内部调用 `resolve_output_dir(watch_path)` 替代硬编码 `watch_path / "graphify-out"`
- `_notify_only(watch_path)`：同上
- `watch()` 事件过滤：`if "graphify-out" in path.parts` 改为 `if out_dir in path.parents`
- `__main__` 入口：argparse 新增 `--out-dir`，作为 `resolve_output_dir` 的显式覆盖

### `graphify/__main__.py`

改造点（仅安装模板，不涉及主构建）：

- `_SETTINGS_HOOK`、`_CLAUDE_MD_SECTION`、`_AGENTS_MD_SECTION`：改为通过 `render_install_section(out_dir_str)` 生成
- `claude_install`、`_agents_install` 等函数：读取 `.graphify_config.json` 或接受 `--out-dir` 参数，传入渲染函数
- 安装子命令新增可选 `--out-dir`（仅用于模板渲染，不触发构建）

典型工作流：

```bash
# 1. 创建项目配置（一次性）
echo '{"out_dir": "docs/contents/graphify-out"}' > .graphify_config.json

# 2. 同步持久化提示到 CLAUDE.md / settings.json（自动读取配置）
graphify claude install
```

### `graphify/skill.md` 及各平台变体

**执行模板零改动**。Python 函数内部读取配置，skill.md 无需感知。

只需在 Usage 注释中增加一行说明：

```
# Output directory can be customized via .graphify_config.json in the target directory
```

这是与上游 skill.md 保持同步的关键：执行片段不改，只加注释。

### `README.md` / `README.zh-CN.md`

- 增加"自定义输出目录"说明章节
- 说明 `.graphify_config.json` 的格式和位置

### `tests/`

见"测试策略"章节。

## Security 改造方案

当前 `validate_graph_path` 默认 base 为 `Path("graphify-out").resolve()`。若不调整，自定义输出目录会被拦截。

改造后：

- 调用方传入 `base=resolve_output_dir(target_root)`，security 函数本身无需知道配置
- 默认仍允许 `target_root/graphify-out/**`
- 配置文件设置后允许 `target_root/docs/contents/graphify-out/**`

## Hooks 改造策略

### 第一阶段（本次改造范围）

- 主流程、`detect.py`、`watch.py`、`security.py` 全部接入 `resolve_output_dir`
- `__main__.py` 安装命令读取配置文件生成模板
- git hook 的**已安装 bash 脚本内容**（`_HOOK_SCRIPT` / `_CHECKOUT_SCRIPT`）仍保留 `graphify-out` 硬编码，不在本阶段改造
- 文档中明确说明：已安装的 git hook 固定面向 `graphify-out`；如需同步，重新运行 `graphify hook install`（第二阶段读配置）

### 第二阶段（后续按需）

- `_install_hook` 生成 bash 脚本时，读取 `.graphify_config.json` 将 `out_dir` 写入脚本
- git hook 的 bash 脚本检测配置文件，动态决定输出目录

## 上游同步分析

| 文件 | 改动性质 | 上游修改频率 | 冲突风险 |
|------|---------|------------|--------|
| `graphify/config.py`（新建） | 全新文件 | 不存在 | **零** |
| `graphify/skill.md` | 仅加一行注释 | 极高 | **极低** |
| `graphify/skill-*.md` | 同上 | 高 | **极低** |
| `graphify/detect.py` | 2-3 处函数调用替换 | 中 | 低 |
| `graphify/watch.py` | 3-4 处路径替换 | 中 | 低 |
| `graphify/security.py` | 1 处默认值修改 | 低 | 低 |
| `graphify/__main__.py` | 模板渲染逻辑 | 中 | 中 |

与先前"skill 参数 + LLM 替换"方案相比，skill.md 冲突风险从**必有大量冲突**降至**极低**。

## 测试策略

### 1. `resolve_output_dir` 单元测试

```python
# 无配置文件 → 默认 graphify-out
# 有配置文件 → 使用配置值
# 显式 out_dir 参数 → 覆盖配置文件
# JSON 解析失败 → 回退默认，不抛异常
# 绝对路径 → 直接使用
```

### 2. 默认路径集成测试

验证无 `.graphify_config.json` 时，所有产物写入 `graphify-out/`

### 3. 自定义路径集成测试

验证有 `.graphify_config.json` 时，所有产物写入配置的目录

### 4. 安全校验测试

验证自定义输出目录不会被 security 机制错误拦截

### 5. 功能完整性测试

验证以下能力在自定义输出目录下仍正常工作：

- `cache`、`memory`、`converted`、`obsidian`、`wiki`
- `manifest.json`（增量更新 `--update`）
- `cost.json`

### 6. watch 模式测试

- code-only 变更写入自定义输出目录
- non-code 变更写入自定义目录下的 `needs_update`
- 监听器不把自定义输出目录自身变化当作输入事件

### 7. 安装模板测试

验证 `graphify claude install` 在有/无配置文件时，写入 `.claude/settings.json`、`CLAUDE.md`、`AGENTS.md` 的路径正确

## 实施顺序

1. 新建 `graphify/config.py`，实现 `load_config` 和 `resolve_output_dir`
2. 改造 `graphify/detect.py`（`memory`、`converted`、`manifest_path`）
3. 改造 `graphify/watch.py`（输出路径、事件过滤、argparse `--out-dir`）
4. 改造 `graphify/security.py`（`validate_graph_path` base 改为传参）
5. 改造 `graphify/__main__.py`（安装模板读取配置，新增 `render_install_section`）
6. `graphify/skill.md` 及各平台变体加一行注释
7. 运行并修复测试
8. 更新 `README`、`README.zh-CN.md`

## 风险

- `.graphify_config.json` 放错目录：函数回退到默认 `graphify-out`，静默失效——需在文档中清晰说明位置
- JSON 格式错误：已加 `try/except` 回退，需打印警告便于排查
- `watch.py` 事件过滤改造不完整：自定义目录下的产物变更会触发重复构建
- `__main__.py` 安装模板遗漏 `render_install_section`：旧路径持久化到用户环境
- git hook bash 脚本第一阶段仍写 `graphify-out`：用自定义目录时 hook 行为与主流程不一致，需在文档中说明

## 结论

推荐方案：

- 新建 `graphify/config.py`，Python 函数内部自动读取 `.graphify_config.json`
- skill.md 执行模板**零改动**，可随时直接 merge 上游更新
- 用户在项目根目录创建一次配置文件，所有后续运行自动生效：

```bash
echo '{"out_dir": "docs/contents/graphify-out"}' > .graphify_config.json
```

这是在"满足定制需求"、"上游可合并性"和"实现稳定性"三者之间最优的方案。
