# dsh-project-init 安装说明

技能源码位于本目录（dsh-project-init-src/），已通过自检（node scripts/check.mjs）。

## 目标位置

~/.dsh/skills/dsh-project-init/（user-dsh 源，全部工作区可用；DSH 自动发现，无需注册）

## 一键安装（PowerShell）

~~~powershell
$src = 'C:\Users\Y\Documents\ChatGPT\DeepSeek-Hermes\dsh-project-init-src'
$dst = "$env:USERPROFILE\.dsh\skills\dsh-project-init"
if (Test-Path $dst) { Remove-Item -Recurse -Force $dst }
Copy-Item $src $dst -Recurse -Force
node "$dst\scripts\check.mjs" "$dst"   # 安装后自检
~~~

## 用法（初始化一个项目）

~~~sh
node ~/.dsh/skills/dsh-project-init/scripts/init.mjs <目标目录> --domain <域名前缀> --name <项目名>
cd <目标目录> && node scripts/check.mjs
~~~

## 结构

- SKILL.md — 初始化工作流（步骤 / 自检 / 边界）
- scripts/init.mjs — 生成器（AGENTS.md / .agents/skills/ / .agents/notes/ / scripts/）
- scripts/check.mjs — 技能自身自检
- templates/ — 生成骨架模板（{{PROJECT_NAME}} / {{DOMAIN}} 占位符）
- examples/official/ — 官方 deepseek-harness 原文范本（根 AGENTS.md、11 技能、notes 体系、verify gates）
