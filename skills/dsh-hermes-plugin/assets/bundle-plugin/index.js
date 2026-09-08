/**
 * <PLUGIN_DISPLAY_NAME> — dsh-Hermes (DeepSeek Harness) 插件入口。
 *
 * namespace 导出约定：name / inject / Config / apply。
 * 禁止 export default：Loader 的 unwrapExports 优先取 default，
 * 模块命名空间（连同 inject/name/Config）会被整体丢弃
 * （见 deepseek-harness docs/postmortem/0001-acp-default-export-drops-inject.md）。
 */

/** Loader 显示名；同时是 patch 行 `name` 指向的包。 */
export const name = '<PLUGIN_NAME>'

/**
 * 硬依赖服务。列出后框架等待这些服务就绪才运行 apply；
 * 不写则插件不依赖任何服务。可按需改为 ['tools'] / ['llm'] / ['agents'] 等。
 */
// export const inject = ['tools']

/**
 * 可调参数一律走配置（判据：不改代码只改 cordis.yml 能否改变该值）。
 * 纯 JS bundle 若需要 schema 校验，安装 @deepseek-ai/schemastery 到
 * dependencies 并导出 `export const Config = Schema.object({...})`；
 * 无配置的最小形态可省略 Config。
 */
export function apply(ctx) {
  // 在此注册能力。所有经 ctx 的注册（ctx.on 事件监听、工具、定时器等）
  // 都是 effect：插件卸载（配置热替换 / HMR / dispose）时自动回收，
  // 禁止手动 removeListener / clearInterval。
  //
  // 需要显式清理的资源（如自建连接）用 ctx.effect：
  // ctx.effect(() => {
  //   const conn = connect()
  //   return () => conn.close()
  // })
  console.log('[<PLUGIN_NAME>] plugin loaded!')
}
