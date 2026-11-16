# SillyTavern STscript / Slash Commands 速查

对应机器可检索数据库：`data/sillytavern-stscript-api.json`

STscript 是 SillyTavern 的 slash command 脚本组合方式，常与 Quick Reply 按钮联动。它适合短流程、按钮命令、变量读写、轻量聊天/世界书操作；复杂 DOM、异步请求、长状态机和错误处理应转 JS-Slash-Runner 或 SillyTavern 原生扩展。

## 1. 常用命令

| 命令 | 用途 | 副作用 |
| --- | --- |
| `/pass` | 把常量写入 pipe | 无 |
| `/echo` | 输出调试通知，可用 `severity` 设置样式 | UI |
| `/popup` / `/input` / `/buttons` | 弹窗、输入、按钮选择 | UI 阻塞 |
| `/setinput` | 替换聊天输入框内容 | UI 写入 |
| `/setvar` / `/getvar` | 写入/读取本地变量 | 元数据写入/只读 |
| `/setglobalvar` / `/getglobalvar` | 写入/读取全局变量 | 设置写入/只读 |
| `/let` / `/var` | 作用域变量，常配合闭包 | 运行时状态 |
| `/if` / `/while` / `/times` | 条件与循环 | 取决于子命令 |
| `/break` | 提前跳出循环或闭包 | 流程控制 |
| `/run` / `/:` | 运行 QR、命名闭包或过程 | 取决于目标 |
| `/char-get` / `/char-create` / `/char-update` | 读取、创建或更新角色数据 | 只读/角色写入 |
| `/loader-show` / `/loader-hide` / `/loader-wrap` | 显示加载遮罩并包裹耗时闭包 | UI/取决于子命令 |
| `/trigger` | 触发正常生成 | LLM 生成 |
| `/send` / `/sendas` / `/sys` / `/comment` | 添加聊天消息 | 聊天写入 |
| `/messages` | 读取聊天消息范围 | 只读 |
| `/inject` / `/note` | 写提示注入或作者注释 | 聊天元数据写入 |
| `/getchatbook` / `/findentry` / `/getentryfield` | 读取或定位世界书 | 只读/可能创建聊天世界书 |
| `/setentryfield` / `/createentry` | 修改或创建世界书条目 | 世界书写入 |
| `/qr-create` / `/qr-update` / `/qr-delete` | 管理 Quick Reply | QR 配置写入 |

示例：`examples/stscript/basic-flow.stscript`

## 2. Pipe 传值

```text
/getvar example_stage | /echo 当前阶段={{pipe}}
```

规则速查：

- 单管道 `|`：把前一个命令输出传给下一个命令。
- 双管道 `||`：阻止前一个输出自动注入下一个命令。
- `{{pipe}}`：显式引用上一步输出，适合嵌入模板文本。
- 闭包内父级 pipe 是否自动注入属于版本相关行为，跨版本脚本应显式写 `{{pipe}}`。

复杂数据处理不要堆叠命令，应转 JS-Slash-Runner。

## 3. 语法结构

| 结构 | 写法 | 用途 |
| --- | --- | --- |
| 闭包 | `{: ... :}` | 延迟执行一组命令，减少子命令转义 |
| 立即执行闭包 | `{: /len foo :}()` | 在参数位置计算临时值 |
| 命名闭包 | `/let task {: ... :} | /:task` | 复用脚本片段 |
| 作用域变量 | `/let x 1 | /var x` | 当前脚本/闭包内变量 |
| 行注释 | `// ...` 或 `/# ...` | 注释脚本，不中断 pipe |
| 块注释 | `/* ... *|` | 暂存/版本相关能力，使用前确认版本 |

常用解析器标志：

| 标志 | 用途 |
| --- | --- |
| `STRICT_ESCAPING` | 让管道、反斜杠、引用值转义更可预测 |
| `REPLACE_GETVAR` | 避免变量值里的宏文本被二次替换 |

## 3.1 自动补全

STscript 当前在聊天输入框和大型 Quick Reply 编辑器中支持自动补全。补全可在多段 pipe 和嵌套闭包里工作，并支持 Starts with、Includes、Fuzzy 三种匹配方式。

- 必填参数会自动提示；选填参数可用 `Ctrl+Space` 打开候选。
- 输入 `/:` 时会提示作用域变量和 Quick Reply。
- 输入 `{{` 时可提示可用宏。
- 自动补全是 UI 编辑辅助，不代表目标 SillyTavern 版本一定支持同名命令；跨版本骨架仍以知识库副作用和稳定性说明为准。

## 4. Quick Reply 联动

Quick Reply 的 `message` 字段可以写 slash/STscript：

```json
{
  "label": "Set Flag",
  "message": "/setvar key=example_flag true | /echo example_flag={{pipe}}"
}
```

对应样例：`examples/stscript/quick-reply-command.json`

Quick Reply 还可以配置自动执行，例如应用启动、用户消息、AI 消息、聊天加载、群组回复等。自动执行脚本必须在按钮标题、文档或注释中标注副作用，尤其是会触发生成、写世界书、删除消息或改全局变量的脚本。

建议使用 STscript 时关闭 Quick Reply 自动注入用户输入，改用 `{{input}}` 显式读取输入框文本。

## 5. 变量作用域

- 本地变量：保存到当前聊天元数据，适合聊天内状态。
- 全局变量：保存到 `settings.json`，可能跨聊天或跨角色，写入前需确认。
- 作用域变量：由 `/let` 和 `/var` 管理，限当前脚本/闭包运行时。

变量名建议使用英文、短横线或下划线，避免与扩展保留名冲突。

变量值可以是 JSON 序列化数组或对象。`/getvar`、`/setvar` 可配合 `index=数字` 或 `index=键名` 访问子值；不存在的变量按数字索引写入时可创建数组，按字符串索引写入时可创建对象。

## 6. 聊天、提示和世界书操作

| 场景 | 命令 | 注意事项 |
| --- | --- | --- |
| 读取聊天 | `/messages names=on|off start-finish` | 隐藏消息会被排除 |
| 添加消息 | `/send`、`/sendas`、`/sys`、`/comment` | 可用 `at` 指定插入位置 |
| 隐藏消息 | `/hide`、`/unhide` | 改变是否进入提示 |
| 删除消息 | `/cut`、`/del`、`/delswipe`、`/delname`、`/delchat` | 破坏性操作，执行前确认 |
| 触发生成 | `/gen`、`/genraw`、`/trigger` | 会请求当前 LLM/API |
| 提示注入 | `/inject`、`/listinjects`、`/flushinjects`、`/note` | 写当前聊天元数据 |
| 世界书 | `/getchatbook`、`/findentry`、`/getentryfield`、`/setentryfield`、`/createentry` | 写入前确认目标文件和 UID |

世界书字段速查：

| 字段 | 类型 |
| --- | --- |
| `content` / `comment` | 字符串 |
| `key` / `keysecondary` | 字符串列表 |
| `constant` / `disable` / `excludeRecursion` / `caseSensitive` / `matchWholeWords` | 布尔值 `1/0` |
| `order` / `probability` / `depth` / `scanDepth` | 数字 |
| `selectiveLogic` | `0=AND ANY`、`1=NOT ALL`、`2=NOT ANY`、`3=AND ALL` |
| `position` | `0=主提示前`、`1=主提示后`、`2/3=作者说明`、`4=聊天深度`、`5/6=示例消息` |
| `role` | 当 `position=4` 时，`0=系统`、`1=用户`、`2=助手` |
| `vectorized` / `automationId` / `triggers` | 向量匹配、自动化 ID、生成类型过滤 |
| `useGroupScoring` / `groupOverride` / `groupWeight` | 分组评分、优先纳入、分组权重 |
| `sticky` / `cooldown` / `delay` | Timed Effects |

## 7. 与 JS-Slash-Runner 边界

| 场景 | 推荐 |
| --- | --- |
| 简短按钮命令 | STscript / Quick Reply |
| DOM 操作、异步请求、复杂状态 | JS-Slash-Runner 或 SillyTavern 原生扩展 |
| 从 JS 触发 slash command | `TavernHelper.triggerSlash` |
| 长逻辑、多分支、错误处理 | JS 脚本 |

## 8. 副作用标注

以下命令需要在文档或按钮标题中标注副作用：

- `/send`：会新增消息。
- `/sys`：会写入系统消息。
- `/setvar`：会修改变量。
- `/setglobalvar`：会修改跨聊天/角色状态。
- `/run` / `/:` / `/trigger`：可能间接触发生成、Regex 或其他脚本。
- `/char-create` / `/char-update` / `/char-delete`：会创建、修改或删除角色数据。
- `/loader-wrap`：会执行闭包，副作用取决于闭包内容。
- `/inject` / `/note`：会影响发送给模型的提示。
- `/setentryfield` / `/createentry`：会写世界书。
- `/qr-create` / `/qr-update` / `/qr-delete`：会写 Quick Reply 配置。
- `/cut` / `/del` / `/delswipe` / `/delname` / `/delchat`：会删除或剪切聊天内容，属于高风险操作。

标注为暂存或版本相关的能力，例如部分闭包管道行为、块注释、`/qr-get`、调试器，不应作为跨版本稳定骨架默认生成。
