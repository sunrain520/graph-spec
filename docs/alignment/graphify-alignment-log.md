# graphify 对齐日志

本文用于记录 `graph-spec` 与 `/Users/kuang/xiaobu/graphify` 的对齐基线，后续所有增量比对都从这里继续。

## 基线信息

- 对齐来源仓库：`/Users/kuang/xiaobu/graphify`
- 记录日期：`2026-04-09`
- 当前对齐提交：`1a50f2d12bb16f3e5620e1f8944b38786de26026`
- 对应提交说明：`add Penpax link to README`
- 远程分支：`origin/v3`
- 本地 `graph-spec` 快照：`c1f38f4` (`feat: complete nodejs graph-spec rewrite`)

## 这条基线代表什么

这条提交点是当前已完成对齐工作的起点。后续只需要比较 `graphify` 在这条提交之后的新提交，就能得到 `graph-spec` 还需要增量吸收的内容。

## 当前已经对齐的范围

- `graph.json` 与 LLM 工作流说明
- `MCP` 直接接入说明
- 输出目录与文案的同步
- `Julia .jl` 支持
- README 与用户手册的主线说明

## 后续使用方式

1. 先从 `graphify` 的新提交里筛选 2026-04-09 之后的变化
2. 再按功能分类判断是否需要迁移到 `graph-spec`
3. 如果是文档级差异，优先更新 README 或用户手册
4. 如果是行为级差异，先补测试，再补实现

## 备注

- 这份日志不替代 review 文档
- review 文档用于结论，这份日志用于持续追踪增量差异
- 如果后续重新确认新的对齐基线，只在这里追加新的时间线记录，不覆盖旧记录
