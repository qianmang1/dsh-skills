---
name: dsh-dua-storage
description: 指导使用 DeepSeek Harness 的 Storage Agent 工具（dua_analyze / dua_candidates / dua_compare，由 @deepseek-ai/dsh-tool-dua-storage 提供）：磁盘空间分析、清理候选发现、Storage Snapshot 比较。当用户需要分析目录占用、找最大目录、排除噪声深入调查、寻找值得人工检查的空间对象、比较两个时间点的空间快照、或询问这些工具的能力与参数时使用。
---

# dsh-dua-storage — Storage Agent 工具使用指南

本技能说明由 `@deepseek-ai/dsh-tool-dua-storage`（底层 dua 2.44.0）提供的三个只读 Agent 工具，遵循 dsh-hermes-plugin 的渐进式披露原则：SKILL.md 只放决策主干，细节分层放入 references，按需加载，避免一次性灌输。

## 渐进式披露（先读主干，按需深入）

1. 先用本文件判断：用户的诉求该用哪个工具、能不能用（触发/边界）。
2. 需要逐参数设计调用 → 读 `references/capabilities.md`（能力、参数、默认值、canonical、错误码）。
3. 需要多轮编排/示例/避免重复扫描 → 读 `references/agent-patterns.md`。
4. 能力或行为与本文不符时，以该工具当前源码/实际 dua 行为为准并回查，不臆造。

## 触发条件

- 用户要分析磁盘/目录空间占用、排名最大目录、递归深入调查占用构成
- 用户要求排除噪声（node_modules/.git/缓存等）后分析
- 用户要"找出值得人工检查/清理的空间对象"（只做候选，不删除）
- 用户要比较两次空间快照（哪些目录增长/减少、新增/消失）
- 用户询问 Storage 工具的清单、能力、参数、用途
- 关键词：磁盘满、空间不够、占了多少、最大目录、缓存太多、清理建议、快照对比、dua

## 步骤（核心决策）

1. **选工具**：
   - 要"空间事实/排名/递归/排除/测量" → `dua_analyze`
   - 要"把分析结果分类成潜在检查对象（缓存/依赖/构建/虚拟机等）" → `dua_candidates`
   - 要"比较两个时间点/状态的快照变化" → `dua_compare`
   - 三者都可独立使用；典型编排 analyze →（深入）analyze → candidates →（若有历史）compare。
2. **确认运行环境**：工具包需被当前 profile 加载（overlay/依赖安装），dua 可执行可解析（Config `duaExecutable`，本机不在 PATH 时给绝对路径）。
3. **调用并消费 canonical**：把结果当结构化数据用（bytes 为整数、entries 含 path/bytes/dir/level），不要只看 render 文本；truncated/partial/ioErrors 必须显式处理。
4. **编排约束**：已有足够深度时不要用相同参数重复扫描同一路径；向用户输出"事实 + 推测 + 建议"，候选一律 manual-review。
5. 完成后对照自检。

## 自检

- 用了正确工具（analyze 不承担快照比较；candidates 不被当作删除工具）
- 调参正确（paths/depth/limit/exclude/apparent_size 等与用户目标一致）
- canonical 被正确解读：measurement 说明 disk/apparent；partial=true 时 ioErrors 已说明；truncated/skipped 已注明
- 未执行、未建议、未暗示任何删除/移动/清理动作（工具只读）
- 未出现明显重复扫描或参数漂移
- 输出给用户的结论区分了事实（大小/名称）与推测（类别/可清理性）

## 边界

- 工具是只读的：不处理"请删除/清空/移动 XX"的执行请求——只分析并给出候选与理由，删除需走未来的高风险 Action 与审批，本技能不指导任何破坏性动作
- 不做 raw dua 调用：不构造 command/argv 字符串直通 dua，只走 `dua_analyze/candidates/compare`
- 不适用于非空间类文件系统问题（如读写文件内容、移动文件、磁盘分区管理）——那些用 fs/shell 类工具
- 不修改工具包、不修改 DSH 核心；遇到行为疑点记录并回查，不臆造参数
- 无真实运行环境（工具未加载/dua 缺失）时明确报告，不假装调用成功
