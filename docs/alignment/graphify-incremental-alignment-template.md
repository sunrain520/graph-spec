# graphify 增量对齐模板

本文用于后续每次 `graphify` 有新提交时，快速判断 `graph-spec` 是否需要同步吸收。

## 输入信息

- 本次比对日期：
- 参考仓库：`/Users/kuang/xiaobu/graphify`
- 当前基线提交：`1a50f2d12bb16f3e5620e1f8944b38786de26026`
- 本地对齐仓库：`/Users/kuang/xiaobu/graph-spec`
- 本地对齐快照：

## 需要检查的提交范围

```bash
git -C /Users/kuang/xiaobu/graphify log --oneline 1a50f2d12bb16f3e5620e1f8944b38786de26026..HEAD
```

如果基线变了，只替换命令里的起点提交，不改模板结构。

## 分类规则

把新提交按下面三类拆开：

- 文档类：README、用户手册、对齐日志、说明页
- 行为类：`src/`、测试、CLI、导出、解析、安装逻辑
- 上游专属类：Python、pipx、Trae、其它与 Node 重写无直接对应的内容

## 对齐判断

对每个新提交，依次回答这几个问题：

1. `graph-spec` 是否已经有等价实现？
2. 如果没有，是否属于必须迁移的用户可见能力？
3. 如果需要迁移，先补测试还是先补文档？
4. 是否会影响 npm 发布内容或命令行为？
5. 是否需要更新对齐日志里的基线状态？

## 处理动作

### 已对齐

- 直接标记为“已对齐”
- 不重复改实现
- 只在对齐日志里补一句说明，避免丢失追踪上下文

### 需要迁移

- 先写最小测试
- 再补实现
- 最后更新 README / 用户手册 / 对齐日志
- 变更完成后运行：

```bash
npm test
npm pack --json
```

### 不需要迁移

- 记录原因
- 说明它为何不适用于 Node 重写
- 保留在对齐日志里，避免下次重复判断

## 建议输出格式

每次汇报尽量按这个顺序写：

1. 本次对比范围
2. 新提交列表
3. 已对齐项
4. 待迁移项
5. 不适用项
6. 下一步动作
7. 是否更新了 `CHANGELOG.md`

## 最低记录标准

每次增量对齐结束后，至少更新这两个地方：

- [`docs/alignment/graphify-alignment-log.md`](/Users/kuang/xiaobu/graph-spec/docs/alignment/graphify-alignment-log.md)
- [`CHANGELOG.md`](/Users/kuang/xiaobu/graph-spec/CHANGELOG.md)

## 备注

- 这个模板只负责流程，不负责结论
- 结论以实际 diff 为准
- 如果基线需要重置，先改对齐日志，再继续使用这个模板
