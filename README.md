# dsh-skills

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（dsh）技能（Skill）仓库：收录面向 dsh 插件开发与日常使用的可复用技能工程。

## 什么是 Skill

Skill 是 AI 编码助手的能力扩展包：一个 `SKILL.md`（工作流 + 约束）配以可选的知识库（`references/`）、工程模板（`assets/`）和可执行脚本（`scripts/`）。助手在对话中按需求自动触发对应 Skill，或显式点名使用。

## 技能目录

| 技能 | 说明 |
|---|---|
| [`skills/dsh-hermes-plugin`](skills/dsh-hermes-plugin/SKILL.md) | 根据自然语言需求，自动生成符合 DeepSeek Harness 官方规范的完整、可分发、可直接部署的插件工程（插件框架为 vendored Cordis）。内置官方文档回查映射与版本纪律（当前快照 `c389f96bf3` / dsh 0.1.3-alpha.2） |

## 安装方法

### DSH 技能发现优先级

DSH 的本地技能提供方按 rank 顺序扫描各根目录（rank 高者被发现）：

| Rank | Source | Root |
|---|---|---|
| 100 | project-dsh | `<projectRoot>/.dsh/skills` |
| 200 | project-agents | `<projectRoot>/.agents/skills` |
| 300 | custom | `Config.customSkillDirs` |
| **400** | **user-dsh** | **`<dshHome>/skills`** |
| **500** | **user-agents** | **`<agentsHome>/skills`** |
| 600 | bundled | 配置了 `Config.bundledSkillDir` 时使用 |

项目根为包含 `.git` 的最近祖先目录；用户级 DSH 根会跳过其 `.system` 子目录。推荐安装到**用户级**两处（跨项目可用）：rank 400 `user-dsh` 或 rank 500 `user-agents`。

### 方式一（推荐）：安装到 user-dsh（rank 400）

把技能目录放进 `<dshHome>/skills`（`<dshHome>` 即环境变量 `DSH_HOME` 指向的目录）：

```sh
git clone https://github.com/qianmang1/dsh-skills.git
Copy-Item -Recurse dsh-skills/skills/dsh-hermes-plugin "$env:DSH_HOME\skills\"   # Windows
cp -r dsh-skills/skills/dsh-hermes-plugin "$DSH_HOME/skills/"                   # Linux/macOS
```

### 方式二：安装到 user-agents（rank 500）

放进 `<agentsHome>/skills`（通常为 `~/.agents/skills`，与 mattpocock/skills 等 `.agents` 生态技能同一位置）：

```sh
Copy-Item -Recurse dsh-skills/skills/dsh-hermes-plugin "$env:USERPROFILE\.agents\skills\"  # Windows
cp -r dsh-skills/skills/dsh-hermes-plugin ~/.agents/skills/                                # Linux/macOS
```

### 方式三（实验性）：npm 生态安装器

`npx skills@latest add qianmang1/dsh-skills`（skills.sh CLI，与 [mattpocock/skills](https://github.com/mattpocock/skills) 同一套安装机制）。本仓库的 `skills/<name>/SKILL.md` 目录结构与其兼容，但该安装器对 DSH 发现目录的支持**尚未验证**，装完请确认文件落在 rank 400/500 的根下。

### 丢给 Agent 的一键安装提示词

把下面这段直接发给你的编码 agent，它会自动解析 `$DSH_HOME` 并安装到 user-dsh（rank 400）：

```
请帮我安装一个 DSH 技能：
1. 解析环境变量 DSH_HOME 得到 dshHome 目录；若未设置，先向我询问 DSH 的家目录位置。
2. 克隆 https://github.com/qianmang1/dsh-skills.git 到临时目录。
3. 将其中的 skills/dsh-hermes-plugin 整个目录复制到 <dshHome>/skills/dsh-hermes-plugin（已存在则先备份再覆盖）。
4. 复制完成后列出 <dshHome>/skills/ 的内容向我确认，并清理临时目录。
不要修改该技能目录内的任何文件内容。
```

## 技能相互独立，无共享依赖；也可将 `skills/dsh-hermes-plugin` 复制进 deepseek-harness checkout 的 `.agents/skills/`（rank 200，仅项目内生效）。

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
