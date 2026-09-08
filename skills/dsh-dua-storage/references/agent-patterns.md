# Agent 编排与示例

> 目标：Agent 自主完成"发现问题→分析→深入→排除→候选→（可选）历史比较"，输出事实+推测+建议；避免重复扫描与参数漂移。

## 推荐的编排

```
用户: D 盘快满了
  ↓
dua_analyze({ paths: ['D:\\'], depth: 1, sort: 'largest', limit: 30 })   ← 顶层排名
  ↓ 发现 D:\\Work 最大
dua_analyze({ paths: ['D:\\Work'], depth: 2, exclude_patterns: ['**/node_modules/', '**/.git/', '**/Cache/'] })  ← 深入+排除噪声
  ↓
（若目标是"哪些值得人工检查"）
dua_candidates({ paths: ['D:\\Work'], depth: 2 })
  ↓ 报告：事实（路径/大小）+ 推测（类别/置信）+ 建议（manual-review）
```

快照比较流：

```
dua_compare({ operation: 'snapshot', paths: ['D:\\Work'], depth: 1 })   → id A
…一段时间后…
dua_compare({ operation: 'snapshot', paths: ['D:\\Work'], depth: 1 })   → id B
dua_compare({ operation: 'compare', before_id: A, after_id: B })          → growth/shrink/added/removed
```

## 示例问法 → 期望工具

| 用户原话 | 期望 |
|---|---|
| "我的 D 盘空间快满了，看看哪些目录最大" | `dua_analyze` |
| "调查 D:\\DSH_work，忽略 node_modules/.git 和开发缓存" | `dua_analyze`（exclude_patterns） |
| "找出 D:\\DSH_work 中最值得人工检查的空间占用对象" | `dua_analyze` → `dua_candidates` |
| "比较刚才两个空间快照，哪些目录增长最多" | `dua_compare`（compare） |
| "帮我清理/删除 D 盘最大目录" | 只分析并给候选与理由；删除不在本工具集，说明需未来 Action/审批 |

## 防错规则

1. 已有足够深度的数据不要用相同参数重复扫同一路径；多轮只做"更深入/换范围/换测量"。
2. 区分三个工具职责，别让 `dua_candidates` 干扫描、也别让 `dua_compare` 干普通扫描。
3. 结果解读：`partial=true` 不是失败，`ioErrors` 即不可读项；`truncated/skipped` 说明被 limit 丢弃；`measurement` 决定 bytes 语义。
4. 无 key/工具未加载/dua 缺失时如实报告（STORAGE_NOT_FOUND / BLOCKED 类），不假装成功。
5. 输出对用户区分事实与推测；永远不承诺"可安全删除"。

## 安全边界

工具只读；不存在 delete/trash/clean/move/raw command。若要表达未来动作：只能作为"建议 + 用户确认"，等待独立高风险 Action（approval 流），本技能不覆盖。
