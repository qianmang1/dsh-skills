#!/usr/bin/env python3
"""dsh-Hermes 插件静态校验器。

用法：python validate_plugin.py <插件目录>

按 DeepSeek Harness 官方规范（docs/user/develop/basic/publish.md、
docs/cookbook/adding-a-package.md、postmortem 0001）检查：
  - package.json 不变量（bundle 形态与 workspace 包形态分别校验）
  - patch/profile yml 引用完整性
  - namespace 插件禁止 export default
  - Config 必须是 Schemastery schema（禁止普通对象）
  - yml 中禁止单个 !js（必须 !!js）
  - ctx.tools 工具骨架提示（inject 声明 tools / execute / output，仅 WARNING）

输出 ERROR / WARNING 行；存在 ERROR 时退出码 1。
仅用标准库，无需第三方依赖。
"""

import json
import re
import sys
from pathlib import Path


def eprint(kind: str, msg: str) -> None:
    print(f"{kind}: {msg}")


def load_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        eprint("ERROR", f"{path}: 无法解析 JSON（{exc}）")
        return None


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except OSError:
        return ""


def strip_code_comments(text: str) -> str:
    """剥离 // 行注释与 /* */ 块注释，避免文档性提及触发误报。"""
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    return re.sub(r"//[^\n]*", "", text)


def check_yml_js_operator(text: str, path: Path, problems: list) -> None:
    """检测单个 !js（正确写法是 !!js）。"""
    for i, line in enumerate(text.splitlines(), 1):
        stripped = line.split("#", 1)[0]
        if re.search(r"(?<!!)!js\b", stripped):
            problems.append((path, i, "yml 中出现单个 `!js`，必须写 `!!js`"))


def check_entry_sources(root: Path, problems: list, warnings: list) -> None:
    """检查入口源码：export default、Config schema、effect 使用。"""
    candidates = list(root.glob("index.js")) + list(root.glob("index.mjs"))
    src_dir = root / "src"
    if src_dir.is_dir():
        candidates += list(src_dir.rglob("*.ts")) + list(src_dir.rglob("*.tsx"))
    seen_entry = False
    for path in candidates:
        text = read_text(path)
        if not text.strip():
            continue
        code = strip_code_comments(text)
        rel = path.relative_to(root).as_posix()

        is_entry = "export function apply" in code or "apply(ctx" in code
        has_namespace_meta = bool(
            re.search(r"export\s+const\s+(name|inject|Config)\b", code)
        )
        if is_entry:
            seen_entry = True

        # 禁忌 1：namespace 插件中出现 export default（postmortem 0001）
        if re.search(r"export\s+default\b", code) and (
            has_namespace_meta or re.search(r"export\s+function\s+apply\b", code)
        ):
            problems.append(
                (path, 0,
                 f"namespace 插件（含 name/inject/Config/apply 具名导出）"
                 "中出现 `export default`——Loader 会丢弃模块命名空间导致"
                 " inject/name/Config 全部失效，禁止使用")
            )

        # 禁忌 4：普通对象作为 Config（缺 Standard Schema 接口）
        if re.search(r"export\s+interface\s+Config\b", code) and not re.search(
            r"export\s+const\s+Config\b", code
        ):
            problems.append(
                (path, 0,
                 f"导出了 `interface Config` 但缺少同名 `export const Config`"
                 "（Schemastery schema）——Cordis 无法校验普通对象配置")
            )
        if re.search(r"export\s+const\s+Config\s*=\s*\{", code):
            problems.append(
                (path, 0,
                 f"`Config` 被导出为普通对象字面量——必须使用 "
                 "Schemastery（Schema.object(...)）或实现 Standard Schema 的校验器")
            )

        # 禁忌 8：手动清理（经 ctx 的注册自动回收）
        if re.search(r"\.removeListener\s*\(|\.off\s*\(|clearInterval\s*\(", code):
            warnings.append(
                (path, 0,
                 f"出现手动 removeListener/off/clearInterval——经 ctx 注册的"
                 "监听器/定时器在插件卸载时自动回收；确属自建资源应改用 ctx.effect")
            )

        # 禁忌 7：代码内读密钥文件
        if re.search(r"readFile\S*\(\s*['\"][^'\"]*(secret|key|token)", code, re.I):
            warnings.append(
                (path, 0,
                 f"疑似在代码内读取密钥文件——密钥必须走 Config + "
                 "`!!js process.env.X`")
            )

        # Tool Plugin 轻量检查（仅 WARNING；不做脆弱 AST 假设，字面模式
        # 可能误报，因此绝不升级为 ERROR）
        if "ctx.tools.register" in code:
            if not re.search(r"inject\s*=\s*\[[^\]]*['\"]tools['\"]", code):
                warnings.append(
                    (path, 0,
                     f"检测到 ctx.tools.register 但未在 inject 中声明 'tools'——"
                     "依赖未就绪会永远 PENDING，apply 不会运行")
                )
            if not re.search(r"\bexecute\s*\(", code):
                warnings.append(
                    (path, 0,
                     f"检测到 ctx.tools.register 但未见 execute——execute 是工具"
                     "执行入口，只返回 canonical JSON value（不得返回 content blocks）")
                )
            if not re.search(r"output\s*:", code):
                warnings.append(
                    (path, 0,
                     f"检测到 ctx.tools.register 但未见 output 定义——需要 "
                     "output.schema（canonical 值契约）+ output.render（模型可见投影）")
                )

    if not seen_entry:
        problems.append((root, 0, "未找到插件入口（index.js 或 src/**.ts 中的 apply）"))


def check_bundle(root: Path, pkg: dict, problems: list, warnings: list) -> None:
    name = pkg.get("name", "")
    if not name.startswith("dsh-"):
        problems.append((root / "package.json", 0,
                         f"bundle 包名必须以 `dsh-` 开头，当前为 `{name}`"))

    patch_rel = (pkg.get("dsh", {}).get("bundle", {}) or {}).get("patch")
    if not patch_rel:
        problems.append((root / "package.json", 0,
                         "缺少 `dsh.bundle.patch` 声明——没有它只作为普通依赖安装，"
                         "`dsh plugin` 会告警且不激活层"))
        return
    patch_path = root / patch_rel
    if not patch_path.is_file():
        problems.append((root / "package.json", 0,
                         f"`dsh.bundle.patch` 指向的 `{patch_rel}` 不存在"))
        return

    files = pkg.get("files", [])
    if patch_rel.lstrip("./") not in [f.lstrip("./") for f in files]:
        warnings.append((root / "package.json", 0,
                         f"`files` 应包含 `{patch_rel}`，否则发布包缺少配置层"))
    main = pkg.get("main", "")
    if main and main.lstrip("./") not in [f.lstrip("./") for f in files]:
        warnings.append((root / "package.json", 0,
                         f"`files` 应包含入口 `{main}`"))

    text = read_text(patch_path)
    check_yml_js_operator(text, patch_path, problems)
    # patch 行 name: 引用的模块必须存在（包名或相对/绝对路径）
    for m in re.finditer(r"^\s*name:\s*(.+?)\s*$", text, re.M):
        target = m.group(1).strip().strip("'\"")
        if target.startswith(("dsh-", "@")):
            continue  # 包名引用，由 Node 解析
        p = Path(target)
        if not (p.is_absolute() and p.exists()) and not (root / target).exists():
            warnings.append(
                (patch_path, 0,
                 f"patch 行 name 引用 `{target}` 在 bundle 内不存在；"
                 "bundle 行应引用包名，本地调试 patch 中的插件路径必须为绝对路径"))


def check_workspace(root: Path, pkg: dict, problems: list, warnings: list) -> None:
    name = pkg.get("name", "")
    if not name.startswith("@deepseek-ai/dsh-"):
        warnings.append((root / "package.json", 0,
                         f"workspace 包名惯例为 `@deepseek-ai/dsh-<name>`，当前为 `{name}`"))

    def expect(cond: bool, msg: str) -> None:
        if not cond:
            problems.append((root / "package.json", 0, msg))

    expect(pkg.get("private") is True, "workspace 包必须 `private: true`")
    expect(pkg.get("type") == "module", "必须 `\"type\": \"module\"`")
    expect(pkg.get("main") == "lib/index.js", "`main` 必须是 `lib/index.js`")
    expect(pkg.get("types") == "lib/types/index.d.ts",
           "`types` 必须是 `lib/types/index.d.ts`")
    exports = pkg.get("exports", {}).get(".", {})
    expect(exports.get("types") == "./lib/types/index.d.ts"
           and exports.get("default") == "./lib/index.js",
           "`exports[\".\"]` 必须提供 types（./lib/types/index.d.ts）与 "
           "default（./lib/index.js）")
    files = pkg.get("files", [])
    if "lib/index.js" not in files:
        problems.append((root / "package.json", 0,
                         "`files` 必须含 `lib/index.js` 与 `lib/types/**/*.d.ts`，"
                         "不得发布 src 或 map"))
    peer = pkg.get("peerDependencies", {})
    dev = pkg.get("devDependencies", {})
    expect("@deepseek-ai/cordis" in peer,
           "`@deepseek-ai/cordis` 必须出现在 peerDependencies")
    if "@deepseek-ai/cordis" in peer and "@deepseek-ai/cordis" not in dev:
        problems.append((root / "package.json", 0,
                         "`@deepseek-ai/cordis` 必须镜像进 devDependencies（同范围）"))

    uses_schema = pkg.get("dependencies", {}).get("@deepseek-ai/schemastery") is not None
    tsconfig = root / "tsconfig.json"
    if not tsconfig.is_file():
        problems.append((root, 0, "workspace 包缺少 tsconfig.json"))
    else:
        tscfg = load_json(tsconfig)
        if tscfg:
            refs = json.dumps(tscfg.get("references", []))
            if "vendor/cordis" not in refs:
                warnings.append((tsconfig, 0,
                                 "tsconfig references 未包含 ../../../vendor/cordis"))
            if "vendor/schemastery" not in refs and uses_schema:
                warnings.append((tsconfig, 0,
                                 "声明了 schemastery 依赖但 tsconfig references "
                                 "未包含 ../../../vendor/schemastery"))
    src = root / "src" / "index.ts"
    if src.is_file() and re.search(r"Schema\b", read_text(src)) and not uses_schema:
        problems.append((root / "package.json", 0,
                         "入口使用 Schemastery 但 `@deepseek-ai/schemastery` "
                         "不在 dependencies（运行时校验器，必须为直接依赖）"))


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    root = Path(sys.argv[1])
    if not root.is_dir():
        eprint("ERROR", f"插件目录不存在：{root}")
        return 1

    problems: list = []
    warnings: list = []

    pkg_path = root / "package.json"
    pkg = load_json(pkg_path) if pkg_path.is_file() else None
    if pkg is None:
        problems.append((pkg_path, 0, "缺少可解析的 package.json"))
    else:
        is_bundle = "bundle" in (pkg.get("dsh", {}) or {})
        if pkg.get("type") != "module":
            problems.append((pkg_path, 0, "必须 `\"type\": \"module\"`"))
        if is_bundle:
            check_bundle(root, pkg, problems, warnings)
        else:
            check_workspace(root, pkg, problems, warnings)

    check_entry_sources(root, problems, warnings)

    # 校验目录内所有 cordis yml 的 !js 用法（patch 文件已在上方检查，结果会去重）
    for yml in list(root.glob("*.yml")) + list(root.glob("*.yaml")):
        check_yml_js_operator(read_text(yml), yml, problems)

    problems = list(dict.fromkeys(problems))  # 去重（保持顺序）
    warnings = list(dict.fromkeys(warnings))

    def loc(path: Path, line: int) -> str:
        try:
            rel = path.relative_to(root)
        except ValueError:
            rel = path
        return f"{rel}:{line}" if line else str(rel)

    has_error = False
    for path, line, msg in problems:
        has_error = True
        eprint("ERROR", f"{loc(path, line)}: {msg}")
    for path, line, msg in warnings:
        eprint("WARNING", f"{loc(path, line)}: {msg}")

    if has_error:
        eprint("RESULT", f"FAIL — {len(problems)} 个错误，{len(warnings)} 个警告")
        return 1
    eprint("RESULT", f"PASS — 0 个错误，{len(warnings)} 个警告（WARNING 需逐条确认）")
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.exit(main())
