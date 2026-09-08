# dsh-<PLUGIN_NAME>

<PLUGIN_DISPLAY_NAME> — dsh-Hermes (DeepSeek Harness) 插件。

## 功能

<!-- 生成时替换：一段话说明插件做什么、如何触发。 -->

## 结构

```
├── package.json       # 声明 dsh.bundle，指向配置层
├── cordis.patch.yml   # profile 安装本 bundle 后应用的配置层
└── index.js           # 插件入口（namespace 导出：name/inject/Config/apply）
```

## 安装与使用

```sh
# 安装到 profile（目录 / git / tarball 均可）
dsh plugin --profile <profile> add ./dsh-<PLUGIN_NAME>

# 验证层已应用（应出现 "# == dsh-<PLUGIN_NAME>" 层）
dsh --profile <profile> --dump-config

# 启动
dsh --profile <profile>

# 卸载
dsh plugin --profile <profile> remove dsh-<PLUGIN_NAME>
```

本地热插调试（未打包时）：

```sh
pnpm dsh web --patch ./cordis.yml
# cordis.yml 中插件路径必须为绝对路径
```

## 配置

在 profile 的 `cordis.patch.yml` 中覆盖本 bundle 的行（按 `id` 逐行胜出；
覆盖时必须重述该行全部 config key，patch 是整行替换而非深合并）。

## 从 git 安装须知

git 安装只取源码。若本包改为 TypeScript，作者必须提供自包含的 `prepare`
构建脚本，用户需在 profile 的 `pnpm-workspace.yaml` 中允许构建：

```yaml
allowBuilds:
  dsh-<PLUGIN_NAME>: true
```

免构建分发：发布到 npm，或 `pnpm pack` 出 tarball 后
`dsh plugin add ./dsh-<PLUGIN_NAME>-0.1.0.tgz`。
