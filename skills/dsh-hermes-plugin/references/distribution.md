# 打包与分发：bundle / profile / 安装与加载顺序

> 知识库来源：`docs/user/develop/basic/publish.md`（本文件逐字提炼其契约）。生成可分发插件时遵循本文。

## 1. bundle 与 profile 是两个概念

> 术语澄清：**"npm 包"指格式标准（package.json 清单/版本/registry 协议），不是 npm 安装器**。dsh 的实际安装器是 **pnpm**——`dsh plugin` 的所有动词都转发给 profile 目录里的 pnpm；手动 `npm install`/`yarn add` 会绕开层管理（`dsh.profile.bundles` 不记录、层序不生效、`remove` 卸不掉），不受支持。docs 中 Yarn 零出现。

- **bundle**：npm 包，`package.json` 声明 `dsh.bundle`，回答"这个包贡献什么"——一个 patch 文件（插入或覆盖插件行）。
- **profile**：`$DSH_HOME/profiles/<name>` 目录，`package.json` 声明 `dsh.profile`（有序 `bundles` 列表），回答"由哪些 bundle 组成"。
- 没有任何东西同时是两者。没有 `dsh.bundle` 声明的包只作为普通依赖安装，`dsh plugin` 告警且不激活层。

## 2. bundle 工程（默认交付形态）

```
hello-plugin/
├── package.json       # 声明 dsh.bundle
├── cordis.patch.yml   # profile 列出该 bundle 时应用的层
└── index.js           # patch 行引用的插件模块
```

`package.json`（逐字模板，Skill 资产 `assets/bundle-plugin/`）：

```json
{
  "name": "dsh-hello-plugin",
  "version": "0.1.0",
  "type": "module",
  "main": "index.js",
  "files": ["index.js", "cordis.patch.yml"],
  "dsh": { "bundle": { "patch": "./cordis.patch.yml" } }
}
```

入口 `index.js`（namespace 导出，禁止 default）：

```js
export const name = 'hello-plugin'

export function apply() {
  console.log('[hello-plugin] plugin loaded!')
}
```

`cordis.patch.yml`（YAML 数组，与 `--patch` overlay 相同格式，但 **name 用包名**而非相对源路径，Node 解析已安装代码）：

```yaml
- insert:
    - id: hello
      name: dsh-hello-plugin
```

行可选字段：`inject: [tools]`、`config: { key: value }`。bundle 作者提供用户大概率保留的默认值，其余交给 schema——用户可在 profile patch 中覆盖你的行。

## 3. 安装与卸载

```sh
dsh plugin --profile demo add ./hello-plugin        # 本地目录 / git:you/pkg / tarball 均可
dsh --profile demo --dump-config                    # 验证层（应出现 "# == dsh-hello-plugin" 层）
dsh --profile demo                                  # 启动
dsh plugin --profile demo remove dsh-hello-plugin   # 卸载（移除依赖+层）
```

首个 add 会初始化 profile（`@deepseek-ai/dsh-base` 为第一个 bundle）。

## 4. 加载顺序（决定覆盖关系）

1. profile 的 `dsh.profile.bundles` 列表逐个应用（按序，`@deepseek-ai/dsh-base` 在前）
2. profile 自己的 `cordis.patch.yml`
3. `$DSH_HOME/cordis.patch.yml`（机器级共享偏好）
4. 每个 `--patch <path>` overlay（argv 顺序）

**后层逐行胜出（按 id），且 patch 替换整行 `config` 而非深合并**——覆盖某 id 的行必须重述该行所需的每一个 key。

## 5. 从 git 安装的构建陷阱

git 安装只取**源码**，不运行 build：
- **作者**必须提供自包含的 `prepare` 脚本（pnpm 在 git install 后运行），不得假设 sibling monorepo。
- **用户**需在 profile 的 `pnpm-workspace.yaml` 加 `allowBuilds: { <pkg>: true }` 后重跑 add。
- 免构建分发：发布到 npm（`lib/` 在 `pnpm publish` 时构建）或 `pnpm pack` 出 tarball（`dsh plugin add ./x-0.1.0.tgz`）。

## 6. 本地热插调试

```sh
pnpm dsh web --patch ./scratch-plugin/cordis.yml
```

overlay 中**插件路径必须是绝对路径**（patch 文件不改变 loader 的解析基准目录）：

```yaml
- insert:
    - id: hello
      name: '/absolute/path/to/deepseek-harness/scratch-plugin/src/my-plugin.ts'
```

## 7. surface bundle 自带命令行（进阶）

可运行 app 的 bundle 挂载一个普通 provider 插件：行 `name: 'dsh-hello-plugin/startup'`，插件 `inject = ['cmdlineArgs']`，用 `@deepseek-ai/dsh-cmdline` 的 `parseCmdline` 定义 commander 程序并提供 app 服务。依赖该服务的行从 `!!js` options 读取并带部署回退值：`config: { port: !!js ctx.myAppStartup.port ?? 8080 }`。`--help` 时 provider 不发布服务，相关行不激活。

## 8. Client 插件分发（dsh 0.1.3 新体系）

浏览器侧插件（React 组合/资源 provider/侧栏 tab）在包上额外声明：
- `package.json` 增加 **`dsh.client`** 字段，`exports` 增加 **`"./client"`** 导出（懒 CJS 工厂 bundle）；
- tsconfig extends **`tsconfig.base.client.json`**，构建走共享 preset `packages/client/tsdown.client.ts`；
- Host/Client 聚合二选一：包加入 `tsconfig.host.json` 或 `tsconfig.client.json` 的 references，**绝不两个都进**；
- **bundle-purity gate 禁止跨插件 value import**（只允许 `import type`）；
- 构建序列：`tsc -b tsconfig.host.json` → `tsdown --env.DSH_BUILD_FACE host` → client 同理 → `build:web`（`docs/development.md`）。

详见 `docs/subsystems/client-modules.md`、`docs/cookbook/adding-a-settings-card.md` Packaging 节。

## 9. package.json files 白名单细则（constraints 强制）

- 恰为 `lib/index.js`、`lib/types/**/*.d.ts` 与被门认可的运行时产物；
- 有 `./invariant` 导出时加 `lib/invariant.js`；CLI bin 包在 `lib/index.js` 后紧跟 `lib/bin.js`；
- 运行时导出可指向 emitted tree 的 `lib/types/**/*.js`；
- **禁止发布** `src`、declaration maps、JS maps、过期根声明文件；
- 包 README 收尾契约（两个 verifier 强制）：`## Model Experience`（Request context and condition / What the model sees / Token effect / KV Cache effect）+ `## Known Limitations and Deferred Work`。
