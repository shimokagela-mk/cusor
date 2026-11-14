# SillyTavern Regex API / 格式速查

对应机器可检索数据库：`data/sillytavern-regex-api.json`

Regex 是 SillyTavern 内置扩展，用于按规则查找、替换、删除或包装文本。它可以作用于用户输入、模型输出、Slash Commands、World Info 和 Reasoning 内容。维护 Regex 时必须同时判断：匹配什么、替换成什么、作用到哪里、是否写入聊天文件、是否限制聊天深度。

## 1. 编辑器逐项说明

| 编辑器控件 | JSON 字段 | 用途 | 写法与默认 |
| --- | --- | --- | --- |
| 测试模式 | 无稳定导出字段 | 临时输入文本并查看替换结果，只用于调试当前表达式。 | 不写入资产。 |
| 脚本名称 | `scriptName` | Regex 显示名，也常被 slash/STscript 按名称调用。 | 使用可读短名，避免和其他 Regex 重名。 |
| 查找正则表达式 | `findRegex` | 要匹配的表达式。 | 常见格式为 `/pattern/flags`；需要跨行时优先用 `[\s\S]` 或明确边界。 |
| 替换为 | `replaceString` | 匹配后的替换文本。 | 支持 `{{match}}`、`$1`、`$2`、`$<name>`；可为空字符串表示删除匹配内容。 |
| 修剪掉 | `trimStrings` | 替换前从每个匹配结果中全局移除指定片段。 | 数组；每行/每项一个要裁剪的文本，不是正则表达式列表。 |
| 作用范围 | `placement` | 决定 Regex 处理哪类来源。 | 使用导出数值数组；新建时只勾真正需要的来源。 |
| 已禁用 | `disabled` | 临时关闭脚本。 | `true` 时不运行；默认 `false`。 |
| 在编辑时运行 | `runOnEdit` | 编辑已有消息后是否重新应用 Regex。 | 默认 `false`；会改写旧消息的脚本需谨慎开启。 |
| 正则表达式查找时的宏 | `substituteRegex` | 运行前是否替换 `findRegex` 里的 ST 宏。 | `0` 不替换，`1` 原样替换，`2` 转义后替换。 |
| 仅影响显示 | `markdownOnly` | 只处理聊天 UI 显示文本。 | 不写入聊天文件；用户看到的内容可能不同于模型上下文。 |
| 仅影响后端提示词 | `promptOnly` | 只处理发给模型的 outgoing prompt。 | 不写入聊天文件；模型看到的内容可能不同于聊天 UI。 |
| 最小深度 | `minDepth` | 只影响至少 N 层深的聊天消息。 | `0` 是最后一条，`1` 是倒数第二条；`null`/空白表示不限制。 |
| 最大深度 | `maxDepth` | 只影响不深于 N 层的聊天消息。 | 必须大于 `minDepth` 才会生效；`null`/空白表示不限制。 |

## 2. 作用范围 `placement`

| 数值 | 名称 | 含义 | 新建建议 |
| --- | --- | --- | --- |
| `0` | MD Display | 早期显示路径来源。 | 仅识别既有资产，不作为新脚本默认来源。 |
| `1` | User Input | 用户发送的消息。 | 改用户输入前确认是否会改写原始聊天。 |
| `2` | AI Output | 生成 API 返回的模型消息。 | 清理模型输出、包装标记时常用。 |
| `3` | Slash Commands | STscript / slash command 发送的文本。 | Quick Reply 联动 Regex 时常用。 |
| `5` | World Info | 世界书条目内容。 | 通常需要配合 `promptOnly`，避免只改显示路径。 |
| `6` | Reasoning | reasoning block 内容。 | 只在目标后端/模型实际产生 reasoning 内容时有意义。 |

`placement` 应按当前 ST 导出值保留。单文件维护时不要凭经验把来源扩大到全部，否则可能同时改写用户输入、模型输出和世界书。

## 3. 深度规则

`minDepth` / `maxDepth` 是聊天历史倒序过滤，不是插入深度，也不是“写到第几层”。

| 值 | 含义 |
| --- | --- |
| `0` | 最后一条消息 |
| `1` | 倒数第二条消息 |
| `2` | 倒数第三条消息 |
| `null` / 空白 | 不限制 |
| `minDepth: -1` | 不限制，并可覆盖 Continue 操作中的续写消息 |

判定规则：

- `depth < minDepth` 时跳过脚本。
- `depth > maxDepth` 时跳过脚本。
- `maxDepth` 必须大于 `minDepth`，否则脚本不会按预期运行。
- 系统提示词和 utility prompts 不受这些深度字段影响。
- `999` / `9999` 不是“无限”的默认写法。只有用户明确要求把上限写成极大数字时才使用；默认无限必须写 `null` 或留空。

## 4. 宏替换 `substituteRegex`

| 值 | 编辑器选项 | 含义 | 用途 |
| --- | --- | --- | --- |
| `0` | Don't substitute | 不替换 `findRegex` 中的宏。 | 默认推荐，表达式最稳定。 |
| `1` | Substitute (raw) | 先把宏原样替换进正则。 | 需要宏内容参与正则语义时使用。 |
| `2` | Substitute (escaped) | 先替换宏，再把宏内容按正则字面量转义。 | 宏内容来自用户名、角色名等不应被当作正则语法时使用。 |

## 5. 表层替换

默认情况下，Regex 会直接改变聊天文件中的文本，通常不可逆。开启表层替换后，不写入聊天文件：

| 字段 | 编辑器文本 | 影响 |
| --- | --- | --- |
| `markdownOnly: true` | Alter Chat Display / 仅影响显示 | 只改聊天 UI 显示，不改 outgoing prompt。 |
| `promptOnly: true` | Alter Outgoing Prompt / 仅影响后端提示词 | 只改发给模型的 prompt，不改聊天 UI。 |
| 两者都为 `true` | 两条路径都临时处理 | 显示和模型上下文都被处理，但聊天文件仍不改。 |

调试时必须标注是否启用了表层替换，因为用户看到的文本、模型收到的文本、聊天文件里的文本可能三者不同。

## 6. 安全写法

推荐：

```json
{
  "findRegex": "/<note>[\\s\\S]*?<\\/note>/gi",
  "replaceString": "",
  "placement": [2],
  "markdownOnly": false,
  "promptOnly": false,
  "minDepth": null,
  "maxDepth": null
}
```

避免：

```text
/(.*)+/
/(.+)+/
/(.*)(.*)(.*)/
```

原因：嵌套贪婪分组容易在长消息上产生灾难性回溯。

## 7. HTML `replaceString`

`replaceString` 可短暂包装 HTML，例如：

```html
<span class="nl-regex-chip">$1</span>
```

约束：

- 禁止写 `<script>`。
- 禁止写 `onclick` / `onerror` 等事件属性。
- 捕获组内容可能来自用户或模型文本，插入真实 DOM 前要考虑 DOMPurify。
- 复杂交互应转为前端片段、原生扩展或 JS-Slash-Runner 脚本。

## 8. 调试清单

- `findRegex` 是否有清晰边界，能否处理换行？
- `replaceString` 是否正确使用 `{{match}}`、编号捕获组或命名捕获组？
- `trimStrings` 是否只是裁剪匹配片段中的固定文本？
- `placement` 是否只覆盖目标来源？
- `markdownOnly` / `promptOnly` 是否会造成显示与模型上下文不一致？
- `minDepth` / `maxDepth` 是否使用 `null` 表示无限，而不是 `999`？
- `runOnEdit` 是否会重复改写旧消息？
- 正则是否会在长文本上安全运行？

## 9. 作用域与回包边界

| 类型 | 保存位置 | 影响范围 |
| --- | --- | --- |
| Global Regex | 用户设置 | 多角色/全局 |
| Scoped Regex | 角色卡或角色相关数据 | 当前角色 |

奶龙工具箱可以审查单个 Regex JSON、生成骨架、优化单条表达式；不会自动把 Regex 回包到角色卡 `regex_scripts`。需要角色卡解包/回包时，应切换到奶龙王一键制卡流程。
