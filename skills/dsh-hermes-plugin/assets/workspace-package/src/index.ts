/**
 * <PLUGIN_DISPLAY_NAME> — dsh-Hermes (DeepSeek Harness) 插件。
 *
 * namespace 导出约定：name / inject / Config / apply 均为独立具名导出。
 * 禁止 export default：Loader 的 unwrapExports 优先取 default，
 * 模块命名空间（连同 inject/name/Config）会被整体丢弃
 * （见 docs/postmortem/0001-acp-default-export-drops-inject.md）。
 */
import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'

/** Loader 显示名。 */
export const name = '<PLUGIN_NAME>'

/**
 * 硬依赖服务（按需填写）。列出后框架等待这些服务就绪才运行 apply；
 * 依赖顺序由 inject 表达，不依赖 cordis.yml 行顺序。
 * 可选依赖不写 inject，改用 `ctx.get('<key>')`。
 */
// export const inject = ['tools']

/** 插件配置契约。同名 interface + 同名 schema：消费者拿类型，Cordis 拿校验器。 */
export interface Config {
  /** 示例字段；生成时替换为真实配置项，每个字段给默认值或显式 optional。 */
  greeting: string
}

/** 运行时校验器（Schemastery）。导出普通对象作为 Config 无效。 */
export const Config: Schema<Config> = Schema.object({
  greeting: Schema.string().default('Hello'),
})

export function apply(ctx: Context, config: Config): void {
  // 可调参数一律来自 config（判据：不改代码只改 cordis.yml 能否改变该值）。
  // 禁止硬编码；协议常量与安全不变量除外。
  //
  // 一切经 ctx 的注册（ctx.on / 各 registry 的 register / ctx.plugin / 定时器）
  // 都是 effect：插件卸载时自动回收，禁止手动 removeListener / clearInterval。
  // 需要显式清理的资源放进 ctx.effect：
  // ctx.effect(() => {
  //   const conn = connect()
  //   return () => conn.close()
  // })
  ctx.effect(() => {
    console.log(`[${name}] ${config.greeting}`)
  })
}
