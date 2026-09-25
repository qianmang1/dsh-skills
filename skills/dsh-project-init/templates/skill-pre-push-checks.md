---
name: {{DOMAIN}}-pre-push-checks
description: Use when 推送/force-push/标 ready for review/声称检查通过前，为 {{PROJECT_NAME}} 选最小覆盖 diff 的本地检查，不反射性跑全量套件。
---

# {{DOMAIN}} Pre-Push Checks

官方范本：examples/official/skills/dsh-pre-push-checks/SKILL.md（本文件为其裁剪版，TODO 即待项目填充部分）。

## 触发条件

- 推送、force-push、标记 ready for review、声称检查通过之前
- <TODO 由项目填充：本仓库的其它触发场景，如合并/发布前>

## 步骤

1. 查看变更与基提交：
   ~~~sh
   git status --short --branch
   git rev-parse --show-toplevel
   ~~~
2. <TODO 由项目填充：按变更类型列出覆盖它的最小检查集（对照 AGENTS.md「命令」节，命令必须真实存在）。>
3. 只跑一遍所需检查；已通过的检查不重复；CI 负责全量与平台矩阵。

## 自检

- 所列命令都在本项目真实存在（跑过 <TODO 由项目填充：典型一条命令>）
- 交付前 node scripts/check.mjs 通过

## 边界

- 不默认全量套件；仅用户显式要求、CI 诊断、或仓库级变更时才本地全量排练
- <TODO 由项目填充：本仓库不可绕过的额外门槛，如必须的签名/凭证流程>
