---
name: dsh-hermes-plugin
description: 根据用户的自然语言需求，自动生成符合 DeepSeek Harness（dsh-Hermes）官方插件规范的完整、可分发、可直接打包部署的插件工程。当用户要求开发/生成/创建 dsh-Hermes 插件、dsh 插件、harness 插件、Cordis 插件，或要为 deepseek-harness 编写工具插件、服务插件、hook/权限门、LLM adapter、UI 插件或 bundle 时使用。
---

# dsh-Hermes 插件生成

根据用户自然语言需求，生成严格遵循 DeepSeek Harness 官方开发文档的完整插件工程。用户口中的 "dsh-Hermes" 即 DeepSeek Harness（缩写 dsh），其插件框架为 vendored 的 Cordis（`@deepseek-ai/cordis`）。文档中不存在名为 "Hermes" 的独立体系，一律按 dsh 官方规范生成。

## 知识库边界与文档回查

> Skill 版本：v1.2（2026-09-08）；知识库提炼自 docs @ c389f96bf3 快照（dsh 0.1.3-alpha.2）。

本 Skill 的 references 是提炼后的**决策主干**，不是官方文档全量副本。生成代码遇到以下情况时必须回查官方文档（用 WebFetch/WebSearch 抓取对应 GitHub 页面）：

- **官方文档（权威来源）**：`https://github.com/deepseek-ai/deepseek-harness/tree/master/docs`
- 本地存在 checkout（如 `C:\Users\Y\Desktop\deepseek-harness\docs`）时优先读本地，路径与 GitHub 相同。

### 版本纪律（必守）

1. **先定目标版本再生成**：从用户环境确定目标 dsh 版本——优先读本地 checkout 根 `package.json` 的 `version`；无本地环境时询问用户或从其依赖声明（profile 的 package.json 中 `@deepseek-ai/dsh-base`/cordis 版本）推断；都没有则按 master 最新文档生成并在交付说明中标注假设。
2. **文档版本对齐**：GitHub `master` 是最新开发态；用户目标版本较旧时改用对应 **tag/分支** 的 docs（`https://github.com/deepseek-ai/deepseek-harness/tree/<tag>/docs`），不得拿 master 的新 API 生成旧版插件，反之亦然。
3. **API 以目标版本源码/文档为准**：版本间接口可能增删改——回查到的签名必须来自与目标版本一致的文档或源码（`vendor/cordis`、`packages/*/src`）；不同版本差异不得凭记忆脑补。
4. **交付标注溯源**：交付说明中必须写明"生成所依据的文档版本/commit 与目标 dsh 版本"，便于用户核对漂移。

回查映射：

| 需要什么 | 回查路径（相对 docs/） |
|---|---|
| 冷门子系统的 ctx key、类型定义、生成的 API 表 | `subsystems/<name>.md`（45 个：session、persistence、webhook、subagent、sandbox、settings、storage、jobs、plan、todo、workflow…） |
| Host/Client 拆分、remote API 包 | `cookbook/adding-a-remote-api.md` |
| UI 设置卡片 | `cookbook/adding-a-settings-card.md` |
| vendored 包 | `cookbook/adding-a-vendored-package.md` |
| Context API 全表、类型签名 | `cordis-api/`、`cordis-tutorial/` |
| 服务隔离、HMR、组合 | `user/develop/framework/service.md`、`cordis-tutorial/06-composition-and-hmr.md` |
| 测试细节（fixture/snapshot/录制会话） | `testing.md` |

规则：回查到的 API 签名逐字使用，不得凭记忆复述；仍未找到时按 spec.md 的命名规范自行设计并在交付说明中标注假设。

## 工作流

1. **加载知识库（必做）**：先完整阅读 `references/spec.md`（核心规范：插件形态、生命周期、依赖注入、配置、命名）。再按需求补充：
   - 涉及工具注册、事件监听、服务提供、hook、LLM adapter、UI → 读 `references/registries.md`
   - 涉及打包、分发、profile 安装 → 读 `references/distribution.md`
   - 交付前自检 → 读 `references/checklist.md`
2. **分析需求并归类插件形态**：工具插件（defineTool）/ 服务插件（Service 子类 + provider）/ hook 权限门（pre-execute 监听）/ LLM adapter / UI 插件（监听 session/event）/ 纯行为插件。一个需求可组合多种形态，但保持单包。
3. **澄清（仅在阻塞时）**：只有当缺失的关键信息会导致生成不可用代码时才提问（例如：插件要消费哪个服务、分发形态是 bundle 还是 workspace 包），且一次问完、合并为单轮；能从需求合理推断的默认值直接采用并在产出说明中标注假设，不要追问。
4. **选择工程形态并搭建**：
   - 可分发插件（默认，官方"可直接部署"形态）→ 复制 `assets/bundle-plugin/` 为起点（package.json + cordis.patch.yml + index.js，占位符 `<PLUGIN_NAME>`/`<PLUGIN_ID>` 全部替换）。
   - deepseek-harness 仓库内新包 → 复制 `assets/workspace-package/`（三角色拆分、tsconfig references 等遵循 `docs/cookbook/adding-a-package.md`，参考真实模板 `packages/shell/shell/`、`packages/shell/bash-local/`）。
5. **生成代码**：严格套用 spec.md 与 registries.md 中的接口签名与真实代码模式；JSDoc 每个导出写简洁契约；strict TypeScript；从 workspace 包源码内相对导入带显式 `.ts` 后缀。
6. **校验**：运行 `python scripts/validate_plugin.py <插件目录>`，修复全部 ERROR 后才算完成；WARNING 需逐条确认或在产出说明中解释。
7. **输出**：结构化交付（见下）。

## 硬性约束（违反即返工）

- 入口必须是 namespace 具名导出：`export const name`、`export const inject`、`export interface Config` + `export const Config`（Schemastery schema）、`export function apply(ctx, config)`。**禁止 `export default`**（Loader 的 unwrapExports 会丢弃 inject/name/Config，见 postmortem 0001）。
- 可调参数一律进 Config schema（判据：不改代码只改 cordis.yml 能否改变该值）；协议常量、安全不变量保持固定；配置校验 fail loud。
- 一切注册皆 effect：经 `ctx` 的注册（on/register/plugin/timer）卸载自动回收；需显式清理的资源放进 `ctx.effect(() => { ...; return disposer })`；禁止手动 removeListener/clearInterval。
- 可选读取（未声明 inject）的服务用 `ctx.get(name)`，绝不用 `ctx.<name>`；`!!js` 只出现在 entry 的 `config` 与 `disabled`；工具 `execute` 只返回 canonical value（不得返回 content blocks）；`turn/*`、`tool/call` 等持久会话事件类型要监听 `session/event` 并检查 `event.type`。
- 依赖顺序用 `inject` 表达，不依赖 yml 行顺序；waterfall 监听器只观察时必须调用 `next()`。
- 密钥走 Config + `!!js process.env.X`（是 `!!js`，永远不是 `!js`）；禁止代码内读临时密钥文件。
- 命名：分发包 `dsh-<name>`，workspace 包 `@deepseek-ai/dsh-<name>`；服务注册名（ctx key）加独特前缀；事件名 `namespace/action`。

## 交付结构

1. 插件功能说明（一段话 + 触发/使用方式）
2. 完整文件树
3. 每个文件的完整内容（不得省略、不得用 "..." 占位）
4. 安装与使用：
   - bundle：`dsh plugin --profile <profile> add <目录或 git/tarball 路径>`，启动 `dsh --profile <profile>`
   - 本地调试：`pnpm dsh web --patch ./<插件目录>/cordis.yml`（patch 中插件路径必须为绝对路径）
   - workspace 包：`pnpm install && pnpm run constraints && pnpm run typecheck && pnpm run build`
5. 生成过程中做出的假设（如有）
