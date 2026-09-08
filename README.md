# dsh-skills

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（dsh）技能（Skill）仓库：收录面向 dsh 插件开发与日常使用的可复用技能工程。

## 什么是 Skill

Skill 是 AI 编码助手的能力扩展包：一个 `SKILL.md`（工作流 + 约束）配以可选的知识库（`references/`）、工程模板（`assets/`）和可执行脚本（`scripts/`）。助手在对话中按需求自动触发对应 Skill，或显式点名使用。

## 技能目录

| 技能 | 说明 |
|---|---|
| [`skills/dsh-hermes-plugin`](skills/dsh-hermes-plugin/SKILL.md) | 根据自然语言需求，自动生成符合 DeepSeek Harness 官方规范的完整、可分发、可直接部署的插件工程（插件框架为 vendored Cordis）。内置官方文档回查映射与版本纪律（当前快照 `c389f96bf3` / dsh 0.1.3-alpha.2） |

## 安装方法

将某个技能目录复制到助手运行时的用户级技能目录即可跨项目使用（以 CodeBuddy 为例）：

```sh
# Windows
Copy-Item -Recurse skills/dsh-hermes-plugin "$env:USERPROFILE\.codebuddy\skills\"
```

技能相互独立，无共享依赖。

## 技能使用

安装后直接用自然语言描述需求即可自动触发，例如：

> 帮我写一个 dsh-Hermes 插件，功能是列出本地目录内容。

也可显式要求："使用 dsh-hermes-plugin skill 生成插件"。

## 相关资源

- dsh 官方文档：<https://github.com/deepseek-ai/deepseek-harness/tree/master/docs>
- 插件打包与分发：`docs/user/develop/basic/publish.md`

## 贡献

新增技能时保持目录约定：`skills/<skill-name>/SKILL.md`（必需）+ `references/ assets/ scripts/`（可选），并在上表登记一行。

## License

[MIT](LICENSE)
