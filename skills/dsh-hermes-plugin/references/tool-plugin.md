# Tool Plugin 规范：工具路由、三种模式与 External CLI 适配

> 知识库来源（与 spec.md、registries.md 同一快照 docs @ c389f96bf3 / dsh 0.1.3-alpha.2）：`docs/cookbook/adding-a-tool.md`、`docs/user/develop/basic/tool.md`、`docs/tool-catalog.md`、`docs/architecture.md`（Where new behavior goes）、`docs/subsystems/{shell,subprocess}.md`、`docs/user/develop/practice/index.md`、`docs/cordis-tutorial/07`。真实源码实证：`packages/shell/tool-bash`、`packages/fs/tool-fs-search`、`packages/fs/tool-fs`、`packages/todo/tool-todo`。
> 本文是 Tool Plugin 的`唯一完整知识源`；registries.md 只留索引指针。签名一律以本文与官方 docs 为准；生成前先读本文，再按目标版本回查官方文档逐字核对签名。
## 1. 何时走 Tool Plugin 路由

**触发**（命中其一）：

- 开发一个 DSH Tool / 给 Agent 增加模型可调用能力
- 把外部 CLI 接入 DSH（Everything、dua、fd、ripgrep、ffmpeg、Blender CLI…）
- 把某个 API / 服务接入 DSH，使模型能够调用
- 让模型调用某个外部程序
- 创建带参数 Schema 的模型可调用能力

**不触发**（回到其它形态或提示复用）：

- 只提供其他插件使用的 Service（→ Service Plugin / 三角色 Definition）
- Provider（seam 实现方）、Hook / 权限门、UI、LLM Adapter、Agent Loop 修改
- 已存在等价 Tool 的重复封装（内置 bash/pwsh/fs 工具、glob/grep/read 已覆盖的能力，先确认再决定）

**核心判据**（一句话）：最终产物是否是一个`注册到 `ctx.tools`、拥有模型可见名称与参数 Schema 的能力`？是 → Tool Plugin；否 → 其它形态。
## 2. 基础契约（每个 Tool Plugin 必守）

```ts
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'my-tool'
export const inject = ['tools']           // 工具注册表就绪后才 apply

export function apply(ctx: Context) {
  ctx.tools.register(defineTool({
    name: 'read_file',                     // 模型可见名称
    description: 'Read a file from disk.', // 模型可见说明；写明边界与副作用
    parameters: {                          // ParameterSchemaSpec：类型/必填/枚举/nested 由 DSL 校验
      path: { type: 'string', required: true, description: 'Absolute path' },
      limit: { type: 'number' },           // 不加 required 即可选
    },
    output: {
      schema: { type: 'string' },          // ValueSchemaSpec：root 可为 object/array/scalar/null
      render: (_args, value) => [{ type: 'text', text: value }], // 模型可见投影
    },
    async execute(args, exec) {
      // args 已按 schema 校验 + 类型推断；DSL 表达不了的约束在此手写 validate（先做）
      // exec = { callId, name, arguments, agent, token, signal }：身份不可变
      return readFile(args.path, { encoding: 'utf8', signal: exec.signal })
    },
  }))
}
```

逐条契约（官方 adding-a-tool + 真实包实证）：

- `namespace 导出`：`export const name`、`export const inject`、（可选）Config/Schemastery Config、`export function apply(ctx, config)`；**禁止 export default**（postmortem 0001）。
- `注册即 effect`：`ctx.tools.register()` 是 effect，插件卸载自动注销；注册借走 readonly 定义，注册后不得改 schema/callback（热替换 = dispose 旧 effect + 注册新定义）。
- `execute 只返回一个 canonical JSON value`：依 output.schema 校验后 freeze。**绝不返回 content blocks、绝不返回 UI 格式**。模型可见文本由 output.render(args, value) 投影；需要回放卡片数据时加 output.presentationMeta(args, value)（纯函数、有界、由同一 canonical value 派生）。
- `output.schema 当作程序化 API 设计`：返回句柄与字段本身；能标量/数组/null root 就用诚实的值；人类解释放 render。
- `exec.signal 必须尊重`：取消在飞工作（spawn/readFile 传 signal）；exec 其余字段不可变，只有 around-dispatch 包装器可替换 exec.signal。
- `session cwd`：工作目录事实来源是 exec.agent.session.header.cwd（无 agent 回退 process.cwd()）；相对 workdir 由工具 resolve 成绝对（tool-bash resolveWorkdir 实证）。
- `DSL 外约束手写 validate`：非空串、正整数、跨字段规则（validateBashArgs / parseGrepArgs / toTodoList 实证）；execute 开头先跑，throw 普通 Error。
- `条件 schema / 条件注册`：字段随组合存在与否展开（沙箱升级参数只在 confining backend 挂载时出现）；注册可组合条件（tool-fs 用 ctx.inject(['attachments'], ...) 实证：无该服务则工具不注册）。
- `PTC 免费可用`：await tools.<name>(args) 解析为 canonical value（失败 reject 真实 ToolCallError）；无需额外集成。
- `UI 展示与模型结果分离`：presentCall/presentResult 返回 card-tagged render intent（generic/terminal/diff/read/search/web），必须为纯函数（重放安全，禁 I/O/时钟）；不需要 UI 卡时省略，回退 generic。
- `不把部署策略内建进工具`：allow/deny/ask 走 tools/pre-execute；单调否决走 ctx.tools.guard()；包装派发走 tools/execute；变换结果走 tools/post-execute；只读观察走 tools/result。
- `后台长任务`：门控 run_in_background 配置后经 ctx.jobs.start({ kind, label, owner: exec.agent, run })；**发布 jobId 后取消走任务自有 signal，不再用 exec.signal**（tool-bash 实证）。
- `交叉调用指引`：进系统提示 ctx.systemPrompt.section（tool-bash/tool-fs-search 实证），不塞进单次 schema 散文。
## 3. 三种 Tool Plugin 模式（选型）

收到能力需求后先做归属判断，不要默认直接写执行逻辑。

### 模式 A：Seam Consumer（优先）

DSH 已有该能力的 service seam 且语义匹配 → **消费 seam**；工具层只做 schema/校验/canonical/展示（官方三角色里的 Consumer）。

| 需要的能力 | 消费的 seam（ctx key） | 实证 Consumer |
|---|---|---|
| 执行任意命令 | ctx.shell（resolve() 拆分 request/spec → run()） | dsh-tool-bash |
| 读写/编辑文件 | ctx.fs（fs/* 观察门禁由 dsh-fs-observation-policy 提供） | dsh-tool-fs |
| 子进程执行 | ctx.subprocess（见模式 B 用法） | dsh-tool-fs-search |
| 持久终端 | ctx.terminals | dsh-tool-bash-persistent |
| 会话状态 | ctx.sessionProjections / exec.agent.session.append | dsh-tool-todo |

命令的执行者（Provider，如 dsh-bash-local）与沙箱策略独立于工具；工具不重复实现执行/沙箱。

### 模式 B：Spawn-backed Tool（固定外部 CLI）

没有匹配的 DSH seam、目标是封装固定外部 CLI → 工具层直接 ctx.subprocess.spawn()（实证：tool-fs-search 封装随包捆绑的 ripgrep；其源码注释给出判据 "Spawn-backed, not a ctx.fs provider method"）。

- **npm 依赖捆绑二进制最稳**（@vscode/ripgrep 实证）：无系统安装要求、版本可控。
- 依赖用户系统安装的 CLI 时：description 写明前置条件；启动失败给可操作错误；**不要在 execute 里用 shell 探测**。
- 进程管理（spawn/进程树终止/环境清刷/输出采集）归 ctx.subprocess seam；工具层拥有 schema/校验/argv 构造/输出解析/retention。

### 模式 C：New Seam（三角色）

只有能力需要**可替换后端、多 Provider、独立生命周期**时才新增 Definition/Provider/Consumer（dsh-shell / dsh-bash-local / dsh-tool-bash 模式）。**简单工具插件不拆包**——不要预先把工具做成 seam。
## 4. External CLI Adapter 决策树

```
收到外部 CLI 需求
        ↓
DSH 是否已有对应 seam（ctx.shell / ctx.fs / ctx.subprocess / …）？
        │
   ┌────┴────┐
   │         │
  有         无
   │         │
   ↓         ↓
消费 seam   是否封装固定 CLI？
（模式 A）      │
          ┌──┴──┐
          │     │
         是     否（能力需可替换后端 / 多 Provider）
          │         │
          ↓         ↓
   ctx.subprocess  评估新 seam 三角色
   spawn（模式 B）    （模式 C）
```

进入模式 B 后的强制规则（官方文档 + 源码依据）：

1. **argv 用数组，不用 shell 字符串**。模型/用户输入一律 argv 元素；绝不用 bash -c、cmd /c、PowerShell 字符串插值拼用户输入。
2. **参数与 CLI option 明确分离**：option 用 --flag=value 形式；可变目标路径放 -- 之后（前导 - 的值不会被解析成 flag，tool-fs-search buildGrepCommand 实证）。
3. **防御 CLI 自带配置注入**：rg 前加 --no-config（防 RIPGREP_CONFIG_PATH 注入任意 --pre 执行）；封装其它 CLI 时检查其配置文件/环境变量能否注入行为。
4. **固定 executable**：argv[0] 来自包内捆绑路径，或经 seam 的 resolveExecutable 解析裸命令名（不自己拼 PATH）。
5. **stdout/stderr 必须有界**：stdio 用 seam 的 collect 模式 + maxBytes 上限；成功结果只读 stdout；stderr 作截断诊断 excerpt，不进成功输出。
6. **exit code 语义归工具**：正常域内特殊退出码（rg：0 命中 / 1 零结果）映射成 canonical 字段；非预期非零 → throw 稳定错误（见 §6）。
7. **cancellation 必须支持**：spawn 转发 exec.signal（seam 终止进程树）；spawn 前后查 signal.aborted。
8. **timeout 必须处理**：工具定义挂 timeoutMs（tool-call-timeout-policy 经 signal 协作强制）或 schema 暴露 timeoutMs；terminate 升级用 seam graceMs。
9. **CLI 未安装/缺失**：启动失败分类成稳定错误（SEARCH_FAILED 实证区分 launch failure / provider failure / abort）；不要静默。
10. **Windows 路径不能假定 cwd**：exec.agent.session.header.cwd 是唯一事实来源；argv 向量天然免 shell quoting 的平台差异；展示路径相对 workdir 做 relativize（toWorkdirRelative 实证）。
## 5. 安全规范

**禁止**：

```text
shell command string + user input
bash -c <用户/模型输入>
cmd /c <用户输入>
PowerShell 字符串插值拼接命令
```

不要通过字符串拼接构造命令。优先：

```ts
ctx.subprocess.spawn({
  argv: [executable, '--option', value, '--', targetPath],
  cwd, stdio: { /* collect + maxBytes */ }, graceMs, signal,
})
```

**重点检查清单**（每个工具设计时逐项过）：

- command injection / argument injection（argv 向量化）
- 前导 - 参数注入（-- 分隔）
- CLI 自带配置文件注入（--no-config 类防御）
- 任意程序执行（固定 executable；禁止把输入当命令）
- 任意路径访问 / path traversal / symlink / junction（文件类走 ctx.fs 的门与沙箱，或显式 realpath 规范化）
- 超大输出（字节/条数 cap + truncated + 可选 spill）
- 子进程泄漏（cancellation 终止进程树；后台任务发布后归 ctx.jobs 生命周期）
- 超时与取消（见 §4.7-8）
- 破坏性操作：schema 约束 + description 明示 + tools/pre-execute 策略（deny/ask）+ ctx.approval；dry-run 作为 schema 参数/模式提供，不是事后补丁
- 沙箱升级参数（sandbox_permissions / justification）仅在 confining backend 挂载时展示；批准走 ctx.approval，拒绝映射成 [sandbox: ...] marker 且保留结构化 code（tool-bash / tool-fs FsSandboxController 实证）
## 6. Output / Error 规范

```
execute(args) ──> canonical JSON value ──> 依 output.schema 校验/freeze
                                             │
                                             ├──> output.render(args, value) → 模型可见文本
                                             └──> (可选) output.presentationMeta → result.meta
```

**禁止** execute() 返回 content blocks。

错误必须区分两类：

1. **throw → tool error（isError）**：基础设施失败、参数非法、取消/超时。推荐 HarnessError 子类 + **包自有稳定错误 code**（tool-fs-search 实证：SearchError extends HarnessError + SEARCH_* 词汇；registry 把 { name, code } 暴露在 isError 上，retry/权限/UI 可机器分支）。普通 Error 会丢 code（tool-fs 注释实证：ToolRuntime 只对 HarnessError 填充 result.error）。
2. **正常但非理想结果 → canonical value + render 解释**：非零 exit code、零匹配、空结果属领域内成功，进 canonical（如 { exitCode: 1, ... }），render 解释——绝不 throw 来表达领域状态。

错误消息给出可操作下一步；截断/溢出是预算事实（搜索完成但超 cap）不算失败，用 canonical + 恢复定位表达。
## 7. External CLI 输出处理

**优先结构化输出**：CLI 有 --json / NDJSON / 机器可读格式就用（rg --json 实证，避免文本列切分歧义）。

无结构化输出时：

```
文本解析 → 格式校验（malformed → 明确错误，不产出半成品结果） → canonical value
```

**禁止无限制读取 stdout/stderr**。collect 形态必备三件套：

```
maxBytes   采集字节上限（超限保留 tail 并标记 truncated）
truncated  模型可见的截断标记（预算事实，不是失败）
spill      完整流溢出文件（collect 形态可选开启）
```

超 inline 上限的**结果**（非原始流）用 ctx.get('spillStore')（可选服务，不 inject）的 saveText 存完整件，把 locator 写进 render 尾部（tool-fs-search trySaveFormattedResult 实证：best-effort，存储失败只 warn，成功绝不因此变 isError）。

内部传输（如 rg 原始 stdout）与模型可见结果分层：原始输出 cap 住并完整解析；retention 同时约束 render 与 presentationMeta（同一次 retention pass，文本与卡片口径永远一致，实证）。
## 8. 测试与验证（workspace 包 / 产品可见工具必做）

- unit：pnpm run test，spec 在 tests/**（tool-bash / tool-fs-search 的 tools.spec.ts 实证）
- **真实入口路径**：产品可见工具必须有经 Loader + 测试专用 cordis.yml 引导的 REAL composition 测试（integration.spec.ts 实证）；手写 ctx.plugin(...) 挂载不够
- 无 inject 的插件加 expect('default' in mod).toBe(false) + unwrapExports 往返断言
- spawn-backed 工具测：argv 构造单测、结构化解析、错误分类、retention/presentation、超时与取消路径
- e2e 断言"验证世界而非自述"；只 mock 昂贵/非确定性边界
- **PTC 调用验证**：组合里以 await tools.<name>(args) 调用一次，确认解析 canonical value / reject ToolCallError；把调用与输出写进交付说明
- 覆盖率：pnpm run test:coverage（仓库 CI 门逐文件 100%）；构建链 constraints && typecheck && lint && build && hygiene
## 9. 交付要求（附加在 SKILL.md 交付结构之上）

1. 指出选用的模式（A/B/C）与判据一句话
2. 外部 CLI 工具附：argv 构造样例、未安装行为、stdout/stderr/exit 语义表
3. 错误 code 词汇表（code → 含义 → 触发条件）
4. PTC 调用验证输出
5. 标注生成依据的 docs 版本/commit 与目标 dsh 版本（版本纪律）
## 10. 回查（签名以官方文档为准）

| 需要什么 | 回查路径（相对 docs/） |
|---|---|
| Tool 契约全文 | cookbook/adding-a-tool.md |
| 第一个工具教程 | user/develop/basic/tool.md |
| 工具总目录（schema 实证） | tool-catalog.md |
| 新行为归属（该不该做成工具） | architecture.md § Where new behavior goes |
| shell / subprocess seam 契约 | subsystems/shell.md、subsystems/subprocess.md |
| 真实源码模板 | packages/shell/tool-bash/、packages/fs/tool-fs-search/、packages/fs/tool-fs/ |
| 动态工具（agent 现场写插件） | user/develop/practice/dynamic-cordis.md |
