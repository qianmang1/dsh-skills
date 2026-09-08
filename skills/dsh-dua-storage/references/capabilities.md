# Capabilities：三工具能力与参数

> 来源：`@deepseek-ai/dsh-tool-dua-storage`（packages/fs/tool-dua-storage），dua 2.44.0。模型可见工具名：`dua_analyze` / `dua_candidates` / `dua_compare`。与实现不一致时以源码为准。

## 1. dua_analyze（空间分析）

用途：可靠空间事实与排名；单/多路径、递归、排除、测量模式。默认 path=session cwd。

参数（全部可选除非标注）：

| 参数 | 类型 | 说明 |
|---|---|---|
| `paths` | string[] | 一个或多个目录/文件；≤16；相对路径相对 session cwd 解析 |
| `depth` | number | 每个 path 之下的子层级数（1=直接子项）；1..6，默认 1 |
| `limit` | number | 每 path 保留节点数（祖先强制保留的 largest-first DFS）；默认 30，上限 500 |
| `sort` | string | largest/smallest/none，默认 largest（canonical 层排序） |
| `apparent_size` | boolean | 统计语义改为 apparent（非显示单位）；measurement 记录 |
| `count_hard_links` | boolean | 硬链接每次计（改变统计语义） |
| `stay_on_filesystem` | boolean | 默认 true：不跨文件系统/挂载点 |
| `exclude_dirs` | string[] | 绝对目录排除（dua `-i` 语义） |
| `exclude_patterns` | string[] | gitignore 风格模式排除，如 `**/node_modules/`、`**/.git/`（工具内部临时 ignore 文件，隐藏实现） |
| `performance` | string | low/balanced/fast → 线程 1 / ≤4 / ≤16 |
| `include_stats` | boolean | 附加 entriesTraversed（dua `--stats`） |

canonical（每 path 一项，`results[]`）：`path, measurement(disk|apparent), depth, totalBytes, entries[{path,bytes,dir,level}], partial, ioErrors[], truncated, skipped, stats?`

语义要点：
- 整数 bytes；dir 由是否有 children 判定（depth=1 时都为文件型叶，dir 不可判）。
- dua 对仅含文件目录不打印 total → totalBytes 回退为 entries 和。
- partial=true 表示 dua exit≠0 但输出可解析：数据可用 + ioErrors 说明哪些不可读；不要当作失败。
- 超 raw 8MB/超时/abort/解析不可信 → 抛稳定错误（见下），不返回半数据。

## 2. dua_candidates（候选发现）

用途：把目录分类成"可能值得人工检查的空间对象"。内部先做 analyze(depth, limit=max) 再按目录名规则分类。仍是纯分析。

参数：`paths`、`depth`(1..3, 默认 2)、`min_bytes`(默认 5MiB 过滤)、`limit`(默认 20)、`exclude_dirs`、`exclude_patterns`、`apparent_size`、`performance`

canonical：`{ candidates: [{path, bytes, category, confidence(0..1), facts[], inference, recommendation:'manual-review'}], filtered, partial }`

类别（名称规则）：`package-dependencies`(node_modules/.pnpm-store…)、`git-data`(.git/.hg/.svn)、`development-cache`(*cache*/DerivedDataCache)、`build-output`(dist/build/out/target/obj…)、`virtual-machine`(Virtual Machines/*.vmwarevm/*.vhdx…)、`recycle`(trash/回收站)、否则 `unknown`。

铁律：facts（名称+字节）≠ inference（类别推测）≠ recommendation（恒 manual-review）≠ action（不存在）。绝不把候选当"可安全删除"。

## 3. dua_compare（快照比较）

用途：跨时间/状态比较。快照是 DSH Storage Snapshot（自管 canonical JSON），不是 dua 原生快照；生命周期间接管理。

`operation`（枚举）：
- `snapshot`：捕获 `paths`（可选 `depth`，默认 1）→ 返回 `snapshot.id`（session 归属、TTL 6h 自动清理）
- `compare`：`before_id` + `after_id` → deltaBytes、growth[]、shrink[]（各 ≤25，path/beforeBytes/afterBytes/deltaBytes）、added[]、removed[]（不做 rename 猜测，消失=removed、出现=added）
- `list`：本 session 快照列表
- `remove`：`snapshot_id` 删除该快照（工具自有文件，非用户数据）

compare 要求前后同 depth 与 measurement；不同则报错。快照按 session（exec.agent.session.header.id）隔离；Agent 不提供任意文件路径。

## 4. 错误码

`STORAGE_NOT_FOUND`（dua 缺失/不可解析）、`STORAGE_INVALID_ARGUMENT`、`STORAGE_FAILED`（spawn/无可用输出）、`STORAGE_PARSE_FAILED`（输出不可解析）、`STORAGE_OUTPUT_OVERFLOW`（stdout 超 8MB cap）、`STORAGE_TIMEOUT`（120s 默认）、`STORAGE_ABORTED`（取消）。

## 5. 部署/配置（包 Config）

`duaExecutable`(默认 dua，本机可给绝对路径)、`defaultLimit/maxLimit/maxDepth/maxPaths/rawOutputMaxBytes/timeoutMs/graceMs/snapshotTtlMs/candidateMinBytes`。运行时需 profile 加载该包（overlay 或依赖安装）。
