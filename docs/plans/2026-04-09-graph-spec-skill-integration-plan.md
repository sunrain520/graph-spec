# graph-spec Skill Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 `graph-spec` 的 skill 能力补齐为可安装、可触发、可迁移的多平台方案，并让 Claude 侧使用 `/spec:graphify` 作为官方触发命令。

**Architecture:** 采用“共享 skill 内容 + 平台/OS 分层模板 + 安装时组装”的方案。核心 skill 文本不直接散落在 `src/` 中，而是统一放入 `skills/` 目录，由安装器按平台与操作系统组合生成最终 `SKILL.md`。`claude install` / `codex install` / `opencode install` / `claw install` / `droid install` 继续保留现有常驻指导文件行为，同时新增 skill 资产安装，并提供 install / update / uninstall 三段式生命周期，不改图谱构建链路。

**Tech Stack:** Node.js CommonJS、`fs` / `path`、`node:test`、现有 CLI 安装器、npm 打包。

**Cross-platform constraint:** 本次迁移必须同时兼容 macOS、Windows 和 Linux。所有路径都必须通过 `path.join()` / `path.resolve()` 计算，禁止把 `~/.claude`、`/Users/...`、`C:\Users\...` 这类绝对路径写死到业务逻辑中。文档、测试、安装器都要以”可在 Windows 上运行”为验收前提，尤其是 skill 安装根目录、`CLAUDE.md` / `AGENTS.md` 写入位置、`.claude/settings.json` 路径和卸载逻辑。本方案所有安装均为项目级，不使用全局用户路径。

**Output directory constraint:** skill 文本和安装器都必须支持用户自定义的产出物目录，不允许把 `graphify-out/` 写死为唯一输出位置。所有对报告、JSON、HTML、wiki、Obsidian、Neo4j 产物的引用，都应从当前解析后的 `out_dir` 注入；测试必须覆盖默认输出目录和自定义输出目录两种场景。

---

## Scope

### In scope

- Claude Code skill 安装与触发注册，官方触发词为 `/spec:graphify`
- Codex、OpenCode、OpenClaw、Factory Droid 的 skill 资产迁移
- 保留并继续写入 `CLAUDE.md`、`AGENTS.md`、`.claude/settings.json` 的常驻指导能力
- 新增 skill 安装/更新/卸载的测试覆盖
- README 和用户手册补齐 skill 使用说明
- 安装器与测试用例必须验证跨平台路径处理，不允许把 macOS 专用路径当作唯一实现
- skill 源模板必须统一放在 `skills/` 目录，避免把模板逻辑分散到 `src/`、文档或安装器代码里
- skill 文本中的输出产物引用必须使用可注入的 `out_dir` 占位或上下文变量，不能硬编码 `graphify-out/`
- CLI 必须提供 install / update / uninstall 三类操作，且 update 只能重写受管理片段，不得删除用户手写的非管理内容
- Claude 使用本项目矩阵中的默认项目级安装根；Codex、OpenCode、OpenClaw、Factory Droid 在默认发现路径被真实验证前，仅通过显式 `--skill-dir` 声明为受支持安装方式，不能靠隐式探测猜目录

### Out of scope

- Trae / Trae CN skill 迁移
- 图谱构建、输出目录、add/obsidian/neo4j/mcp 等核心功能改动
- 任何新的远程同步或自动更新机制
- 为 Codex 额外补 `.codex/hooks.json` 级别的 always-on hook；本轮只迁移 skill 资产和现有 guidance 文件，不追求对齐上游 graphify 的 Codex hook 行为

---

## Platform Matrix

| Platform | Skill trigger / naming | Skill install root | Always-on guidance |
|---|---|---|---|
| Claude Code | `/spec:graphify` | `${PROJECT_ROOT}/.claude/skills/spec-graphify/SKILL.md` | `CLAUDE.md` + `.claude/settings.json` |
| Codex | `spec-graphify` skill package | `${PROJECT_ROOT}/.agents/skills/spec-graphify/SKILL.md` | `AGENTS.md` |
| OpenCode | `spec-graphify` skill package | `${PROJECT_ROOT}/.config/opencode/skills/spec-graphify/SKILL.md` | `AGENTS.md` |
| OpenClaw | `spec-graphify` skill package | `${PROJECT_ROOT}/.claw/skills/spec-graphify/SKILL.md` | `AGENTS.md` |
| Factory Droid | `spec-graphify` skill package | `${PROJECT_ROOT}/.factory/skills/spec-graphify/SKILL.md` | `AGENTS.md` |

> Notes:
> - Claude Code 同时支持全局 (`~/.claude/skills/`) 和项目级 (`.claude/skills/`) skill 发现。本项目选择项目级，因为 graph-spec 依赖项目内的 `{{out_dir}}` 路径，且与现有 `writeClaude()` 写入 `.claude/settings.json` 的行为一致。
> - `.claude/settings.json` 的 PreToolUse hook 注册是现有 `writeClaude()` 行为，不属于本次 skill 迁移范围。
> - `${PROJECT_ROOT}` 必须通过 `path.resolve(projectDir)` 计算，不能依赖 shell 展开。
> - 上表中的非 Claude 路径首先是渲染与文档展示用的项目级约定路径，不自动等同于“平台已验证可发现”。
> - Codex、OpenCode、OpenClaw、Factory Droid 在其默认发现路径被真实验证前，正式支持方式是显式传入 `--skill-dir`；若后续测试或平台文档确认默认路径可发现，再把该平台升级为“默认根可用”。
> - 任何以 `/` 开头的示例路径都只作为文档展示，不可直接复用到实现中。

## Skill Template Layout

模板源文件统一放在 `skills/` 目录，按“共享核心 + 平台片段 + 操作系统片段”组织：

```text
skills/
  base/
    spec-graphify.md
  platforms/
    claude.md
    codex.md
    opencode.md
    claw.md
    droid.md
  os/
    windows.md
```

规则：
- `skills/base/spec-graphify.md` 只放共用正文，不包含平台专属落点或 shell 语法。
- `skills/platforms/*.md` 只放平台差异，例如 Claude 的 `/spec:graphify`、各平台安装路径说明、平台专属注册短语。
- `skills/os/windows.md` 只放 Windows 专属 shell / 路径约束，其他平台不引用。
- 安装器必须在生成最终 `SKILL.md` 前完成模板拼装，不允许把模板逻辑埋在安装代码里。
- base 模板正文只能描述当前 `graph-spec` CLI 已实现且已有测试覆盖的命令与参数；上游 `graphify/skill*.md` 只能作为结构和语气参考，不能直接复制其命令面。

**Fragment 拼接约定（占位符注入，非尾追加）：**
- `skills/base/spec-graphify.md` 必须包含两个占位符：
  - `{{platform_section}}`：位于文件顶部，渲染时替换为对应平台的 `skills/platforms/<platform>.md` 全文。
  - `{{os_notes}}`：位于文件末尾，渲染时替换为 `skills/os/windows.md` 全文（Windows）或空字符串（其他 OS）。
- 平台片段 `skills/platforms/*.md` 只含自身文本，不包含任何占位符。
- OS 片段 `skills/os/windows.md` 只含自身文本，不包含任何占位符。
- 拼装逻辑由 `src/skill-assets.js` 的 `buildSkill(platform, vars)` 负责：先读 base，再用 `renderTemplate` 将 `{{platform_section}}` 和 `{{os_notes}}` 替换为对应片段文本，最后统一注入 `{{out_dir}}` 等运行时变量。
- 禁止在 `src/install.js` 或其他非 skill-assets 代码里自行拼接模板片段。

**模板变量约定：**
- base 模板和 platform 模板中使用 `{{out_dir}}` 作为输出目录占位符。
- 渲染器提供 `renderTemplate(content, vars)` 工具函数，通过 `content.replaceAll('{{key}}', vars[key])` 模式遍历所有 key 做替换。
- 任意变量值若为 `null` 或 `undefined`，`renderTemplate` 必须直接抛错，不能把 `"undefined"` / `"null"` 静默写入最终文本。
- 渲染完成后若最终结果仍残留 `{{...}}` 占位符，渲染器必须抛错。
- 渲染器必须区分 `outDirFsPath` 与 `outDirDisplayPath`：前者用于真实文件系统读写，后者用于 skill / guidance 正文展示，避免 Windows 反斜杠路径直接泄漏到 markdown 文本。
- 渲染入口最终调用 `renderTemplate(composed, { out_dir: outDirDisplayPath })` 完成注入，不允许在模板文件中出现硬编码的 `graphify-out` 路径。

**受管块约定：**
- `CLAUDE.md` / `AGENTS.md` 中 graph-spec 写入内容必须包在显式的受管块里，例如 `<!-- graph-spec:start -->` 和 `<!-- graph-spec:end -->`。
- `install` 的语义是：如果受管块不存在，则追加；如果存在，则按同一套 renderer 刷新成最新内容。
- `update` 的语义是：与 `install` 完全一致，属于同一套 upsert 行为的显式别名。
- `uninstall` 的语义是：删除受管块，保留文档中的其他手写内容。
- 受管块内部内容始终来自同一套 renderer，确保 `install` / `update` 一致。
- 安装器必须提供一个可复用的 `rewriteManagedBlock(filePath, markerStart, markerEnd, nextContent)` 辅助函数，`install` / `update` / `uninstall` 共享它，避免三处实现各写一套字符串替换逻辑。
- `rewriteManagedBlock` 的 `nextContent` 语义：
  - `typeof nextContent === 'string'`（含空字符串）：upsert — 若块不存在则追加，若块存在则仅替换块内容，保留标记行。
  - `nextContent === null`：delete — 删除整个受管块**含**两行标记注释，保留文件其余内容；若块不存在则幂等返回 `false`。
  - `nextContent === undefined`：视为调用错误，直接抛错；不允许静默执行。
- `uninstall` 调用方式：`rewriteManagedBlock(filePath, '<!-- graph-spec:start -->', '<!-- graph-spec:end -->', null)`，不允许为 uninstall 另写独立字符串替换逻辑。
- 迁移期必须兼容旧版 `## graph-spec` 段：`install` / `update` / `uninstall` 在操作托管块之前，先扫描并删除旧格式段落，避免同一文件中出现旧段 + 新块双份内容。

## Key Technical Decisions

- **Template fragments are composed, not copied.** Platform files own the trigger / metadata prefix, base owns the shared body, and OS notes are appended only when needed. This keeps the installed `SKILL.md` deterministic across platforms and makes `out_dir` injection uniform.
- **Template rendering is fail-fast.** Missing variables and unresolved placeholders are hard errors. That prevents partially-rendered skill text from being installed or published.
- **Managed guidance is an upsert/delete lifecycle, not ad hoc string editing.** `install` and `update` are the same content-refresh path; `uninstall` is deletion of the managed block only.
- **Non-Claude platforms start conservatively.** The plan treats their default discovery roots as unverified until proven by tests or platform docs; explicit `--skill-dir` is the compatibility escape hatch.
- **Public guidance APIs are stable package exports and CLI commands only.** Deep imports remain implementation details even if they are still re-exported by the package today.

## System-Wide Impact

- **Generation path:** `src/skill-assets.js` reads templates from `skills/` and produces the final platform-specific `SKILL.md` text.
- **Installation path:** `src/install.js` writes the generated `SKILL.md` into the platform-specific install root and updates the managed guidance blocks in `CLAUDE.md` / `AGENTS.md`.
- **Invocation path:** `src/cli.js` selects the platform, wires `--skill-dir`, and decides whether the command is `install`, `update`, or `uninstall`.
- **Packaging path:** `package.json.files` must include `skills/` so the renderer keeps working from the npm package, not just from the repo checkout.
- **Documentation path:** README and user manual must distinguish skill artifacts from always-on guidance so users do not expect one to replace the other.
- **Unchanged invariants:** Graph build, add, wiki, obsidian, neo4j, mcp, and the existing graph pipeline remain out of scope; their behavior should not change as a result of skill integration.

---

### Task 1: Define the shared skill asset model

**Files:**
- Create: `src/skill-assets.js`
- Create: `skills/base/spec-graphify.md`
- Create: `skills/platforms/claude.md`
- Create: `skills/platforms/codex.md`
- Create: `skills/platforms/opencode.md`
- Create: `skills/platforms/claw.md`
- Create: `skills/platforms/droid.md`
- Create: `skills/os/windows.md`
- Create: `tests/skill-assets.test.js`
- Modify: `package.json`（验证 `files` 字段已包含 `"skills"` 和 `docs/output-artifacts.md`，若缺失才补）

**Step 1: Write the failing test**

Add tests that prove the shared renderer can:
- build a Claude variant whose frontmatter trigger is `/spec:graphify`
- build non-Claude variants that reuse the same base body but target different install roots
- inject the current resolved `out_dir` into the skill instructions
- inject a caller-provided custom `out_dir` and keep the generated instructions consistent
- keep the skill body platform-agnostic apart from trigger/install metadata
- resolve platform-specific roots on both POSIX and Windows path formats
- compose the final skill file from base + platform + optional OS fragments
- reject or omit command examples that are not implemented by the current `graph-spec` CLI surface
- throw when any required template variable is missing or when unresolved `{{...}}` placeholders remain in the rendered output
- build Windows path fixtures with `path.win32` and POSIX fixtures with `path.posix`, so Task 1 tests run on any host OS without requiring a Windows runner

**Step 2: Run test to verify it fails**

Run:
```bash
node --test tests/skill-assets.test.js
```

Expected: FAIL because `src/skill-assets.js` does not exist yet.

**Step 3: Write minimal implementation**

Implement a small renderer that:
- locates the template root via `const SKILLS_DIR = path.resolve(__dirname, '..', 'skills');` — this works both in development (project root) and after npm install (`node_modules/graph-spec/skills/`)
- reads fragments from `skills/base/`, `skills/platforms/`, and `skills/os/`
- applies a per-platform metadata object
- returns the final `SKILL.md` contents as text
- keeps path rendering separate from text rendering so Windows path separators never leak into the markdown body
- accepts `out_dir` as a render-time input and interpolates it into user-facing instructions
- exports `SKILLS_DIR` so tests can assert the resolved path without mocking
- fails fast when required template variables are missing or when unresolved placeholders remain after rendering
- `buildSkill(platform, vars, { pathModule } = {})` 接受可选的 `pathModule` 参数（默认 `require('node:path')`）；测试注入 `path.win32` 或 `path.posix` 来验证跨平台路径拼接行为，无需独立 Windows CI runner
- `pathModule` 只影响平台路径字符串拼接与 fixture 断言，不影响 `SKILLS_DIR` / 模板根解析；模板根始终由 `path.resolve(__dirname, '..', 'skills')` 决定。

验证 `package.json` 的 `files` 数组已包含 `"skills"` 和 `"docs/output-artifacts.md"`；若缺失则补充：
```json
"files": ["bin", "src", "skills", "README.md", "docs/user-manual.md", "docs/output-artifacts.md", "LICENSE", "CHANGELOG.md"]
```
这确保 `npm pack` 将模板目录一同打包，使 `npm install` 后的消费者可以访问 `skills/` 片段。

Keep the first pass simple:
- no external templating engine (only `String.replaceAll` for `{{var}}` placeholders as defined in the template variable convention above)
- no filesystem writes yet
- only pure string rendering helpers

**Dependencies:** none; this unit defines the renderer contract that later installer work will consume.

**Verification:**
- `buildSkill('claude', { out_dir: 'docs/contents/graphify-out' })` produces a single deterministic SKILL document with `/spec:graphify` in the Claude frontmatter.
- Rendering with a custom `out_dir` changes the user-facing text but does not change the platform/body structure.
- Rendering with a missing variable or unresolved placeholder throws instead of emitting `"undefined"` or raw `{{...}}`.
- POSIX and Windows path fixtures produce the same logical output structure apart from platform-specific path text.

**Step 4: Run test to verify it passes**

Run:
```bash
node --test tests/skill-assets.test.js
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/skill-assets.js skills/ tests/skill-assets.test.js package.json
git commit -m "feat: add shared skill asset rendering"
```

---

### Task 2: Wire skill installation into the existing installers

**Files:**
- Modify: `src/install.js`
- Modify: `src/cli.js`
- Modify: `tests/install.test.js`

**Step 1: Write the failing test**

Extend installer tests so that each supported platform proves:
- Claude writes the skill file to the default project-level install root, while Codex / OpenCode / OpenClaw / Factory Droid can write to an explicit `--skill-dir` override even if their default discovery roots remain unvalidated
- Claude gets `/spec:graphify` in the installed skill content
- the existing `CLAUDE.md` / `AGENTS.md` guidance still gets appended
- update refreshes the skill file and the managed guidance block without deleting unrelated content
- uninstall removes the skill file and leaves unrelated content intact
- Windows-style project paths resolve to the same install behavior as POSIX paths
- Windows-only template fragments are included only when the active platform or OS needs them
- custom `out_dir` values are preserved end-to-end in the installed skill wording
- `--skill-dir` is a single CLI-to-installer-to-renderer parameter that overrides the default skill discovery/install root and must affect install, update, and uninstall consistently; uninstall without `--skill-dir` only removes the default-path skill directory, leaving any custom-path installations untouched (Unix PREFIX semantics)
- managed guidance content uses only public CLI commands or public package exports, never `graph-spec/src/*` deep imports
- a `CLAUDE.md` / `AGENTS.md` file that already contains a legacy `## graph-spec` section (written by an older version) is correctly migrated: the old section is removed and a new managed block is written in its place without leaving duplicate content
- install/update migrates any legacy `## graph-spec` section into the new managed-block form instead of duplicating content
- uninstall without `--skill-dir` only guarantees cleanup of the default install root; cleanup of custom roots requires passing the same `--skill-dir` again unless a future implementation explicitly adds a persisted install record

Use a temp project sandbox so the tests do not touch the real project directory.

**Step 2: Run test to verify it fails**

Run:
```bash
node --test tests/install.test.js
```

Expected: FAIL because the installer does not yet write skill files.

**Step 3: Write minimal implementation**

Update `src/install.js` so `writeClaude()` and `writeAgents()` can:
- render and write `SKILL.md` for the matching platform
- replace the current `writeSectionFile()` marker-based matching with the managed-block convention (`<!-- graph-spec:start -->` / `<!-- graph-spec:end -->`) defined above, so that `install` and `update` both upsert the block in place, and `uninstall` removes it cleanly
- preserve the existing `CLAUDE.md` / `AGENTS.md` append behavior
- keep `outDir` injection coming from `resolveOutputDir()`
- normalize all filesystem inputs through `path.resolve()` before composing install targets
- ensure any written guidance text calls a public CLI command or public package export, rather than deep-importing `graph-spec/src/*`
- treat only the root package export (`require('graph-spec')`) and CLI entrypoints as stable guidance APIs; `./src/*` exports remain implementation detail even if the package currently exposes them
- 在写入新托管块前，调用 `migrateOldFormat(filePath)` 清理旧格式：
  - 旧格式特征：文件中存在 `## graph-spec\n` 段落（由旧版 `writeSectionFile()` 写入，没有 `<!-- graph-spec:start -->` 标记）。
  - 迁移逻辑：用正则 `/\n*## graph-spec\n[\s\S]*?(?=\n## |\n*$)/` 删除旧段，对文件做原地修改后返回。
  - 若文件不存在或未发现旧格式，`migrateOldFormat` 幂等返回，不报错。
  - 调用时机：`writeClaude()` 和 `writeAgents()` 在调用 `rewriteManagedBlock` 之前各调用一次；`uninstall` 也需调用（防止旧格式残留），调用顺序在 `rewriteManagedBlock(…, null)` 之前。
  - `migrateOldFormat` 不对 `.claude/settings.json` 做任何操作，只处理 `CLAUDE.md` / `AGENTS.md`。

Update `uninstallClaude()` and `uninstallAgents()` so they additionally:
- remove the platform-specific skill directory (e.g. `.claude/skills/spec-graphify/`, `.agents/skills/spec-graphify/`) along with the existing guidance cleanup
- leave any sibling skill directories or unrelated files under `.claude/` / `.agents/` intact

Update `src/cli.js` so:
- `graph-spec install` without `--platform` preserves the current default behavior and means `graph-spec install --platform claude`
- `graph-spec update` without `--platform` preserves the same default and means `graph-spec update --platform claude`
- `graph-spec install --platform ...` installs the skill for each supported platform
- `graph-spec update --platform ...` refreshes the skill for each supported platform (`update` is an alias for `install`)
- `graph-spec claude|codex|opencode|claw|droid install` does the same
- `graph-spec claude|codex|opencode|claw|droid update` refreshes the same managed skill artifacts (alias for install, no separate logic needed)
- `graph-spec claude|codex|opencode|claw|droid uninstall` removes the matching skill artifact as part of cleanup
- `--skill-dir <path>` overrides the default skill discovery/install root for any supported platform
- `--skill-dir` is threaded from CLI to renderer and affects install, update, and uninstall consistently
- **`--skill-dir` 的 uninstall 边界约定（Unix PREFIX 语义）：** uninstall 只删除当次调用时传入的路径所对应的 skill 目录。不引入 manifest 或 lockfile。若安装时使用了 `--skill-dir /custom`，则卸载时必须同样传入 `--skill-dir /custom`；不传则只清理默认路径。用户手册和 `--help` 输出必须说明此约定，防止误以为 uninstall 能自动探测所有曾用过的自定义路径。
- uninstall keeps the always-on guidance files consistent with the existing platform behavior
- add `update` to the top-level `COMMANDS` set and help output so it is parsed as a command rather than a positional root argument

**Dependencies:** Task 1 must land first so the installer can consume the renderer and template layout; the uninstall / update semantics depend on the managed block contract defined above.

**Verification:**
- A brand-new temp project receives the skill artifact under the expected platform root and the always-on guidance file still contains the graph-spec section.
- A project with an existing legacy `## graph-spec` block ends up with exactly one managed block after install/update, not two parallel sections.
- Updating with a different `out_dir` rewrites the managed block in place instead of appending a second copy.
- Uninstall removes the managed skill artifact and only the managed guidance block, leaving unrelated content intact.
- Passing `--skill-dir` changes the installation root for the selected command, and uninstall without the same path only guarantees default-root cleanup by documented design.

Do not change the graph build pipeline or any unrelated commands.

**Step 4: Run test to verify it passes**

Run:
```bash
node --test tests/install.test.js
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/install.js src/cli.js tests/install.test.js
git commit -m "feat: install graph-spec skills for all supported platforms"
```

---

### Task 3: Update documentation for the new skill workflow

**Files:**
- Modify: `README.md`
- Modify: `docs/user-manual.md`
- Modify: `CHANGELOG.md`

> This is a docs-only task. No automated tests apply — the acceptance criteria below serve as a manual checklist.

**Dependencies:** Task 1 and Task 2 should already define the final skill layout, lifecycle semantics, and CLI surface; Task 3 should document those final decisions rather than speculate about pending implementation details.

**Verification:**
- README and user manual describe the same command shapes and platform boundary rules defined by Tasks 1 and 2.
- Documentation explicitly states the default `claude` behavior when `--platform` is omitted and the `--skill-dir` uninstall boundary rule.
- The docs do not mention Trae and do not promise automatic discovery for the non-Claude platforms.

**Step 1: Verify baseline**

Before editing, confirm the docs currently mention only assistant guidance and do not yet cover:
- the new `/spec:graphify` Claude trigger
- where the skill files are installed
- which platforms receive skill assets

Run:
```bash
rg -n "/spec:graphify|spec-graphify|skill.*install|skill.*graph-spec" README.md docs/user-manual.md
```

Expected: no matches (the new skill workflow is not yet documented).

**Step 2: Write documentation**

Update the README and user manual to cover:
- the official Claude trigger `/spec:graphify`
- the supported platform matrix for skill installation
- the difference between skill assets and always-on guidance files
- how users should run the commands after `graph-spec <platform> install` / `update` / `uninstall`
- the default behavior of `graph-spec install` / `graph-spec update` when `--platform` is omitted (Claude)
- the `--skill-dir` override and its uninstall boundary rule: uninstall only guarantees cleanup of the path explicitly supplied for that invocation

Keep the README concise and put the detailed workflow in the user manual.

**Step 3: Acceptance checklist**

Manually verify:
- [ ] README contains `/spec:graphify` trigger explanation
- [ ] README explains the difference between skill assets and guidance files
- [ ] User manual contains the full platform matrix (Claude, Codex, OpenCode, Claw, Droid)
- [ ] User manual shows per-platform install command examples
- [ ] User manual explains the default `graph-spec install` / `graph-spec update` behavior without `--platform`
- [ ] User manual explains `--skill-dir` and the need to pass the same path again for uninstall
- [ ] CHANGELOG records the new skill workflow

**Step 4: Commit**

```bash
git add README.md docs/user-manual.md CHANGELOG.md
git commit -m "docs: add graph-spec skill workflow"
```

---

### Task 4: Verify packaging and end-to-end install behavior

**Files:**
- Modify: any files found in Tasks 1-3 that still need polish
- Test: `tests/install.test.js`, `tests/skill-assets.test.js`, plus the full suite

**Dependencies:** Tasks 1-3 must be complete first; this unit validates the integrated behavior across the renderer, installer, CLI, packaging, and docs-aligned semantics.

**Verification:**
- The packaged tarball contains `skills/base/spec-graphify.md` and the renderer can resolve it from the installed package layout.
- End-to-end install/update/uninstall checks pass for Claude, including the legacy-block migration case.
- The default `graph-spec install` / `graph-spec update` behavior remains Claude when no `--platform` is supplied.
- Custom `--skill-dir` behavior is consistent with the documented uninstall boundary rule.

**Step 1: Write the failing test**

Add one end-to-end assertion that:
- installs the Claude skill into a temporary project directory
- updates the same installation with a different `out_dir` and verifies the skill content reflects the new `out_dir` (this validates the update-overwrite semantics of the managed block)
- verifies the installed skill path contains `spec-graphify`
- verifies the trigger text is `/spec:graphify`
- verifies existing `CLAUDE.md` / `AGENTS.md` guidance is still present
- exercises the same flow on Windows-style path fixtures so path joining remains portable
- exercises a custom `out_dir` so the generated skill text does not assume `graphify-out/`
- verifies the skill template root resolves correctly after packaging, not only from the repo checkout
- verifies a legacy `## graph-spec` block is migrated rather than duplicated
- verifies uninstall of a custom install root requires the same `--skill-dir` again and otherwise only cleans the default root by documented design
- verifies `graph-spec install` and `graph-spec update` with no `--platform` both target Claude, not all platforms
- verifies the renderer reads templates from the packaged `skills/` directory when the package is installed from a tarball, not just when run from the repo checkout
- verifies a custom `--skill-dir` install can be removed only when the same custom path is supplied again, matching the documented PREFIX-style uninstall boundary
- verifies the end-to-end flow leaves unrelated files under the project root untouched, including a sibling `AGENTS.md` section not owned by graph-spec and any sibling skill directories under the install root

**Step 2: Run test to verify it fails**

Run:
```bash
node --test tests/install.test.js tests/skill-assets.test.js
```

Expected: FAIL until the end-to-end assertions are satisfied.

**Step 3: Write minimal implementation**

Fix only the missing edge cases:
- path normalization for skill destinations
- update overwrite semantics for the managed skill sections
- any uninstall cleanup gaps
- any trigger text mismatches

Do not widen the scope to Trae or other unrelated platform work.

**Step 4: Run test to verify it passes**

Run:
```bash
node --test tests/install.test.js tests/skill-assets.test.js
npm test
npm_config_cache=/tmp/graph-spec-npm-cache npm pack --json
```

Expected:
- both focused test files pass
- the full suite passes
- packaging succeeds and includes the new skill source templates under `skills/`, while runtime install artifacts are still generated from the packaged source
- after `npm pack`, verify with: `tar tf graph-spec-*.tgz | grep 'skills/base/spec-graphify.md'` to confirm templates are bundled
- the generated tarball can be unpacked and the renderer still finds `skills/base/spec-graphify.md` from the installed package layout
- the packaged install path tests confirm the same `SKILL.md` content regardless of whether the plan is executed from the repo checkout or from the installed tarball

**Step 5: Commit**

```bash
git add .
git commit -m "feat: integrate graph-spec skill support"
```

---

## Acceptance Criteria

- Claude Code can install a skill whose official trigger is `/spec:graphify`
- Codex, OpenCode, OpenClaw, and Factory Droid can install the same shared skill content through an explicit `--skill-dir`, and any default discovery roots are only claimed once validated
- Each supported platform can install, update, and uninstall its own skill artifact without breaking the always-on guidance files
- `--skill-dir` can override the default skill discovery/install root when needed
- Existing assistant guidance files still work and are not replaced by the skill package
- Installed skill content does not advertise commands or flags that the current `graph-spec` CLI does not implement
- Installed guidance content does not deep-import `graph-spec/src/*`
- Legacy `## graph-spec` sections are migrated or removed during install/update/uninstall, so users never end up with duplicated graph-spec guidance blocks
- Template rendering fails fast on missing variables or unresolved placeholders
- `graph-spec install` and `graph-spec update` default to the Claude platform when `--platform` is omitted
- `npm test` passes
- `npm pack --json` succeeds
- README and user manual explain the new workflow without mentioning Trae
