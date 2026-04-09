# graph-spec 本地源码安装手册

本文说明如何在不发布到 npm 的前提下，从本地源码直接使用 `graph-spec`。

## 1. 适用场景

适合这些情况：

- 你正在参与 `graph-spec` 开发
- 你想在本机直接试用最新代码
- 你希望把本地源码临时安装到另一个项目里做联调

## 2. 环境要求

- Node.js `>=20.11`
- npm
- git

如果你是从仓库根目录直接执行命令，建议先确认依赖已经安装：

```bash
npm install
```

## 3. 克隆源码

```bash
git clone https://github.com/sunrain520/graph-spec.git
cd graph-spec
```

如果你已经在本地有一份源码，也可以直接进入仓库目录使用。

## 4. 方式一：在当前仓库里直接运行

最直接的方式是不做额外安装，直接用入口文件执行：

```bash
node ./bin/graph-spec.js --help
node ./bin/graph-spec.js build .
node ./bin/graph-spec.js add "https://example.com/article"
```

这种方式适合：

- 快速验证代码改动
- 临时跑一次构建
- 不想污染全局 `PATH`

## 5. 方式二：`npm link`

如果你希望在当前 shell 里直接输入 `graph-spec`，可以在源码目录执行：

```bash
npm link
```

然后就可以直接用：

```bash
graph-spec --help
graph-spec build .
graph-spec add "https://example.com/article"
```

这会把当前源码链接到全局 npm bin 目录，适合高频本地开发。

取消链接：

```bash
npm unlink -g graph-spec
```

## 6. 方式三：`npx`

如果你已经在本地仓库里执行过 `npm install`，也可以直接：

```bash
npx graph-spec --help
npx graph-spec build .
```

`npx` 适合不想全局安装，但又希望直接跑命令的情况。

## 7. 方式四：把本地源码安装到另一个项目

如果你想在别的项目里依赖这份本地源码，可以在目标项目里执行：

```bash
npm install /Users/kuang/xiaobu/graph-spec
```

或者使用本地 tarball 的方式：

```bash
cd /Users/kuang/xiaobu/graph-spec
npm pack
cd /path/to/another-project
npm install /Users/kuang/xiaobu/graph-spec/graph-spec-0.1.0.tgz
```

这两种方式都适合联调或验证发布前的包内容。

## 8. 常用检查命令

安装完成后，建议先跑这些命令确认可用：

```bash
graph-spec --help
graph-spec config
graph-spec build .
```

如果你是直接用 `node ./bin/graph-spec.js`，则把 `graph-spec` 替换成：

```bash
node ./bin/graph-spec.js --help
node ./bin/graph-spec.js config
node ./bin/graph-spec.js build .
```

## 9. 常见问题

### 找不到 `graph-spec` 命令

先确认是否执行了 `npm link`，或者改用：

```bash
node ./bin/graph-spec.js --help
```

### 安装后还是用了旧版本

如果你之前全局安装过发布版，优先检查当前 shell 实际调用的是哪一个二进制：

```bash
which graph-spec
graph-spec --help
```

### 本地源码改了但命令没变

如果你用的是 `npm link`，确认链接还在。必要时重新执行：

```bash
npm link
```

如果你是通过 `npm install /path/to/graph-spec` 安装到别的项目里，需要重新安装一次才能拿到最新源码。

## 10. 推荐顺序

如果你是开发者，推荐这样用：

1. `npm install`
2. `node ./bin/graph-spec.js --help`
3. `npm link`
4. `graph-spec build .`

如果你是在别的项目里联调，推荐这样用：

1. 在 `graph-spec` 仓库里确认代码和测试通过
2. `npm pack`
3. 在目标项目里安装本地 tarball
4. 跑一次实际工作流验证
