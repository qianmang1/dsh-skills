# dsh 核心规范：插件形态、生命周期、注入、配置、命名

> 知识库来源：`docs/cordis-primer.md`、`docs/user/develop/basic/index.md`、`docs/user/develop/framework/index.md`、`docs/user/develop/framework/service.md`、`docs/user/develop/basic/config.md`、`docs/cordis-tutorial/01..07`、`docs/glossary.md`、根 `AGENTS.md`。生成代码时本文为最高约束。
> 快照：docs @ c389f96bf3（dsh 0.1.3-alpha.2，2026-09-08）。

## 1. 概念模型

- **一个插件 = 实现 Service 契约的模块**：函数（最常用）、对象、或 `Service` 子类。
- **Context 是服务仓库**：服务以稳定 `ctx.<key>` 注册（`ctx.tools`、`ctx.llm`、`ctx.agents`、`ctx.shell`…）；其他插件按 key 查找，不 import 具体实现。
- **能力缝（capability seam）三角色**：Service Definition（`Service` 抽象类，拥有 ctx key，不是 TS interface）/ Provider（一个或多个）/ Consumer（注入该服务）。三角色解耦后 Provider 与 Consumer 互不依赖，只依赖 Definition 包。简单工具插件不拆包。
- **fiber**：每个已加载插件实例的运行时句柄；**effect**：可逆注册；**waterfall**：around 中间件。

## 2. 三种插件形态（首选具名 namespace 导出）

```ts
// 形态 1：函数插件（默认选它）
import type { Context } from '@deepseek-ai/cordis'
export const name = 'my-plugin'
export const inject = ['tools']            // 按需
export function apply(ctx: Context) { /* 注册能力 */ }

// 形态 2：对象插件
export default {
  name: 'my-plugin',
  inject: ['tools'],
  apply(ctx: Context) { /* ... */ },
}

// 形态 3：类插件（要向他人提供服务时）
import { Service, type Context } from '@deepseek-ai/cordis'
export default class MyService extends Service {
  static inject = ['tools']
  constructor(ctx: Context) {
    super(ctx, 'myService')   // 同步初始化放构造器
  }
}
```

**铁律：workspace 惯例是 namespace 插件——`name`/`inject`/`Config`/`apply` 作为独立具名导出；namespace 插件文件中禁止出现 `export default`。** Loader 的 `unwrapExports` 优先取 `exports.default`，一旦存在 default，模块命名空间（连同 inject/name/Config）被整体丢弃，运行时崩溃（真实事故 `docs/postmortem/0001-acp-default-export-drops-inject.md`）。0001 的两条现行 Lessons：
- 可选读取（未写入 `inject`）的服务一律用 `ctx.get(name)`，**绝不用 `ctx.<name>`**（后者在服务缺失时抛错）。
- 无 `inject` 的插件必须有 Loader 冒烟断言 `expect('default' in mod).toBe(false)` + `unwrapExports` 往返。

## 3. 生命周期（Fiber 状态机）

```
PENDING → LOADING → ACTIVE
                 ↘ FAILED
ACTIVE → UNLOADING → DISPOSED
```

- PENDING：`inject` 的依赖未就绪，**静默等待、无报错**——"插件什么都没打印"的第一诊断对象；`inject` 指向无人提供的服务会永远 PENDING。
- FAILED：`apply` 或配置校验抛错。
- 触发卸载：配置编辑（热替换）、HMR、显式 dispose、失去所需服务。依赖服务消失 → 插件自动卸载，服务恢复后自动重载。
- 没有 `apply/restart/dispose` 钩子对；生命周期围绕 `apply` + effect + `fiber.dispose()`。
- disposer 反注册序启动，但**多个异步 disposer 并发执行、无串行保证**；顺序敏感的清理放进同一个 `ctx.effect()` 返回的单个 disposer 中 await。

## 4. Effects：一切注册皆可逆

```ts
ctx.effect(() => {
  const timer = setInterval(() => console.log('tick'), 200)
  return () => { clearInterval(timer) }   // 卸载时运行
})
```

本身已是 effect 的内建 API：`ctx.on(event, listener)`、`ctx.plugin(child)`、服务注册、各 registry 的 `register()`。**每个注册都应有 disposer**；经 ctx 的注册自动回收，禁止手动 removeListener/clearInterval。

## 5. 服务声明与依赖注入

消费：

```ts
export const name = 'consumer'
export const inject = ['greeter']        // 硬依赖：PENDING 直到服务存在

export function apply(ctx: Context) {
  console.log(ctx.greeter.greet('world'))   // apply 运行时保证就绪
}
```

提供（完整真实模式）：

```ts
import { Service, type Context } from '@deepseek-ai/cordis'

declare module '@deepseek-ai/cordis' {   // 声明合并：编译期类型，无运行时代码
  interface Context { greeter: GreeterService }
}

export class GreeterService extends Service {
  constructor(ctx: Context) { super(ctx, 'greeter') }  // 运行时注册为 ctx.greeter
  greet(who: string) { return `Hello, ${who}!` }
}

export const name = 'greeter'
export function apply(ctx: Context) { ctx.plugin(GreeterService) }
```

- 可选依赖：不写 `inject`，用 `ctx.get('greeter')`（无提供者时 `undefined`）。
- 抽象 Service Definition 模板（真实源码 `packages/shell/shell/src/index.ts`）：

```ts
export abstract class ShellExecutor extends Service {
  constructor(ctx: Context) { super(ctx, 'shell') }
  abstract resolve(...): Spec
  abstract run(...): Result
}
export default ShellExecutor
```

- Provider 子类化后 `apply(ctx) { ctx.plugin(MyCapLocal) }`；Provider 与 Consumer 只依赖 Definition 包，互不依赖。
- 类插件可接 `static Config`（schemastery 校验并填默认值后才构造，见 `packages/shell/bash-local/src/index.ts`）。
- 用 `inject` 表达加载顺序，**不要依赖 cordis.yml 列表位置**（条目并发启动）。

## 6. 配置格式（Config）

```ts
import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'

export const name = 'my-plugin'

export interface Config {
  greeting: string
  maxRetries: number
  verbose?: boolean
}

// 同名 interface + 同名 schema：消费者拿类型，Cordis 拿校验器
export const Config: Schema<Config> = Schema.object({
  greeting: Schema.string().default('Hello'),
  maxRetries: Schema.number().default(3),
  verbose: Schema.boolean().default(false),
})

export function apply(ctx: Context, config: Config) {
  console.log(config.greeting)   // 一定是校验+填默认后的完整配置
}
```

cordis.yml / patch 侧：

```yaml
- insert:
    - id: hello
      name: './src/my-plugin.ts'     # bundle 内用包名，不用相对路径
      config:
        greeting: 'Hi there'
        maxRetries: 5
```

要点：
- 本仓库用 **Schemastery**；**导出普通对象作为 `Config` 无效**（不实现 Standard Schema 接口）。
- 无效配置在加载期 FAIL LOUD（fiber → FAILED，`ValidationError` 带路径）。
- **禁止硬编码可调参数**——判据：cordis.yml 能否不改代码改这个值。协议常量、外部规范、安全不变量保持固定。
- `!!js` 插值范围（现行契约，cordis-primer.md "Loader Configuration"）：entry 的 `config`（注入激活后、针对插件 ctx 求 `ctx.serviceName`）与 `disabled` 字段（**每次 mount 决策时、针对 loader context** 求值）两处；**其余 entry 元数据一律字面量**，环境选择插件用 overlay。仓库有静态门 `verify-cordis-config` 拒绝元数据中的表达式节点（事故背景见 `docs/postmortem/0002`：字面量 `!!js` 对象曾永久禁用 filesystem 工具）。**是 `!!js`，永远不是 `!js`**。
- 类插件进阶（真实源码）：`static Config: z<Config> = z.object({...})` + 运行时二次校验。

## 7. 命名规范

- **npm 包名**：workspace 一律 `@deepseek-ai/dsh-<name>`；分发型 bundle 可用 `dsh-<name>`。
- **Service 名（ctx key）**：每应用一个扁平命名空间，自带服务要用独特前缀（harness 占用 `tools`、`llm`、`agents`、`shell` 等平名）。单一 engine/runtime/policy/controller/store/resolver 用**单数** key；registry 或拥有多个具名成员的服务用**复数** key。**禁止 Host 与 Client 对同一 `Context` key 做不兼容的声明合并**（这是 Host/Client 双聚合 tsconfig 存在的原因）。
- **事件名**：`namespace/action`（如 `tools/pre-execute`、`agent/request`）。
- **角色后缀词表**：`Controller / Store / Directory / Presenter / Registry / Runtime / Resolver / Binder / Engine / Policy / Executor / Gateway / Provider / Backend / Handle / Config / Service`——按语义选词，**禁止只因继承 Cordis Service 而叫 Service**；实现包加机制/协议/环境/厂商限定（如 `-local` 仅当"同主机执行"是契约一部分）。
- **文件命名**：入口 `src/index.ts`；产品拼写 `Typert`（不是 TypeRT）；`SDK` 仅用于 JSON-RPC 协议。
- **导出命名**：模块级固定导出为 `name`、`inject`、`Config`、`apply`；每个模块和导出都要有简洁 JSDoc 契约文档。

## 8. workspace 新包结构（`docs/cookbook/adding-a-package.md`）

```
packages/<group>/<pkg>/
  package.json     # 不变量见下
  tsconfig.json    # extends ../../../tsconfig.base.json, rootDir src,
                   # outDir lib/types, references: vendor/cosmokit + vendor/cordis
                   # (+ vendor/schemastery 若用 Config, + 各 dsh 依赖包)
  src/index.ts     # namespace 导出
  README.md        # 服务 API、事件、扩展点 + Model Experience + Known Limitations
```

package.json 强制不变量（`pnpm run constraints` 强制）：
- 发布形态与官方约束一致：可发布包不设 `private`（配 `publishConfig.access: public`，如 `packages/fs/tool-fs-search`）；仅 experimental/内部包 `private: true` 且省略 publishConfig。`version` 与根 package.json 一致；`"type": "module"`
- `main: "lib/index.js"`、`types: "lib/types/index.d.ts"`
- `exports["."] = { types: "./lib/types/index.d.ts", default: "./lib/index.js" }`
- **`@deepseek-ai/cordis` 必须同时出现在 `peerDependencies` 和 `devDependencies`（同范围）**；每个 dsh peer 依赖镜像进 devDependencies
- `@deepseek-ai/schemastery` 放 `dependencies`
- `files` 恰好含 `lib/index.js`、`lib/types/**/*.d.ts`；不发布 src/declaration map/JS map
- 包内源码相对导入带显式 `.ts` 说明符（`export * from './types.ts'`），编译器改写为 `.js`
- 分组只能是纯容器：`core, llm, shell, compaction, subagent, todo, session, client/host, util, test-support` 等；Host 包加入 `tsconfig.host.json` references，Client 包加入 `tsconfig.client.json`（普通包只属一个聚合）
