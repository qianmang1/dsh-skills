# 真实案例 · 证据锚点 · 落盘前现场复核

## 案例：SettingsProvider MISSING_EXPORT（2026-09-26）

- 空壳：`packages/settings/settings-file/` —— 该包连同 `SettingsProvider` → `SettingsForms` 的改名一起被 commit `601d6761e4` 删除（现 0 个跟踪文件）
- 报错：`MISSING_EXPORT: "SettingsProvider" is not exported by "../settings/settings/src/index.ts"`，位置 `lib/types/index.js:17`
- 该文件第 17 行就是 `import { SettingsProvider } from '@deepseek-ai/dsh-settings';`
  （本次复核确认：`.runtime/reclaimed-20260926/orphan-husks/packages_settings_settings-file/lib/types/index.js:17` 逐字一致）
- 活代码实际导入的是 `SettingsForms` / `SettingsDescriptor` / `SettingsPathOp` / `default` —— 四项均已正确导出，settings 包导出面本身没问题
- 同批共 12 个空壳（合计 4.1M）：
  - `packages/settings/settings-file`
  - `packages/code-runtime/code-runtime`
  - `packages/code-runtime/code-runtime-worker-thread`
  - `packages/e2b/e2b`
  - `packages/e2b/fs-e2b`
  - `packages/e2b/subprocess-e2b`
  - `packages/experimental/agent-team-web-profile`
  - `packages/experimental/code-runtime-python`
  - `packages/preset/agent-presets`
  - `packages/client/ui-settings-unarchive-sessions`
  - `packages/client/ui-sidebar-textpreview`
  - `packages/workflow/workflow-worker-thread`
  - 其中两个 code-runtime 就是 `UNRESOLVED_IMPORT` 的来源

## 证据锚点（可回查）

- 完整报告：`D:\DSH_work\reports\2026-09-26-dsh-settingsprovider-missing-export.md`
- 项目记忆：`D:\DSH_work\.workbuddy\memory\MEMORY.md` 的「DSH 构建管线关键事实」→「核心陷阱」段，以及 `D:\DSH_work\.workbuddy\memory\2026-09-26.md`
- 本次隔离区：`D:\deepseek-harness\.runtime\reclaimed-20260926\orphan-husks\`（12 个空壳，可回滚）
- WorkBuddy safe-delete 环境坑的原始记录同样在 `D:\DSH_work\reports\2026-09-26-dsh-settingsprovider-missing-export.md`

## 技能落盘前的现场复核（2026-09-26，Git Bash / PowerShell 实跑）

复核前提：写技能文件前逐条重跑材料中的命令，确认现场未变。

| 复核项 | 命令 | 结果 |
| --- | --- | --- |
| 空壳体检 | 步骤 1 的一行命令（Git Bash，`C:\Program Files\Git\bin\bash.exe`） | 遍历 323 个候选目录（`DIRS_ITERATED=323`），无 `HUSK:` 输出 → 当前无空壳；退出码为 1（干净时也如此，见 SKILL.md 步骤 1 说明） |
| 空壳体检等价复核 | PowerShell：`packages\*\*` + `vendor\*` + `apps\cli` + `apps\desktop-host` 逐目录查 `package.json` | `HUSK_COUNT=0`，`ROOTS_SCANNED=323`（与上一行一致） |
| 跟踪文件状态 | `git status --short` / `git status --short --untracked-files=no` | 仅 `?? .runtime/`（隔离区，未跟踪）；限制为已跟踪时输出为空 → 无跟踪文件改动 |
| 符号在 HEAD 中不存在 | `git grep -n SettingsProvider HEAD -- packages apps scripts` | 无匹配（`git grep` 退出码 1） |
| 定点验证 | `pnpm exec tsdown --env.DSH_BUILD_FACE host` | `EXIT=0`，`MISSING_EXPORT=0`，`UNRESOLVED_IMPORT=0`，日志 2746 行 |
| 隔离区实存 | `ls -1 .runtime/reclaimed-20260926/orphan-husks \| wc -l` | 12；内容只含 `lib/` 与 `node_modules/` |
| 隔离区路径构造 | `Q=".runtime/orphan-husks-$(date +%Y%m%d)"` + `echo $d \| tr '/' '_'` | `Q=.runtime/orphan-husks-20260926`；`packages/settings/settings-file` → `packages_settings_settings-file` |
| tsdown 版本与实现 | `node_modules/tsdown/package.json`、`node_modules/tsdown/dist/` | 版本 `0.22.2`；存在 `options-DWGUHu4D.mjs`、`build-BxT2lm9L.mjs`（glob 的 `onlyDirectories: true` 实测在后者 `:65-71`） |
| 配置事实 | `tsdown.config.ts`、`.gitignore`、`scripts/build.ts`、`package.json`、`lefthook.yml`、`scripts/clean.ts` | workspace glob 与 entry 见 `tsdown.config.ts:22-25`；`.gitignore:6-7` 为 `node_modules/`、`lib/`（`.runtime/` 未被忽略）；`scripts/build.ts:44-46` 为三行 `runScript(...)`；`build` / `build:lib:host` / `build:web` / `clean` 脚本名与内容一致；`lefthook.yml` 的 `pre-commit` 注释自认删 manifest 不触发，`pre-push` 仅 `pnpm run typecheck`；`scripts/clean.ts:7,102` 的已知残留集合为 `node_modules`/`lib`/`.typecheck`/`*.tsbuildinfo`，未知项 fail-closed |

复核结论：现场与材料一致，未发现新增空壳，未改动 `D:\deepseek-harness` 的任何跟踪文件。

## 查重记录（落盘前）

检查了四个技能根目录，无同职责技能：

- `C:\Users\Y\.dsh\skills`：archify、blender-addon-cn、dsh-caveman、dsh-hermes-plugin、dsh-project-init、ponytail、search-filter、skill-maker
- `C:\Users\Y\.agents\skills`：find-skills、zcode-session-sediment、migrate-radix-to-base、agently-mail、lark-*
- `D:\deepseek-harness\.agents\skills`：agent-experience、dsh-archive-agent-notes、dsh-ci-test-reliability、dsh-client-ui-ux、dsh-code-review、dsh-doc、dsh-find-simplifications、dsh-merging-stacked-prs、dsh-pre-push-checks、dsh-prose-standard、dsh-speed-up-perf、dsh-translate-docs、dsh-trim-cot-leakage、record-browser-gif
- `D:\deepseek-harness\.dsh\skills`：不存在

全目录检索 `MISSING_EXPORT|UNRESOLVED_IMPORT|空壳|husk|orphan husk` 无命中的同职责技能；最近的邻居是 `dsh-pre-push-checks`（只做 push 前的证据选择，不诊断已发生的构建失败）与 `dsh-ci-test-reliability`（测试 flake），均不同职责。