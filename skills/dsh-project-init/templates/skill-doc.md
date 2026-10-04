---
name: {{DOMAIN}}-doc
description: Use when 创建/重构/评审/审计 {{PROJECT_NAME}} 的 Markdown 文档、README、注释或官网内容，按受众优先层级与项目规范维护。
---

# {{DOMAIN}} Documentation

官方范本：examples/official/skills/dsh-doc/SKILL.md（裁剪版）。

## 触发条件

- 新增/移动/精简/评审文档、README、JSDoc；改文档类配置（站点、链接）

## 步骤

1. 先读 AGENTS.md「类型与文档规范」节与本仓库文档入口：<TODO 由项目填充：文档位置与结构约定>。
2. 按受众优先层级组织：<TODO 由项目填充：一级/二级标题结构、单段一行、事实唯一归属等约定>。
3. 文档随代码变更同步更新；删减时先查引用（<TODO 由项目填充：死链/引用检查命令>）。

## 自检

- 无死链；事实与代码同步；目录/链接指向存在
- 交付前 node scripts/check.mjs 通过

## 边界

- 不把文档当交流记录写（“为什么”归 .agents/notes/）
- <TODO 由项目填充：本仓库不维护文档的部分>
