# @deepseek-ai/dsh-<PLUGIN_NAME>

<PLUGIN_DISPLAY_NAME> — deepseek-harness workspace 内插件包。

## 结构

```
packages/<group>/<PLUGIN_NAME>/
├── package.json     # 不变量：发布形态(publishConfig.access: public，不设 private)/type:module/main/types/exports/files，
│                    # cordis 同时在 peer+dev，schemastery 在 dependencies
├── tsconfig.json    # extends 根 tsconfig.base.json；references 指向 vendored 包
├── src/index.ts     # namespace 导出：name / inject / Config / apply
└── README.md        # 服务 API、事件、扩展点 + Model Experience + Known Limitations
```

## 接入 workspace（新包必做）

1. 分组（group）只能是纯容器；包位于 `packages/<group>/<PLUGIN_NAME>/` 正好一层。
2. 根 `tsconfig.base.json`：给 `@deepseek-ai/dsh-*` 通配符加入
   `./packages/<group>/*`（分组已存在则无需改）。
3. Host 包加入 `tsconfig.host.json` 的 references；Client 包加入
   `tsconfig.client.json`——普通包只属于一个聚合，绝不两个都进。
4. 根 workspaces / publint / tsdown preset / oxlint 均自动覆盖，无需手改。

## 验证序列

```sh
pnpm install        # 注册 workspace
pnpm run doc-sync
pnpm run constraints && pnpm run typecheck && pnpm run lint
pnpm run build && pnpm run hygiene
```

## 命名

- 包名 `@deepseek-ai/dsh-<name>`；服务注册名（ctx key）加独特前缀；
- 事件名 `namespace/action`；角色后缀按语义选词
  （Controller/Store/Registry/Engine/Executor/…），禁止只因继承 Cordis
  Service 而叫 Service。