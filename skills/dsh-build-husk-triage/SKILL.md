---
name: dsh-build-husk-triage
description: Use when a DSH workspace build fails with [MISSING_EXPORT] 符号 is not exported by ../<pkg>/src/index.ts whose reported location is a lib/types/index.js:<行> carrying no package name, or warns [UNRESOLVED_IMPORT] @deepseek-ai/dsh-<x>, while git grep finds no such symbol in HEAD and git status shows no tracked change — 即删包后构建失败、构建报错不带包名、tsdown 报错定位不到包、lib/types 陈旧产物、空壳 / orphan husk 场景。出现 MISSING_EXPORT、UNRESOLVED_IMPORT、空壳、husk、tsdown/rolldown workspace 构建崩了时使用。
---

# DSH 构建空壳（orphan husk）故障处置

删包时只删了跟踪文件，留下了被 `.gitignore` 忽略的 `lib/` + `node_modules/` 残骸目录（空壳）。tsdown 的 workspace glob 按目录名匹配、不检查 `package.json`，于是把空壳当成构建单元，用几天前的陈旧 `lib/types/*.js` 当入口 → 报一个源码里根本不存在的符号。

本机 checkout：`D:\deepseek-harness`（Git Bash 路径 `/d/deepseek-harness`）。下面命令均为 bash（Git Bash）语法。

## 触发条件

同时满足才算本类故障，缺一项就转常规排查：

- 构建报错 `[MISSING_EXPORT] "<符号>" is not exported by "../<pkg>/src/index.ts"`，且报错位置指向某个 `lib/types/index.js:<行>`、不带包名
- 或构建出现 `[UNRESOLVED_IMPORT] '@deepseek-ai/dsh-<x>'` 警告（同源问题，只是降级为警告）
- 且伴随这些"诡异信号"：
  - `git grep <符号> HEAD` 为空
  - 全仓 `grep -rn <符号> --include=*.ts` 在源码里找不到定义
  - `git status` 没有跟踪文件改动
- 关键词：MISSING_EXPORT、UNRESOLVED_IMPORT、tsdown、rolldown、workspace 构建、lib/types、空壳、husk、报错看不出是哪个包、删包之后构建崩了

## 步骤

### 1. 先判定"是不是空壳问题"，不要先查导出面

体检命令必须覆盖 tsdown workspace 的全部根：

```bash
cd /d/deepseek-harness && for d in packages/*/*/ vendor/*/ apps/cli/ apps/desktop-host/; do [ -d "$d" ] && [ ! -f "$d/package.json" ] && echo "HUSK: $d"; done
```

输出为空 = 无空壳。**判据是输出，不是退出码**：该一行命令在干净机器上退出码也是 1（循环最后一次 `[ ! -f ]` 判定失败），实测如此。

### 2. 确认符号在 HEAD 里根本不存在

若为空 → 是"符号已改名/已删"而非"忘了导出"：

```bash
cd /d/deepseek-harness && git grep -n "<符号>" HEAD -- packages apps scripts
```

无匹配时 `git grep` 退出码为 1，属正常，不要当成命令失败。

### 3. 在空壳里找到真正的报错源

报错信息里的 `lib/types/index.js:<行>` 就是入口文件，读它头部即可看到那句陈旧 import：

```bash
head -20 <空壳目录>/lib/types/index.js
```

### 4. 判性质

- 空壳的 `lib/types/*.js` 里 import 了一个在 HEAD 中已不存在的符号 → 「包被删/被改名后留下陈旧产物」（最常见）
- 符号在 HEAD 中存在但真没导出 → 那才是导出面问题，转常规排查

### 5. 修复 = 把空壳移出构建 glob

用「移出保留」而非直接删，可回滚：

```bash
cd /d/deepseek-harness && Q=".runtime/orphan-husks-$(date +%Y%m%d)" && mkdir -p "$Q" \
  && for d in <空格分隔的空壳路径>; do mv "$d" "$Q/$(echo $d | tr '/' '_')"; done
```

`$(echo $d | tr '/' '_')` 把 `packages/settings/settings-file` 变成 `packages_settings_settings-file`（实测）。本机已有等价隔离区 `.runtime/reclaimed-20260926/orphan-husks/`（12 个空壳），只是命名规则不同。

注意：`.runtime/` 不在 `.gitignore` 里，隔离后会以 `?? .runtime/` 出现在 `git status`，这是预期现象。隔离区只在确认修复成立前保留，清理时机与范围见 `## 边界`。

### 6. 定点验证

先验 tsdown 单 pass，比全量 build 快得多：

```bash
cd /d/deepseek-harness && pnpm exec tsdown --env.DSH_BUILD_FACE host 2>&1 | tail -20
```

期望：`EXIT=0`，且 `MISSING_EXPORT` 出现 0 次。`UNRESOLVED_IMPORT` 通常也会一起消失（同源）。要拿到计数就重定向到文件再 grep：

```bash
cd /d/deepseek-harness && pnpm exec tsdown --env.DSH_BUILD_FACE host > /tmp/tsdown-host.log 2>&1; echo "EXIT=$?"; grep -c MISSING_EXPORT /tmp/tsdown-host.log
```

### 7. 全量构建

定点验证全绿后，再跑 `pnpm build`（= `build:native-system` → `build:lib` → `build:web`）。

## 自检

- [ ] 体检命令输出为空（判据是输出，不是退出码）
- [ ] 无跟踪文件改动：`git status --short --untracked-files=no` 为空（本类修复不应产生任何跟踪文件改动；若你的修复动了源码/配置，说明判断错了。不要用裸 `git status --short` 判断 —— 隔离目录 `.runtime/` 会作为未跟踪项出现）
- [ ] `pnpm exec tsdown --env.DSH_BUILD_FACE host` EXIT=0，且 `MISSING_EXPORT` 计数为 0
- [ ] 空壳已落在隔离目录里（有路径可回滚），未使用 `rm -rf` 直接销毁

## 边界

- 不要给活包补上一个"看起来对"的死符号来消错 —— 那是污染 API 并再埋一次雷
- 不要把内部 workspace 依赖标成 external 绕过解析
- 只有当符号在 HEAD 中确实存在时，才走"补齐导出"这条路；否则一律按空壳处理
- 若空壳目录里存在未知文件（不是 `lib/`、`node_modules/`、`.typecheck`、`*.tsbuildinfo` 之类的残留），先停下来问人，不要移动
- 报错在 `lib/types/*.js` 但带包名时，不适用本技能（那可能是真的导出面问题）
- 隔离区清理时机与范围：**`pnpm build` 全量全绿、且人工确认诊断无误后即可删除**；只清 `orphan-husks/` 里的空壳，不要连带清 `reclaimed-<日期>/` 下的 `logs`、`web-dist-old-*`（策略来自用户确认，非材料原文）。删除前至少确认步骤 6 的定点验证已通过；隔离区不是唯一回滚路径 —— 源码可从删包 commit 恢复（实测：`git checkout 601d6761e4^ -- packages/settings/settings-file` 可取回 11 个跟踪文件，该 commit 本身为 0 个），陈旧 `lib/` 可由 tsc 重建

## 细节（渐进式披露）

- 根因四条件、预防五条、否决清单、WorkBuddy 沙箱环境坑 → [references/mechanism.md](references/mechanism.md)
- 真实案例、12 个空壳清单、证据锚点、本次落盘前的现场复核记录 → [references/evidence.md](references/evidence.md)