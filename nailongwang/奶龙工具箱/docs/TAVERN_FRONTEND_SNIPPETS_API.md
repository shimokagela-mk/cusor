# Tavern 前端片段格式速查

对应机器可检索数据库：`data/tavern-frontend-snippets-api.json`

前端片段指可放入消息、状态栏、开场白、Regex `replaceString` 或扩展模板中的短 HTML/CSS 骨架。

## 1. 适用场景

| 类型 | 用途 |
| --- | --- |
| `message_html` | 消息内卡片、提示框、剧情摘要 |
| `status_bar` | 角色状态、变量摘要、进度条 |
| `greeting_html` | 开场白排版 |
| `regex_replace_html` | Regex 替换后的短 HTML |
| `scoped_css` | 局部 CSS |

示例：`examples/frontend-snippets/`

## 2. 推荐 JSON 骨架

```json
{
  "name": "Status Panel Snippet",
  "kind": "status_bar",
  "scope_class": "nl-status-panel",
  "html": "<section class=\"nl-status-panel\">Placeholder</section>",
  "css": ".nl-status-panel { max-width: 100%; }",
  "security_notes": ["插入真实 DOM 前使用 DOMPurify.sanitize。"]
}
```

## 3. scoped CSS 规则

- 所有选择器以唯一根类开头，例如 `.nl-status-panel`。
- 避免 `body`、`html`、`.mes` 等宽泛全局覆盖。
- 移动端优先使用 `max-width: 100%`、`flex-wrap`、`gap`、`rem`。
- 不写第三方长 CSS；复杂主题属于 Theme/扩展任务。

## 4. 常用骨架

### 折叠面板

```html
<details class="nl-snippet nl-panel">
  <summary>Panel</summary>
  <div>Placeholder.</div>
</details>
```

### 按钮组

```html
<div class="nl-snippet nl-actions">
  <button type="button">Action</button>
</div>
```

消息内按钮通常不应假设能执行脚本；如果要绑定事件，应在扩展或 JS-Slash-Runner 中明确实现。

### 剧情推进面板

```html
<section class="nl-snippet nl-progress">
  <h3>Scene</h3>
  <ol><li>Step placeholder</li></ol>
</section>
```

## 5. DOMPurify 与 XSS

- 来自用户、模型、网络的 HTML 插入真实 DOM 前都应 `DOMPurify.sanitize`。
- 禁止 `<script>`、`iframe`、`onerror`、`onclick` 等可执行内容。
- Regex 捕获组 `$1` 可能包含未清理文本，替换为 HTML 时要谨慎。
- 不放真实 token、cookie、外链追踪像素。
