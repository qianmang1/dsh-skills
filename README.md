# dsh-skills

给 DeepSeek Harness（dsh）用的技能集合，目前有一个：

| 技能 | 用途 |
|---|---|
| [dsh-hermes-plugin](skills/dsh-hermes-plugin/SKILL.md) | 说一句需求，自动生成符合 dsh 官方规范的完整插件工程（插件框架是 vendored Cordis）。知识库对应官方文档快照 `c389f96bf3`，dsh 0.1.3-alpha.2 |

## 安装

dsh 会按顺序扫描几个技能目录，rank 高的先被发现：

| Rank | 位置 |
|---|---|
| 100 | `<projectRoot>/.dsh/skills` |
| 200 | `<projectRoot>/.agents/skills` |
| 300 | `Config.customSkillDirs` |
| **400** | **`<dshHome>/skills`**，即 `C:\Users\<用户名>\.dsh`（或 `~/.dsh`） |
| **500** | **`<agentsHome>/skills`**，即 `~/.agents` |
| 600 | `Config.bundledSkillDir` |

装到 400 或 500 都能跨项目使用，`.dsh` 和 `.agents` 选一个就够了。装进 deepseek-harness 仓库自己的 `.agents/skills/`（rank 200）只在那个项目里生效。

安装器默认把仓库里所有技能都装到目标目录，重跑只更新有变化的（没变化的直接跳过，不会留下一堆 `.bak`）。只想装某一个，加 `--skill <名称>`。目标位置可以用 `DSH_HOME` / `AGENTS_HOME` 环境变量改。

有 Node 18+ 的话用 npx 最省事：

```sh
npx github:qianmang1/dsh-skills --target dsh      # 装到 .dsh
npx github:qianmang1/dsh-skills --target agents   # 装到 .agents
npx github:qianmang1/dsh-skills --target dsh --skill dsh-hermes-plugin   # 只装一个
```

没有 Node 就用脚本：

```powershell
# Windows PowerShell
irm https://raw.githubusercontent.com/qianmang1/dsh-skills/main/install-dsh.ps1 | iex     # 装到 .dsh
irm https://raw.githubusercontent.com/qianmang1/dsh-skills/main/install-agents.ps1 | iex  # 装到 .agents
```

```sh
# Linux / macOS
curl -fsSL https://raw.githubusercontent.com/qianmang1/dsh-skills/main/install-dsh.sh | sh     # 装到 .dsh
curl -fsSL https://raw.githubusercontent.com/qianmang1/dsh-skills/main/install-agents.sh | sh  # 装到 .agents
```

`install-*.sh` 在 Windows 上用不了。另外 `irm | iex`、`curl | sh`、`npx` 都是在本机执行仓库代码，介意的话先看一遍脚本再跑，或者干脆手动来：

```sh
git clone https://github.com/qianmang1/dsh-skills.git
cp -r dsh-skills/skills/dsh-hermes-plugin ~/.dsh/skills/          # 或者 ~/.agents/skills/
```

不想自己动手，把这段话丢给 agent 也行：

```
请帮我安装一个 DSH 技能：
1. 解析环境变量 DSH_HOME 得到 dshHome 目录；若未设置，先向我询问 DSH 的家目录位置。
2. 克隆 https://github.com/qianmang1/dsh-skills.git 到临时目录。
3. 将其中的 skills/dsh-hermes-plugin 整个目录复制到 <dshHome>/skills/dsh-hermes-plugin（已存在则先备份再覆盖）。
4. 复制完成后列出 <dshHome>/skills/ 的内容向我确认，并清理临时目录。
不要修改该技能目录内的任何文件内容。
```

## 使用

装好后直接对助手说需求就行，比如"帮我写一个 dsh 插件，功能是列出本地目录内容"，匹配到技能它会自己加载。也可以点名："用 dsh-hermes-plugin 这个技能生成插件"。

## 加新技能

目录约定：`skills/<技能名>/SKILL.md` 必须有，`references/`、`assets/`、`scripts/` 按需放。加完在上面的表格里补一行。

## 相关链接

- dsh 官方文档：<https://github.com/deepseek-ai/deepseek-harness/tree/master/docs>
- 插件打包与分发：见官方文档 `docs/user/develop/basic/publish.md`

## License

[MIT](LICENSE)
