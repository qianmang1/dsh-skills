# 注册面 API：事件、工具、hook、LLM adapter、UI、Client/Workspace 面

> 知识库来源：`docs/user/develop/framework/events.md`、`docs/cookbook/adding-a-tool.md`、`docs/user/develop/basic/tool.md`、`docs/cookbook/extension-cookbook.md`、`docs/cookbook/adding-an-llm-adapter.md`、`docs/cookbook/adding-a-settings-card.md`、`docs/subsystems/{slots,client-modules,client-resources,sidebar-right,workspace}.md`、`docs/capability-seams.md`、`docs/cordis-tutorial/04/07`。生成对应类型插件时逐字套用以下签名。
> 快照：docs @ c389f96bf3（dsh 0.1.3-alpha.2，2026-09-08）。

## 1. 事件（typed events，声明合并）

```ts
declare module '@deepseek-ai/cordis' {
  interface Events {
    'my-plugin/ready': (payload: { id: string }) => void
    'my-plugin/check': (input: string) => boolean | undefined
    'my-plugin/transform': (input: string, next: () => Promise<string>) => Promise<string>
  }
}
```

五种派发模式（模式是事件公共契约的一部分；harness 事件用 `@mode` JSDoc 标注，由 generated catalog 校验）：

| 模式 | 调用 | 语义 |
|---|---|---|
| emit | `ctx.emit(name, ...args)` | 同步广播；返回值不收集 |
| parallel | `await ctx.parallel(...)` | 所有监听器并发 |
| serial | `await ctx.serial(...)` | 顺序 await；首个非 `null/false/undefined` 返回胜出并停止 |
| bail | `ctx.bail(...)` | serial 的同步版 |
| waterfall | `ctx.waterfall(name, ...args, next)` | around 中间件链 |

**waterfall 铁律：只观察/注解的监听器必须调用 `next()`**；不调 `next()` 即返回 = 刻意短路（veto）。

`ctx.on()` 是 effect，插件卸载自动移除监听器。跨包拿类型：`import type {} from '@deepseek-ai/dsh-tools'`（纯类型导入，触发对方声明合并）。

**辨析：durable session-event 类型不是 Cordis 事件**——`turn/*`、`step/*`、`tool/call`、`tool/result`、`compaction/*` 是持久会话事件**类型**；要观察它们须监听 Cordis 事件 `session/event` 并检查 `event.type`（`docs/user/develop/framework/events.md`）。

## 2. Tool Plugin（工具注册）

Tool Plugin 规范已独立成完整知识源：**详见 `references/tool-plugin.md`**（三种模式、基础契约、External CLI 决策树、安全、Output/Error、测试）。本文不再重复条文，避免双知识源漂移。

仅留路由索引：

- 入口：`inject = ['tools']` + `ctx.tools.register(defineTool({ name, description, parameters, output: { schema, render }, execute }))`
- 只允许一个知识源：生成 Tool Plugin 时读 `tool-plugin.md`，签名逐字以官方 `docs/cookbook/adding-a-tool.md` 为准；本文档涉及工具执行策略的旁路（权限门见 §3 hook）不受影响。
- MCP 来源的原始 JSON-Schema 工具可直接 `ctx.tools.register()`（tool-plugin.md §2 有注）。

## 3. hook（权限门）

"native hook" 就是拦截点上的普通 Cordis 插件：

```ts
ctx.on('tools/pre-execute', async (exec, next) =>
  isAllowed(exec) ? next() : { kind: 'deny', reason: 'Denied by policy.' })
```

## 4. LLM adapter

```ts
class MyAdapter extends LlmAdapter {
  async *stream(options) { /* yield 增量 */ }
}
export const inject = ['llm']
// apply 内：
ctx.llm.registerAdapter(['my-provider'], new MyAdapter(...))
```

- 重复路由抛错；密钥走 schemastery Config + `!!js process.env.MY_KEY`，**禁止代码里读临时密钥文件**。

## 5. UI / Host 侧其他注册面

- UI 插件：监听 `session/event` 渲染；输入经 `ctx.agents.get(...)?.followup(createUserMessage(...))` 或 `agent.steer()` 回灌。
- 命令：经 `ctx.commands`；系统提示段：`ctx.systemPrompt.section()`；工具过滤：`ctx.tools.restrict()`。
- 设置卡片（Host namespace + 浏览器卡片）：`ctx.settings.installSection()`（`docs/cookbook/adding-a-settings-card.md`）。
- 服务隔离：cordis.yml `group: true` + `isolate: { <key>: true }`。
- 动态 Cordis 工具：`@deepseek-ai/dsh-tool-cordis` 允许 agent 在内存挂载/卸载模型编写的插件（进程内临时，`docs/user/develop/practice/dynamic-cordis.md`）。

## 6. Client 侧注册面（浏览器插件，dsh 0.1.3 新体系）

Client 插件在 package.json 声明 **`dsh.client`**、导出 `./client`、extends `tsconfig.base.client.json`，经 `ctx.clientModules` 扫描与 `window.__DSH_BOOT__` boot graph 加载（`docs/subsystems/client-modules.md`）。**bundle-purity gate 禁止跨插件 value import**（只能 `import type`）。

- **`ctx.slots`**（类型化 React 组合，`docs/subsystems/slots.md`）：`register/inject`；SlotMap 声明合并；cardinality（single/list/keyed/chain）× scope（root/session-maybe/session）；标准 props `useSession`/`useResource`。槽位树示例：`conversation.chat.node`、`settings.plugin.item`、`tool.call.toolview`、`rightbar.*`。
- **`ctx.resources`**（资源模型，`docs/subsystems/client-resources.md`）：provider 注册 `ctx.resources.register({ protocol, open, reload? })`（yield `RemoteResult` 帧）；地址 `dsh-resource://<protocol>/…`；状态机 `none/loading/live/failed`；订阅即持有，`ctx.resources.pin(address, signal)`；"Streams carry metadata, not content"。声明合并面：`ResourceProtocolMap`。
- **`ctx.sidebarRightTabs` + `ctx.sidebarRight`**（`docs/subsystems/sidebar-right.md`）：静态定义 `ctx.sidebarRightTabs.register({ id, kind, patterns, priority, canOpen, title, guide })` + keyed 槽位 `sidebar.right.pane.tab` 合成一个 tab type；priority `extension > builtin > fallback`（**extension 默认且最高**，可接管内置 kind）；导航 `ctx.sidebarRight.openResource/openTab/split/float/dock/close/focus`；`useTabInfo()` 注入。dockkit 是内部布局引擎，**非稳定接口**。

## 7. Workspace 面（Host 侧，dsh 0.1.3 新体系）

（`docs/subsystems/workspace.md`、`docs/capability-seams.md`）

- **`ctx.workspaceFiles`**：`stat/read/readBytes/list/changes`；四道门（workspace root 内、拒 symlink、页/窗/条目上限、UTF-8）；错误码 `workspace-file/*`。
- **`ctx.workspaceRegistry`**：`create/get/list/delete/insertBefore/archiveSession/resolveByPath`（realpath 规范化唯一性、一次性 history bootstrap）。
- 周边服务：`ctx.workspaceController`、`ctx.directoryPicker`（abstract seam）+ `ctx.directoryPickerController`、`ctx.fileUploads`、`ctx.attachments`、`ctx.sessionController`。
- **强制 seam**：host reader 必须在激活期 require `ctx.sessionProjections`，否则显式失败（architecture.md Projection seam）。
- Remote/Typert RPC：Host 服务用 `@Remote`/`@RemoteScope` 声明可调用方法，Client 经 `ctx.remote` / `agentCtx.remote` 访问；`RemoteResult` 帧协议与 `RemoteFailure`。

## 8. 完整 ctx key 索引的回查原则

上方仅列高频面。**全量 ctx key 以 `docs/capability-seams.md` 的表与各 `docs/subsystems/<name>.md` 页的 generated `cordis-surface` 区为准（generated + freshness-gated，禁止手抄复述）**。当前已知新增 key 抽样：`ctx.modules`（浏览器半）、`ctx.terminals`、`ctx.webhookRuntime`、`ctx.agentTeams`（实验性）、`ctx.tokenMeter`、`ctx.toolResultPruner`、`ctx.deepseekLlmApiExtensions`。回查到的签名逐字使用。
