# dsh-<PLUGIN_NAME>

<PLUGIN_DISPLAY_NAME> — dsh Tool Plugin（模型可调用工具）。

## 这是什么模板

`assets/tool-plugin/` 是 **Tool Plugin 的默认 bundle 起点**（区别于 `assets/bundle-plugin/`
通用插件模板）：已含 `inject: ['tools']` 与 `ctx.tools.register(defineTool({ ... }))`
最小骨架。复制整个目录后按占位符替换即可继续开发。完整规范见 Skill 的
`references/tool-plugin.md`。

## 结构

```
├── package.json       # 声明 dsh.bundle；@deepseek-ai/dsh-tools 为运行时依赖
├── cordis.patch.yml   # 挂载插件行（工具注册在源码内完成）
└── index.js           # 入口：defineTool 骨架 + 扩展点注释
```

## 从哪里开始写（index.js 内已分区标注）

| 目标 | 位置 |
|---|---|
| 定义工具名与模型可见说明 | `defineTool({ name, description })` |
| 定义模型参数 | `parameters`（DSL 表达不了的约束 → `validateArgs`） |
| 实现真实逻辑 | `execute` 的"执行占位"区 |
| 消费既有 DSH 能力 | `execute` 内调用 `ctx.shell` / `ctx.fs` / …（先读 tool-plugin.md §3 模式 A） |
| 封装外部 CLI | `execute` 内 `ctx.subprocess.spawn`（argv 数组；注释给了样板） |
| 处理错误 | throw = isError；非理想正常结果 → canonical + render 解释 |
| 生成模型可见输出 | `output.render`（execute 只返回 canonical value） |
| 加 UI 卡片 | `presentCall` / `presentResult`（可选，纯函数） |
| 加可调参数 | Config + @deepseek-ai/schemastery（可选） |

## 生成时必须处理

1. 占位符 `<PLUGIN_NAME>` / `<PLUGIN_ID>` / `<PLUGIN_DISPLAY_NAME>` / `<TOOL_NAME>` / `<TOOL_DESCRIPTION>` 全部替换
2. `package.json` 中 `@deepseek-ai/dsh-tools` 版本按 Skill「版本纪律」对齐目标 dsh 版本
3. 封装外部 CLI 时按 tool-plugin.md §4 决策树与 §5 安全清单逐项过
4. 校验：`python scripts/validate_plugin.py <插件目录>`（ERROR 清零；WARNING 逐条确认）

## 安装与使用

```sh
dsh plugin --profile <profile> add ./dsh-<PLUGIN_NAME>
dsh --profile <profile> --dump-config   # 确认出现 "# == dsh-<PLUGIN_NAME>" 层
dsh --profile <profile>
```

本地热插调试（未打包时）：

```sh
pnpm dsh web --patch ./cordis.yml
# patch 中插件路径必须为绝对路径
```

装好后向模型提问触发该工具，或在 PTC/代码模式 `await tools.<TOOL_NAME>(args)` 直接调用验证。
