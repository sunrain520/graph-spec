# 上游同步指南

本文档说明如何把当前 fork 持续同步到上游仓库。

## 目标

- 保持 fork 持续跟随上游更新
- 尽量减少历史污染
- 让同步流程稳定、可重复

## 前提

- 本地已经配置好 `origin`
- 本地已经配置好上游远程 `upstream`
- 上游默认分支名已确认，常见为 `main` 或 `v3`

查看远程配置：

```bash
git remote -v
```

如果还没有 `upstream`，先添加：

```bash
git remote add upstream https://github.com/safishamsi/graphify.git
```

## 推荐流程

默认建议使用 `merge`，不要直接在主分支上做 `rebase`。

### 1. 获取上游更新

```bash
git fetch upstream
```

### 2. 切到你的工作分支

如果你平时在 `v3` 分支上维护，就切到它：

```bash
git checkout v3
```

### 3. 合并上游分支

```bash
git merge upstream/main
```

如果上游默认分支不是 `main`，改成对应分支名，例如：

```bash
git merge upstream/v3
```

### 4. 解决冲突

这类文件最容易冲突：

- `graphify/__main__.py`
- `graphify/watch.py`
- `graphify/detect.py`
- `graphify/skill.md`
- `graphify/skill-codex.md`
- `graphify/skill-opencode.md`
- `graphify/skill-claw.md`
- `graphify/skill-droid.md`
- `graphify/skill-windows.md`
- `README.md`
- `README.zh-CN.md`

处理原则：

- 保留你自己的发布信息和路径改造
- 尽量吸收上游的功能修复和行为修正
- 不要把上游内容整体覆盖掉

### 5. 验证

合并后至少跑一次：

```bash
python3 -m build
python3 -m twine check dist/*
python3 -m pytest tests/ -q --tb=short
```

如果你的环境没有全局 `twine`，就用隔离虚拟环境：

```bash
python3 -m venv .release-venv
.release-venv/bin/python -m pip install --upgrade pip build twine
.release-venv/bin/python -m build
.release-venv/bin/python -m twine check dist/*
```

## 何时使用 rebase

只有在你明确知道自己在做什么时，才考虑 `rebase`。

适合 `rebase` 的场景：

- 你在单独的本地分支上做短期修改
- 这条分支还没有推送到远端
- 你想保留线性历史

不建议在共享分支上直接 `rebase`，否则容易把已经推送的提交历史改掉。

## 同步后再推送

合并并验证完成后，推回你的 fork：

```bash
git push origin v3
```

如果你还打了 release tag，也一并推送：

```bash
git push origin --tags
```

## 常见问题

### 上游合并后冲突很多

这是正常的，尤其是你改过这些区域时：

- 输出目录相关逻辑
- 安装模板
- skill 模板
- README

原则是：

- 先保留上游功能修复
- 再恢复你的 fork 定制
- 最后跑验证

### 为什么默认推荐 merge

`merge` 对 fork 更稳：

- 不改写历史
- 更适合长期跟随上游
- 出问题时更容易回退和审计

### 为什么不推荐在主分支上 rebase

因为主分支通常承担了发布和推送职责。

`rebase` 会改写历史，容易把已经推送过的提交弄乱，不利于长期维护。
