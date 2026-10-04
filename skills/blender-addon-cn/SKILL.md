---
name: blender-addon-cn
description: 'Use when localizing a third-party Blender add-on/extension into Simplified Chinese (UI strings). Covers locating the extension, precise string extraction, building the translation dictionary, packaging a standalone patch extension (without touching official files), and registering via bpy.app.translations with the correct official structure {locale: {(context, msgid): msgstr}}. Invoke with requests like 汉化插件 / 插件中文补丁 / translate addon UI.'
---

# Blender 插件汉化（简体中文）

## 目标与边界
- 给第三方 Blender 插件（4.2+ 扩展，位于 extensions/<repo>/<id>）做界面汉化。
- 只翻 UI 字符串；技术串（枚举、格式串 %d、bl_idname、面板 id、内部名）一律不动。
- 用**独立补丁扩展**方案，不改官方文件（官方更新不被覆盖、可回滚）。

## 流程（已实测）

### 1. 定位与提取
扩展目录：`%APPDATA%/Blender Foundation/Blender/<ver>/extensions/<repo>/<id>/`（blender_org=官方仓库，user_default=用户区）。
AST 精准提取 UI 字符串：operator 的 bl_label/bl_description；`bpy.props.*Property` 的 name=/description=；draw 中 `layout.label/operator/prop(…, text=…)`。再清洗（剔除：`^[A-Z0-9_]{6,}$`、以 mesh./object./io_/archimesh./blend 开头、含格式符 % 的、首字符非字母的）。

### 2. 生成翻译字典
```python
# zh_cn.py
DICT = {'Books': '书本', 'Roof Generator': '屋顶生成器', ...}
```

### 3. 打包补丁扩展（user_default 区，独立）
目录 `extensions/user_default/<id>_cn/`，三件套：
- `blender_manifest.toml`：id、version、name（可中文）、type="add-on"、blender_version_min、license
- `zh_cn.py`：上面的 DICT
- `__init__.py`：见下

### 4. 注册翻译（关键：官方结构）
```python
# __init__.py
import bpy
from . import zh_cn as _zh
def register():
    ctxs = {'*', 'Operator', 'Panel'}
    for t in dir(bpy.types):
        if t.startswith('<EXT_PREFIX>'):  # 如 ARCHIMESH_
            ctxs.add(t)
            bid = getattr(getattr(bpy.types, t), 'bl_idname', None)
            if isinstance(bid, str): ctxs.add(bid); ctxs.add('Operator:' + bid)
    table = {}
    for c in ctxs:
        for mid, mtr in _zh.DICT.items(): table[(c, mid)] = mtr
    bpy.app.translations.register('<module_name>', {'zh_HANS': table, 'zh_CN': table})
def unregister():
    bpy.app.translations.unregister('<module_name>')
```

**实测要点（血泪）**：
- 字典结构必须是 `{locale: {(context, msgid): msgstr}}`——层级反了不生效。
- locale 码用 `zh_HANS`（简体，5.x 标准）；保留 zh_CN 兼容无妨。
- 悬停提示（description）默认 ctx `*` 就能中；按钮标题（label）还要 Operator/Panel/bl_idname/类名 上下文。
- module_name 用被翻译扩展的模块路径（如 bl_ext.blender_org.archimesh）。

### 5. 放置与验证
- 我（agent）的沙箱通常写不了 Blender AppData → 生成包到工作区 `archimesh_cn_pack/` 式目录，**给用户一条 Copy-Item 命令** + 重启/禁用启用。
- 验证：Translations API 实测 `bpy.app.translations.pgettext('...')` 返回中文；MCP 截图确认；悬停提示中文是机制生效的信号。

## 工具资产
参考实现/脚本可放技能同目录：extract_precise.py（AST 提取）、clean 脚本、zh dict 模板、补丁 __init__ 模板。

## 常见坑
- 官方扩展区（blender_org）ACL 只读 → 只写 user_default 补丁。
- 老插件依赖 bgl 等已删模块 → 不兼容 5.x，别硬装。
- 官方更新会改文件 → 补丁扩展方案天然免疫。
- 提取会掺入大量技术串 → 必须清洗；宁少勿翻错。