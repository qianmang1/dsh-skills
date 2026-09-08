/**
 * <PLUGIN_DISPLAY_NAME> — dsh Tool Plugin 入口（复制起点）。
 *
 * namespace 导出约定：name / inject / Config / apply；禁止 export default
 * （Loader 的 unwrapExports 会丢弃模块命名空间，见 docs/postmortem/0001）。
 *
 * 这是一个最小 Tool Plugin：向 ctx.tools 注册一个模型可调用工具。
 * 完整规范见 Skill 的 references/tool-plugin.md；本文件每个分区都标了
 * "在哪里写什么"，直接替换/填空即可继续开发。
 */

import { defineTool } from '@deepseek-ai/dsh-tools'

/** Loader 显示名；同时是 patch 行 name 指向的包。 */
export const name = '<PLUGIN_NAME>'

/**
 * 硬依赖服务：'tools' 是工具注册表。框架等它就绪后才运行 apply。
 * 如果工具要消费其它能力（ctx.shell / ctx.fs / ctx.subprocess ...），
 * 把对应 ctx key 一并列入（如 inject = ['tools', 'shell']），见 tool-plugin.md §3。
 */
export const inject = ['tools']

/**
 * 可调参数（如超时、开关）进 Config schema：判据是"不改代码只改 cordis.yml
 * 能否改变该值"。JS bundle 需要时安装 @deepseek-ai/schemastery 到 dependencies
 * 并导出 export const Config = Schema.object({ ... })；无配置可省略。
 */

/**
 * 参数校验占位：ParameterSchemaSpec 只表达类型/必填/枚举/嵌套。
 * 非空、正数、跨字段等 DSL 表达不了的约束，在这里手写校验（execute 开头先跑）。
 * @param {object} args - 已通过 schema 校验的模型参数
 */
function validateArgs(args) {
  // TODO: 按需加入真实约束，例如：
  // if (args.path.trim().length === 0) throw new Error('invalid path: expected a non-empty string')
  // if (args.limit !== undefined && (!Number.isInteger(args.limit) || args.limit < 1)) { ... }
  return args
}

export function apply(ctx) {
  ctx.tools.register(defineTool({
    /** 模型可见工具名（下划线风格）；模型用这个名字调用。 */
    name: '<TOOL_NAME>',
    /** 模型可见说明：做什么、何时用、副作用与边界。description 即 prompt。 */
    description: '<TOOL_DESCRIPTION>',

    /** 参数 Schema：模型按此生成参数。每个字段给 type/required/description。 */
    parameters: {
      input: {
        type: 'string',
        required: true,
        description: 'What to process',
      },
      // TODO: 按真实能力扩展字段。DSL 表达不了的约束在 validateArgs 里补。
    },

    /**
     * Canonical output：execute 只允许返回一个 canonical JSON value（依本
     * schema 校验）。模型看到的文本由 output.render 生成——不要把渲染文本
     * 放进 execute 的返回值。root 可以是 object/array/scalar/null。
     */
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: true,
        properties: {
          result: { type: 'string', required: true },
        },
      },
      /** 模型可见投影：把 canonical value 渲染成文本块。 */
      render: (_args, value) => [{ type: 'text', text: value.result }],
    },

    /**
     * 执行体（占位区）：
     *   1) 先跑参数校验 validateArgs(args)
     *   2) 真正的逻辑写在这里 —— execute 占位 / CLI spawn 扩展点 / 其它
     * @param {object} args - 校验过的参数（readonly，别改）
     * @param {object} exec - { callId, name, arguments, agent, token, signal }
     *   exec.signal：取消信号，长操作必须尊重（传给 spawn/readFile 等）
     */
    async execute(args, exec) {
      validateArgs(args)

      // ============ 执行占位：在这里放真实逻辑 ============
      //
      // 方式 1（推荐）：消费 DSH 已有 service seam，如
      //   const result = await ctx.shell.run(ctx.shell.resolve({ command, signal: exec.signal }))
      //   或 await ctx.fs.<op>(...)
      //
      // 方式 2（封装固定外部 CLI）：ctx.subprocess.spawn，argv 用数组，
      //   绝不拼 shell 字符串。工具需要 inject 对应服务并 install 依赖：
      //   ctx.subprocess.spawn({
      //     argv: [executable, '--option', value, '--', targetPath],
      //     cwd: exec.agent?.session.header.cwd,   // session cwd，不假定 process.cwd()
      //     stdio: { stdin: 'ignore', stdout: { maxBytes: N }, stderr: { maxBytes: M } },
      //     graceMs: 3000,
      //     signal: exec.signal,                   // cancellation：终止进程树
      //   })
      //   超时：schema 暴露 timeoutMs 或挂 ToolDefinition.timeoutMs；见 tool-plugin.md §4
      //
      // 错误规范：基础设施失败 throw（带稳定 code 的 HarnessError 子类最好）；
      //   非零 exit 等"正常但非理想"结果放 canonical value，在 render 里解释。
      // ====================================================

      // TODO: 把下面这行换成真实执行结果（示例工具：原样回显）
      const result = await Promise.resolve('echo: ' + String(args.input))

      // ============ 取消处理：长任务在这里响应 exec.signal ============
      // 经 spawn/readFile 传入的 signal 会自行中止；自建循环/等待需监听：
      // if (exec.signal.aborted) throw new Error('tool call aborted')

      // ============ 返回 canonical value（不是 content blocks）============
      return { result }
    },

    // ============ UI presentation（可选）============
    // 需要专用 UI 卡片时加 presentCall / presentResult，返回 card-tagged
    // render intent（generic/terminal/diff/read/search/web）；必须是纯函数，
    // 不得做 I/O（会在回放时执行）。省略则 UI 回退 generic 卡。
    // presentCall: (args) => ({ card: 'generic', title: 'Run <TOOL_NAME>', rawInput: args }),
    // presentResult: (args, result) => ({ card: 'generic', content: [{ type: 'text', text: result.content }] }),
  }))
}
