---
name: {{DOMAIN}}-code-review
description: Use when 评审 {{PROJECT_NAME}} 的 pull request 或本地改动，对照 AGENTS.md 章节、决策记录与自检门槛给出结构化评审。
---

# {{DOMAIN}} Code Review

官方范本：examples/official/skills/dsh-code-review/SKILL.md（裁剪版）。

## 触发条件

- 评审 PR / 分支 / 本地未提交改动
- 被要求 review、或自审大幅改动

## 步骤

1. 先读 AGENTS.md 的「约定」「防御模式」「类型与文档规范」三节，建立评审基准。
2. 看变更范围与决策记录：<TODO 由项目填充：本仓库查 diff 与相关笔记的具体命令/入口>。
3. 逐项核对：行为测试覆盖、文档随动、防御模式、types 严格度、去重。
4. 输出结论：批准 / 需修改（逐条可执行）/ 拒绝（给理由）。

## 自检

- 每条意见都指向具体文件/行与 AGENTS.md 或笔记里的依据
- <TODO 由项目填充：本仓库评审必须过的门禁清单>

## 边界

- 不做代码以外的评审（设计变更走决策记录）
- <TODO 由项目填充：不评审的场景，如 WIP/草稿>
