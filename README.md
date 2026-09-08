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

项目根为包含 `.git` 的最近祖先目录；用户级 DSH 根会跳过其 `.system` 子目录。推荐安装到**用户级**两处（跨项目可用）：rank 400 `user-dsh` 或 rank 500 `user-agents`。**每个目标各一条命令，互不混杂。**

所有安装途径均为「暂存区先下载校验、成功后才替换」的安全顺序；目标已存在时自动备份旧版本（时间戳后缀）。默认路径：`.dsh` → Windows `C:\Users\<用户名>\.dsh` / Linux·macOS `~/.dsh`；`.agents` → `~/.agents`（`DSH_HOME` / `AGENTS_HOME` 环境变量可覆盖）。

### 方式一（推荐）：npx 安装（需 Node ≥18）

```sh
npx github:qianmang1/dsh-skills --target dsh      # 装 user-dsh（rank 400）
npx github:qianmang1/dsh-skills --target agents   # 装 user-agents（rank 500）
```

直接从本仓库运行安装器，无需发布到 npm registry。可选参数：`--skill <名称>` 安装其他技能。

### 方式二：免 Node 脚本（Windows PowerShell）

```powershell
# 装 user-dsh（rank 400）
irm https://raw.githubusercontent.com/qianmang1/dsh-skills/main/install-dsh.ps1 | iex

# 装 user-agents（rank 500）
irm https://raw.githubusercontent.com/qianmang1/dsh-skills/main/install-agents.ps1 | iex
```

### 方式三：免 Node 脚本（Linux / macOS）

```sh
# 装 user-dsh（rank 400）
curl -fsSL https://raw.githubusercontent.com/qianmang1/dsh-skills/main/install-dsh.sh | sh

# 装 user-agents（rank 500）
curl -fsSL https://raw.githubusercontent.com/qianmang1/dsh-skills/main/install-agents.sh | sh
```

> **信任边界**：`irm | iex` / `curl | sh` / `npx` 都意味着在本机执行仓库代码，仅在你信任本仓库时使用；也可先下载脚本查看再运行。`install-*.sh` 在 Windows 上不适用；`npx skills@latest add`（skills.sh 第三方安装器）对 DSH 发现目录的支持未验证，不在承诺路径内。

<details>
<summary>手动方式（git clone + 复制，不执行任何安装代码）</summary>

```sh
git clone https://github.com/qianmang1/dsh-skills.git
Copy-Item -Recurse dsh-skills/skills/dsh-hermes-plugin "$env:DSH_HOME\skills\"       # Windows，rank 400
Copy-Item -Recurse dsh-skills/skills/dsh-hermes-plugin "$env:USERPROFILE\.agents\skills\"  # Windows，rank 500
cp -r dsh-skills/skills/dsh-hermes-plugin "$DSH_HOME/skills/"                        # Linux/macOS，rank 400
cp -r dsh-skills/skills/dsh-hermes-plugin ~/.agents/skills/                          # Linux/macOS，rank 500
```

</details>

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
