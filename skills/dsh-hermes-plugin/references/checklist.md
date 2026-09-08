# 交付前自检清单与常见禁忌

> 来源：根 `AGENTS.md` Conventions、`docs/testing.md`、`docs/cordis-primer.md` "Practical Rules"、`docs/postmortem/0001、0002`、`docs/user/develop/practice/index.md`、`docs/cookbook/adding-a-tool.md`。交付任何插件前逐条核对；配合 `scripts/validate_plugin.py` 自动检查其中可机械化的项。
> 快照：docs @ c389f96bf3（dsh 0.1.3-alpha.2，2026-09-08）。

## 机械检查（scripts/validate_plugin.py 覆盖）

- [ ] package.json 存在且 `type: module`
- [ ] bundle：包名 `dsh-<name>` 前缀；`dsh.bundle.patch` 指向的 yml 存在且在 `files` 内；patch 行 `name:` 引用的模块存在
- [ ] workspace 包：`private: true`；`main`/`types`/`exports` 不变量；`files` 只含 lib 产物；cordis 同时在 peerDependencies+devDependencies；schemastery 在 dependencies；tsconfig.json 存在且 references 含 vendor/cordis
- [ ] 入口源码无 `export default`（namespace 插件）
- [ ] 有 `export interface Config` 时必须同时有 Schemastery 的 `export const Config`（禁止普通对象）
- [ ] 所有 cordis yml 中是 `!!js`，不出现单个 `!js`

## 人工核对（生成时即应遵守）

1. **新行为放到文档化扩展点上，不改 agent-loop**（"Plugins, not loop changes"）。
2. 每个注册都有 disposer；资源获取放进 `ctx.effect()`；顺序敏感清理合入单个 effect。
3. `inject` 表达加载顺序，不依赖 yml 列表位置（条目并发启动）。
4. **可选读取（未声明 inject）的服务用 `ctx.get(name)`，绝不用 `ctx.<name>`**（postmortem 0001 Lesson #2）。
5. 服务名带独特前缀；事件名 `namespace/action`；跨包类型靠 `import type {}` 触发声明合并；**Host 与 Client 不得对同一 Context key 做不兼容合并**。
6. 三角色 seam 只在角色需独立演化时拆包；简单工具插件保持单包；Service Definition 拥有 Request/Result 类型；默认解析用显式 `resolve(request): Spec` 步骤，不在 `run()` 里藏 `?? default`。
7. 密钥经 Config + `!!js process.env.X`；跨边界 id 用 branded 类型（`Branded<B>` from `dsh-brand`），不用裸 string；信任同进程类型化边界的 TS，只在解析器/配置/排队/模型/持久/worker/进程/线界校验。
8. strict TypeScript + 每个导出有 JSDoc；事件用 `@mode` 标注、payload 用 `@param`；discriminant union 以 `assertNever` 收尾。
9. bundle 作者：提供用户大概率保留的配置默认值，其余交给 schema。
10. 空的 `catch` 必须写明吞掉了什么、为何无他法可达；单条 try 语句。
11. **工具 `execute` 只返回 canonical value**；`output.render` 负责模型面内容；UI 卡片（presentCall/presentResult）为纯函数；遵守 `exec.signal`，后台任务用 `ctx.jobs.start` + 任务自有 signal。
12. **`!!js` 只出现在 entry 的 `config` 与 `disabled`**，其他元数据用 overlay（`verify-cordis-config` 会拒）。
13. Client 插件不跨插件 value import（bundle-purity）；向他人槽位贡献用 `ctx.slots.inject()`；资源 provider 在自有 `ctx.effect` 内注册并尊重 `signal`。

## Tool Plugin 专项（生成 Tool Plugin 时逐条核对；规范见 references/tool-plugin.md）

- [ ] 已判断是否应使用 Tool Plugin（核心判据：产物是否注册 ctx.tools、有模型可见名称与参数 Schema）
- [ ] 已优先检查现有 DSH seam（ctx.shell / ctx.fs / ctx.subprocess / ctx.terminals / ctx.sessionProjections…）——有匹配 seam 则消费，不重复实现执行
- [ ] 固定外部 CLI 使用 ctx.subprocess.spawn（模式 B），未绕开 seam 直接 child_process
- [ ] 使用 argv 数组而非 shell command 字符串；无 bash -c / cmd /c / PowerShell 插值拼用户输入
- [ ] 参数 Schema 完整（type/required/description）；DSL 外约束（非空/正数/跨字段）在 execute 开头 validate
- [ ] execute 只返回 canonical JSON value（不返回 content blocks；不经 execute 输出渲染文本）
- [ ] output.schema 已定义（ValueSchemaSpec）
- [ ] output.render 已定义（模型可见投影）
- [ ] 错误 code 稳定（HarnessError 子类 + 包自有 code 词汇，isError 可机器分支）；正常非理想结果进 canonical
- [ ] 已处理 timeout（工具定义/schema 暴露 + tool-call-timeout-policy 或显式超时）
- [ ] 已处理 cancellation（exec.signal 转发/监听；后台任务发布后走 ctx.jobs 生命周期）
- [ ] 输出有上限（maxBytes/条数 cap + truncated；超限走 ctx.spillStore 或 spill）
- [ ] 存在真实 composition 测试（经 Loader + 测试 cordis.yml；integration.spec.ts 形态）
- [ ] 已进行 PTC 调用验证（await tools.<name>(args) 解析 canonical / reject ToolCallError）

机械可查项（validate_plugin.py 的 WARNING 提示）：inject 含 tools / 存在 execute / 存在 output。

## 常见禁忌（每条都有真实事故/文档依据）

1. **`export default` 出现在 namespace 插件里** → Loader 丢 `inject`，运行时崩溃（postmortem 0001）。
2. waterfall 监听器忘记 `next()` → 静默短路整条链。
3. `inject` 指向无人提供的服务 → 插件永远 PENDING、零输出零报错（诊断：遍历 `ctx.registry` 查 `FiberState.PENDING`）。
4. 导出普通对象作 `Config` → 不被接受（缺 Standard Schema 接口）。
5. 硬编码可调参数（`DEFAULT_*` 常量不算可配置性）。
6. 配置引用不存在的资源时静默跳过——必须 fail loud。
7. 代码里临时读密钥文件；cordis.yml 用 `!js`（正确是 `!!js`）。
8. 手动 removeListener / clearInterval——一切经 ctx 的注册自动回收。
9. 新包复制 `api/remotes` 的 Host/Client 拆分模式（仅限该包特殊原因）。

## workspace 包验证序列（交付说明中附上）

```sh
pnpm install        # 注册 workspace
pnpm run doc-sync
pnpm run constraints && pnpm run typecheck && pnpm run lint
pnpm run build && pnpm run hygiene
```

构建链：tsc 产出 `lib/types` 声明 → tsdown 打包运行时到 `lib/index.js`。

## 测试要求（workspace 包 / 产品可见插件）

- unit：`pnpm run test`，spec 在包的 `tests/**`；每个 registry 都要有 HMR 安全测试（dispose 贡献它的 fiber，断言清理完成）。
- 覆盖率：`pnpm run test:coverage`，`packages/*/*/src` 逐文件 100%（CI 门）。
- **真实入口路径**：产品可见插件必须有经 Loader 用测试专用 cordis.yml 引导的 REAL composition 测试；手写 `ctx.plugin(...)` 挂载不够。无 `inject` 的插件须加 `expect('default' in mod).toBe(false)` + `unwrapExports` 往返断言。
- 测试解析只走源码面（paths → src），不通过包 exports 加载 lib/。
- 只 mock 昂贵/非确定性边界（LLM adapter、网络、时钟）；e2e 断言"验证世界而非自述"。
