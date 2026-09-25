---
name: dsh-project-init
description: 为新的代码仓库或项目初始化与官方 deepseek-harness 同构的 Agent 规则架构：生成 AGENTS.md（项目定位/布局/命令/约定/防御模式/类型与文档规范/编辑规则/变更自检与开发流程，顶层引用 ~/.dsh/AGENTS.md 通用规则）、.agents/skills/（按项目域名前缀裁剪的技能 + 技能规范 README）、.agents/notes/（implemented/proposed/rejected/archived + 六类分类 + supersession 检查）、scripts/ 自检脚本；不覆盖已有 AGENTS.md。当用户说“初始化项目”“新建仓库规则”“搭项目规则骨架”“建立决策记录体系”“项目初始化”“给项目配 AGENTS.md”时使用。
---

# dsh-project-init

以官方 deepseek-harness 仓库的规则架构与开发流程为范本，为目标项目生成**适配的** Agent 规则骨架。官方仓库专属约定（@deepseek-ai 命名、pnpm 等）只作范本参考，不原样注入新项目；仓库专属内容以占位符（TODO）交给项目填充，不做无效照搬。

## 范本位置（本技能 examples/）

| 路径 | 内容（官方原文，供参考与裁剪） |
|---|---|
| examples/official/AGENTS.md | 官方根 AGENTS.md 全文：章节组织、约定、防御模式、类型与文档规范、编辑规则的写法 |
| examples/official/skills/ | 官方 11 个技能原文（dsh-pre-push-checks、dsh-archive-agent-notes、dsh-code-review、dsh-doc、dsh-find-simplifications、dsh-merging-stacked-prs、dsh-ci-test-reliability、dsh-prose-standard、dsh-translate-docs、dsh-trim-cot-leakage、record-browser-gif） |
| examples/official/notes/ | 决策记录体系：README 规则（命名/状态/骨架/分类/归档）、implemented/AGENTS.md（现在时）、archived/AGENTS.md（冻结）、supersession 检查 |
| examples/official/scripts/ | verify gates 原文：agent-note-tree.ts、verify-agent-note-format.ts、verify-agent-note-classification.ts、verify-archived-agent-notes.ts、archived-agent-notes.ts |

## 技能自身目录

- scripts/init.mjs — 生成器：目标目录 → 官方同构骨架
- scripts/check.mjs — 自检：技能 frontmatter / examples 完整性 / templates 占位符一致性
- templates/ — 生成骨架的模板文件（init.mjs 做 {{TOKEN}} 替换）
- examples/ — 官方原文范本

## 触发条件

- 目标目录**没有** AGENTS.md / 规则体系，需要按官方章节结构建立
- 需要给新项目配决策记录体系、项目技能、自检脚本

## 步骤

1. **收集项目信息**：目标目录绝对路径、项目名（PROJECT_NAME）、域名前缀（DOMAIN，决定 .agents/skills/ 下技能名前缀，如 hermes-pre-push-checks）。
2. **前置检查（边界）**：目标目录已存在 AGENTS.md → **停止**，不覆盖；向用户说明可用手工合并。
3. **运行生成器**（Windows 用 $env:USERPROFILE\.dsh\ 展开 ~）：
   ~~~sh
   node ~/.dsh/skills/dsh-project-init/scripts/init.mjs <目标目录> --domain <域名> --name <项目名>
   ~~~
4. **填充 AGENTS.md 占位符**：按 <TODO 由项目填充：…> 逐节填项目定位/布局/命令/约定/防御模式/类型与文档规范；写法对照 examples/official/AGENTS.md（一条一行、指向真实命令、防误用显式化）。
5. **裁剪项目技能**：读 examples/official/skills/ 对应范本，把生成骨架（{{DOMAIN}}-pre-push-checks、{{DOMAIN}}-code-review、{{DOMAIN}}-archive-agent-notes、{{DOMAIN}}-doc）里的 TODO 换成本项目真实命令与流程；项目另有需求时按同结构补技能（前缀 {{DOMAIN}}-）。技能规范见生成的 .agents/skills/README.md。
6. **核对决策记录体系**：生成的 .agents/notes/README.md 已含命名/状态/分类/supersession 检查规则与 implemented/proposed/rejected/archived 目录；有早期决策就按格式补第一条 implemented/{kind}/yyyy-mm-dd-主题.md。
7. **运行自检**（生成项目内）：
   ~~~sh
   node scripts/check.mjs
   ~~~
   失败则修复到通过，再交付。

## 自检（完成标准）

- 技能安装后：node ~/.dsh/skills/dsh-project-init/scripts/check.mjs 通过（frontmatter / examples 完整性 / 模板占位符一致）。
- 生成骨架齐全：AGENTS.md（8 个必需章节 + 引用 ~/.dsh/AGENTS.md）、.agents/skills/（README + ≥1 个 <域>-* 技能）、.agents/notes/（README + implemented/proposed/rejected/archived × 6 类目录）、scripts/check.mjs。
- 生成项目内 node scripts/check.mjs 通过。

## 边界

- **不覆盖已有 AGENTS.md**；目标已有则停止并说明。
- **不原样注入官方专属约定**：@deepseek-ai 命名、pnpm 工作区、官网文档同步等只作范本参考；生成物里以 TODO 占位，由项目自己填真实技术栈。
- 生成骨架≠项目内容：仓库专属细节必须由项目填充，禁止为了“看起来完整”编造命令或结构。
