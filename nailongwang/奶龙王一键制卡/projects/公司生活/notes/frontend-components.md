# 前端组件说明

## 已完成

| 文件 | 作用 |
|---|---|
| `opening.html` | 开场白纯文本（first_mes） |
| `opening-regex.html` | 开场美化 + 读 `__ACU_TEMPLATE_DATA__` / `__ACU_PRESET_DATA__` 初始化 |
| `剧情推进.json` | 推进预设本体（extractTags: recall,scene,present,affection,next,dm） |
| `推进美化.html` | 从聊天提取标签展示 |
| `推进正则配置.json` | beautify / cleanup |
| `status-bar.html` | 状态栏：全局/人物/好感 + 立绘位（BubbleCG） |
| `office-data-bridge.js` | 表格读取桥 |

## 立绘约定

- 状态栏点击角色名 → `window.top.BubbleCG.getRandomImage(角色名)`（组名=角色名）
- 无资源时显示占位提示，不硬编码 URL

## 世界书注入

- `entries/999-ACU-表格模板.yaml` → `__ACU_TEMPLATE_DATA__`
- `entries/998-ACU-剧情推进预设.yaml` → `__ACU_PRESET_DATA__`
