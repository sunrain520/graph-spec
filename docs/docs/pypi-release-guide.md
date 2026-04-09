# PyPI 发布指引

本文档说明如何将当前项目发布到 PyPI，并避免在命令历史、聊天记录或脚本中明文暴露 token。

## 前提

- 已登录 PyPI 并创建好 API token
- 当前项目分发包名为 `graphify-leo`

## 环境说明

> **推荐使用独立 venv 运行 build 和 twine**，避免全局 Python 环境依赖污染或版本冲突导致上传失败（即使包本身完全正确）。该项目已出现过全局环境工具链不稳定的情况，venv 是更可靠的选择。

## 快速发布

```bash
# 创建并激活独立 venv
python3 -m venv .venv-release
source .venv-release/bin/activate   # Windows: .venv-release\Scripts\activate

# 安装构建工具到 venv
pip install --upgrade build twine

# 构建、校验、上传
python3 -m build
twine check dist/*
TWINE_USERNAME=__token__ TWINE_PASSWORD='你的_pypi_token' twine upload dist/*

# 用完后可删除 venv
deactivate
rm -rf .venv-release
```

## 1. 构建发布产物

创建干净的 venv（若未按快速发布操作）：

```bash
python3 -m venv .venv-release
source .venv-release/bin/activate
pip install --upgrade build twine
```

在项目根目录执行构建：

```bash
python3 -m build
```

构建成功后，产物会出现在 `dist/` 目录，例如：

```bash
dist/graphify_leo-0.3.11.post1.tar.gz
dist/graphify_leo-0.3.11.post1-py3-none-any.whl
```

## 2. 发布前校验

在 venv 激活状态下检查包元数据：

```bash
twine check dist/*
```

如果输出 `PASSED`，说明上传格式没有明显问题。如果在全局 Python 中运行 `twine check` 报工具链错误，切换到 venv 通常可以解决。

## 3. 使用环境变量发布

不要把 token 写进脚本、文档或命令历史。推荐只在当前 shell 会话中设置（在 venv 激活状态下执行）：

```bash
export TWINE_USERNAME=__token__
export TWINE_PASSWORD='你的新pypi_token'
twine upload dist/*
```

说明：

- `TWINE_USERNAME` 固定写 `__token__`
- `TWINE_PASSWORD` 填你的 PyPI API token
- `twine` 会自动读取这两个环境变量完成认证

## 4. 发布成功后的验证

发布成功后，可以检查：

```bash
pip install graphify-leo
```

也可以打开 PyPI 项目页确认版本是否已出现。

## 5. 安全建议

- 不要把 token 提交到 git
- 不要把 token 写进 README、脚本或聊天消息
- 如果 token 泄露，立即去 PyPI 撤销并重建
- 发布完成后，可清理当前 shell 中的环境变量：

```bash
unset TWINE_USERNAME
unset TWINE_PASSWORD
```

## 6. 常见问题

### 未安装 twine

如果报错 `No module named twine`，优先在 venv 中安装，而不是全局 Python：

```bash
python3 -m venv .venv-release && source .venv-release/bin/activate
pip install --upgrade twine
```

### 上传时要求手动输入 token

说明当前 shell 中没有拿到 `TWINE_PASSWORD`。先检查：

```bash
echo "$TWINE_USERNAME"
echo "$TWINE_PASSWORD"
```

如果为空，重新执行：

```bash
export TWINE_USERNAME=__token__
export TWINE_PASSWORD='你的新pypi_token'
```

### 包名已存在

如果 PyPI 返回包名冲突或权限错误，说明该包名已被占用或你没有该项目权限，需要更换包名或使用正确的账号/token。
