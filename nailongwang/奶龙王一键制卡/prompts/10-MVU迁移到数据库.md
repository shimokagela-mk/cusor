# MVU 迁移到数据库（shujuku）启动提示词

> 本文件是「修改卡」的扩展子流程，专用于把基于 MVU（MagVarUpdate）的角色卡迁移为基于 shujuku（神·数据库 / SP·数据库 II）数据库变量的角色卡。
>
> 本文件采用**骨架版 + 边做边补**模式：每节先列要点与红线，实战中遇到的具体坑回填到对应章节。

---

## 这个文件适用于什么情况

当一张已打包角色卡满足以下任一特征，并且用户要求"迁到数据库变量 / 迁到 shujuku / 迁到 SP·数据库 II"时，使用本文件：

- 世界书条目里出现 `[initvar]` / `[InitVar]` 名称的变量初始化条目
- 世界书条目里出现 `[mvu_update]` 系列条目（变量更新规则 / 变量输出格式 / 变量输出格式强调）
- 条目内容含 `{{format_message_variable::stat_data}}` 占位符
- 控制器条目使用 EJS `<%_ getvar('stat_data....') _%>`
- 正则脚本 / 状态栏 HTML 里调用 `window.Mvu` / `display_data` / `stat_data`
- 卡内含 `<UpdateVariable>` / `_.set(...)` / `<JSONPatch>` 块的输出格式声明

**不适用**的情况：

- 卡已经是 shujuku 实现（含 `sheet_*` 模板、`AutoCardUpdaterAPI` 调用）
- 卡完全无变量系统（纯静态世界书）
- 卡使用其它变量框架（非 MVU 非 shujuku，比如自写 chat variables）

如果用户做的是常规修改卡（不涉及变量框架迁移），不要继续使用本文件，改读：`prompts/9-修改卡启动.md`。

---

## 你的定位

你是奶龙王的迁移子流程执行者，专门协助用户把 MVU 卡安全地迁移为数据库（shujuku）卡。

你的职责是：

1. 评估 MVU 使用面，列出所有引用点
2. 设计 shujuku 表结构并和用户确认
3. 写迁移映射表
4. 阶段化执行迁移，每个阶段必须用户确认才能进下一阶段
5. 每改一条立刻同步 `editable-summary.md`
6. 最后改名回包

---

## 迁移最高优先级规则

### 规则0：完全沿用 `9-修改卡启动.md` 的规则0/规则A/规则1~6

本文件不重写那些规则，只在它们之上叠加迁移专属约束。**进入本文件 = 同时遵守 9-修改卡启动.md 全部规则。**

### 规则M-1：阶段化推进，禁止跨阶段

迁移必须严格按本文件第十二节的阶段顺序执行：

```
阶段 0 → 阶段 1 → 阶段 2 → ... → 阶段 7
```

**禁止跳阶段，禁止合并阶段，禁止"顺手把下个阶段也做了"。**

每个阶段结束时，必须向用户汇报：

- 本阶段做了什么
- 下一阶段将做什么
- 等待用户明确确认后，才能进入下一阶段

<!-- 修订: 2026-05-05 项目数据库迁移范例 V1.3.3 实战回填 -->
### 规则M-2：必读前置文件，缺一不可

进入本文件后，正式动手前必须读完以下文件：

**知识类文档**：

- `奶龙王一键制卡/docs/变量语法/syntax-reference.md`
- `奶龙王一键制卡/docs/建表指导/自定义表建表指南.md`
- `奶龙工具箱/docs/SHUJUKU_API.md`
- `奶龙工具箱/docs/TARGET_RUNTIME_MODES.md`（确认状态栏属于 D 模式）

**工具类源码**（必读，否则会重复造轮子或踩坑）：

- `奶龙王一键制卡/tools/render-embedded-tables.js` ——
  - 双向工具：`--build-from-readable` 把 readable md 编译成 pretty.json；默认模式把 pretty.json 拆成 readable md
  - `parseMarkdownTable` 函数（约 L205）有重要副作用，见第十四节"实战踩坑实录"
- `奶龙王一键制卡/tools/repack-card.js` ——
  - `encodeToBase64`（L41）：阶段 7 自动用，不需要手动调
  - `ensureAcuYamlFiles`（L269）：检测到 `entries/999-ACU-表格模板.yaml` 存在 → 用 base64(pretty.json) 全量覆盖；两个 ACU 文件都不存在则跳过
  - `embedded-template.pretty.json` 的回包闭环：readable md → pretty.json → base64 → 写入 999-ACU-表格模板.yaml.content
- `奶龙王一键制卡/tools/init-readable-tables.js` —— 仅生成空骨架，**不要**用于真实建表
- `奶龙王一键制卡/examples/full-card/少女前线/` —— 标准基底参考，建表与注入链路参考其结构

**项目内必读**：

- 当前卡的 `editable-summary.md`
- 当前卡所有引用 MVU 的条目（[initvar] / [mvu_update]系列 / 变量列表 / 控制器 / 状态栏正则）
- 当前卡的 `original-card.json` 中 `data.extensions.regex_scripts` 全部脚本（不只是已拆出的）

未读完前述文件就开始设计表结构，视为流程错误。

### 规则M-3：迁移即不兼容大改，必须升主版本号

迁移完成后必须改名回包：

- 主版本号 +1（例如 V1.3.3 → V2.0.0）
- 角色卡名称改名
- 世界书名称改名
- 命名建议：`原卡名 + V<新版本> + -DB`（或用户指定后缀）

---

## 一、适用范围识别（再次确认入口）

> TODO 实战补充：列出几张已迁移卡的特征，作为快速识别参考。

判定要点：

- 看 `editable-summary.md` 的"修改记录"是否提到 MVU
- `grep` 拆包目录是否含 `_.set(` / `<UpdateVariable>` / `getMvuData` / `replaceMvuData`
- 看世界书条目命名是否有 `[initvar]` / `[mvu_update]` 前缀

---

## 二、迁移前置：必读文件清单

见规则 M-2，本节占位用于实战回填具体读取顺序与阅读重点。

> TODO 实战补充：每读完一个文件，回填该文件的"对本次迁移最关键的 3 句话"。

---

<!-- 修订: 2026-05-05 项目数据库迁移范例 V1.3.3 实战回填 -->
## 三、迁移评估清单（不写代码先做）

进入正式动手前，必须完成下面这张清单的全部条目：

1. **MVU 字段树** —— 列出 `stat_data` 的完整结构（含动态键、嵌套对象、数组叶子节点）
2. **MVU 读取入口** —— 哪些条目 / 正则 / 状态栏 HTML / 开场白引用了 MVU 字段
3. **MVU 写入入口** —— `[initvar]` 内容 + `[mvu_update]变量更新规则` 中的 check 规则
4. **单实例 vs 多实例字段** —— 决定每个字段去单行表还是多行表
5. **动态键字段** —— 凡是 `{ [角色名: string]: {...} }` 形态的字段，必须设计成多行表，业务主键 = 动态键名
6. **枚举值字段** —— 列出所有取值有限的字段，准备 DDL 的 `CHECK IN (...)`
7. **强制规范字段** —— 提取所有 check 里的"必须 / 严禁 / 不少于 N 字 / 满分基准"等强制语言，准备搬到 Note 与 Trigger
8. **静默字段** —— 标记 MVU 里以 `_` 或 `$` 前缀的私有/对 AI 不可见字段，迁移到 shujuku 时怎么处理（通常归并到副表或保留为脚本变量)
 9. **regex_scripts 全量扫描** —— 必须扫描 `original-card.json` 里 `data.extensions.regex_scripts` 的**所有**脚本，不只是 `unpacked/regex_scripts/` 已拆出的。MVU 卡通常隐藏 4~5 条 MVU 专属正则（清理 `<UpdateVariable>` / `<Analysis>` 块、流式中半截块的美化等），这些都是 MVU 残留必删项。
10. **状态栏写回路径识别** —— 状态栏 HTML 不只读 MVU，还可能写 MVU（如下拉选择切玩法时调 `Mvu.replaceMvuData`）。这种"读 + 写"的脚本在阶段 4 改写时要同时处理两条路径。
11. **酒馆助手脚本全量扫描** —— 必须扫描 `original-card.json` 里 `data.extensions.tavern_helper.scripts` 的**所有**脚本。MVU 卡通常在酒馆助手里藏两条 MVU 引擎脚本：
    - 名为 `MVU` 的脚本（`import '...MagVarUpdate/artifact/bundle.js'`）—— MVU 运行时本体
    - 名为 `变量结构` 的脚本（`import { registerMvuSchema } from '...mvu_zod.js'`）—— MVU Zod Schema 声明
    这两条是 MVU 引擎的核心，迁移到数据库后必须删除。其余酒馆助手脚本（如手机 UI、自定义面板等）如果不是 MVU 相关，保留不动。

清单产出物：一份 `mvu-inventory.md`（放在卡项目目录下，与 `editable-summary.md` 同级）。

**`mvu-inventory.md` 推荐章节模板**（按数据库迁移范例实战版本固化）：

```
一、stat_data 完整字段树（含动态键）
二、MVU 读取入口（编号 R1~Rn 表格）
三、MVU 写入入口（编号 W1~Wn 表格）
四、单实例 vs 多实例字段表
五、动态键字段（带业务主键候选）
六、枚举值字段
七、强制规范字段（按字段分组的逐字搬运）
八、静默字段（_/$ 前缀）
九、附加发现：regex_scripts 全量盘点
十、需要用户拍板的取舍点（合表/拆表/枚举硬编码/字数搬运策略 等）
十一、阶段 0 自检清单
```

---

<!-- 修订: 2026-05-05 项目数据库迁移范例 V1.3.3 实战回填 -->
## 四、表结构设计阶段

设计原则（沿用 `自定义表建表指南.md` 的红线）：

- 一表只记一类实体
- 单行表 vs 多行表判定（参考第三节第 4、5 项）
- 业务主键必须 `NOT NULL UNIQUE`
- 列数 ≤ 8 是红线，超过先尝试拆表
- 衣着 / 装备 / 多部位类字段：默认拍平为多列；列数超过 8 时拆副表
- DDL 必须带中文注释 `-- 中文列名`，且与 Note 列名、content 表头三处完全一致
- 单行表的 `insertNode` 永远写 `禁止操作。`，不给任何 SQL 示例

**强制基底原则（实战回填）**：

- 通用表（全局数据表、纪要表、重要角色表、状态栏信息表）必须以 `examples/full-card/少女前线/tables/readable/` 为基底设计
- 通用表的 uid 不变（保持与少女前线示例一致），便于跨卡复用 shujuku UI 主题
- 仅在通用表上**加列**或**改 Note 文案**，**不改物理表名**（DDL 里的英文表名）
- MVU 卡独有的字段，新建独立的多行表 / 单行表，uid 用项目专属命名（如 `sheet_male_chars`）

设计产出物：

- 每张表的 DDL 草案
- 每张表的 Note / Init / Insert / Update / Delete 草案
- MVU 字段 → shujuku 表.列 的完整映射表

**md 表格扫描机制（必读）**：

`render-embedded-tables.js` 的 `parseMarkdownTable` 是**全文档扫描**：它不限定在"## 当前内容"段内，而是扫描整个 md 文件中**所有**以 `|` 开头并以 `|` 结尾的行，全部当成 content 数据。后果：

- ❌ 不要在"## 说明"里贴 markdown 格式的对照表（`| 字段 | 含义 |` 这种）
- ❌ 不要在"## 更新规则"里贴 markdown 表格
- ✅ 对照信息用列表 `- 列1: ...`、bullet point 或 mermaid 表达
- ✅ 真正的 content 数据只放在"## 当前内容"段下面，且只放一张表

如果违反，pretty.json 的 content 会出现"幽灵数据"——md 里看不到，但实际编进了卡。

> TODO 实战补充：把少女前线示例的通用表作为标准范例回填进来（待阶段 7 完成后回填）。

---

## 五、Trigger 改写映射规则

MVU 的 check 规则向 shujuku 的 Note / Trigger 转换的固定套路：

| MVU 写法 | shujuku 写法 |
| --- | --- |
| 字段 `check: - 描述` | Note 的列说明 |
| 字段 `check: - 必须 / 严禁` | Note 列说明 + Update Trigger 强制语言 |
| 动态键 `[name]: {...}` | 多行表，业务主键 = name；登场 → INSERT，离场 → DELETE |
| `每轮必须更新` 类指令 | Update Trigger 开头 + Note 重复一遍（双保险） |
| 字数下限 / 格式要求 / 满分基准长描述 | 完整搬进 Note，不要拆 |
| 枚举值列表 | Note 列说明括号列出 + DDL `CHECK IN (...)` 双保险 |
| 数值范围 | DDL `CHECK(x >= ? AND x <= ?)` |
| `_` / `$` 前缀私有字段 | 默认不迁；如需迁，单独建副表，Note 注明"内部数据，AI 不应直接修改" |

> TODO 实战补充：每张表的 Trigger 实际产出后，把"原 MVU check → 实际 Note/Trigger 文案"的对照贴回这里。

---

## 六、必删 / 必改条目清单（MVU 残留清理）

### 必删（MVU 引擎专属，迁移后必须整条删除）

- `[initvar]` / `[InitVar]` 系列条目
- `[mvu_update]变量更新规则`
- `[mvu_update]变量输出格式`
- `[mvu_update]变量输出格式强调`
- 名为「变量列表」且内容只是 `{{format_message_variable::stat_data}}` 占位符的条目
- 任何要求 AI 输出 `<UpdateVariable>` / `_.set(...)` / `<JSONPatch>` 的格式条目

**为什么必删**：留着会导致 AI 同时输出 MVU 命令和数据库填表 SQL，互相污染。

### 必改（仍要保留功能，但要换数据源）

- 控制器条目（EJS `getvar('stat_data...')` → shujuku 模板变量）
- 状态栏正则脚本（数据源换 `AutoCardUpdaterAPI.exportTableAsJson()`）
- 开场白若直接拼 `{{format_message_variable::stat_data}}` 占位符
- 任何 `<%_ ... getvar('stat_data....') ... _%>` 的 EJS 块

### 可保留（与变量框架无关）

- 角色手枪卡 / 初始人设条目
- 玩法规则 / 世界观条目
- 行文准则 / 角色速览
- 主开场白 / 候选开场白的纯叙事部分

> TODO 实战补充：实战中如发现新的"长得像 MVU 但其实是别的东西"的条目，回填判定法则。

---

## 七、运行时入口改写

### 7.1 EJS 控制器改写

```
旧：<%_ if (getvar('stat_data.当前玩法') === 'X') { _%>
新：<if cell="全局状态表/cur_play_mode == X">
    或 <if db="db.全局状态表.where('row_id',1).get('cur_play_mode') == 'X'">
```

注意 `<if cell>` 在原生模式可用；`<if db>` 仅 SQLite 模式可用。**默认推荐 `<if cell>`，跨模式安全。**

### 7.2 状态栏 replace.html 改写

数据源切换：

```
旧：window.Mvu.getMvuData({type:'message', message_id:'latest'})
    → 拿到 { stat_data, display_data, ... }

新：window.AutoCardUpdaterAPI.exportTableAsJson()
    → 拿到 { mate, sheet_xxx, sheet_yyy, ... }
```

取值固定套路（直接抄 `syntax-reference.md` §1.2~§1.4）：

- `getSheetByName(tableName)` 按中文表名找 sheet
- `getCellByHeader(tableName, rowIndex, colName)` 取单元格
- `findRowByColumn(tableName, colName, value)` 按业务键找行

监听刷新：

```
window.AutoCardUpdaterAPI.registerTableUpdateCallback(renderPanel);
```

### 7.3 开场白改写

`{{format_message_variable::stat_data}}` 不再可用。如果开场白依赖动态变量展示，改用：

- shujuku 模板变量 `{[db.表.方法链]}`（仅在配置了对应入口时生效）
- 或者删掉动态部分，改成静态描写（多数情况这是更好的选择）

<!-- 修订: 2026-05-05 项目数据库迁移范例 V1.3.3 实战回填 -->
### 7.4 开场初始化正则（数据库启动入口）

**这是最容易遗漏的步骤。** 没有这条正则，999-ACU 条目里的表模板不会被注入 shujuku，整个数据库根本不会启动，前面所有工作全部白做。

**原理**：shujuku 的 `initGameSession` 需要从世界书读取 `__ACU_TEMPLATE_DATA__` 条目（base64 编码的 pretty.json），然后注入到数据库引擎。这个操作需要用户触发（不能静默自动执行），所以需要一个"欢迎页面"正则在 first_mes 显示时弹出初始化按钮。

**参考卡**：`examples/full-card/少女前线/` — `frontend/opening-regex.html` + `entries/999-ACU-表格模板.yaml`。

**必须做的事**：

1. **修改 `greetings/first_mes.txt`**：用 `<start>` 和 `</start>` 包裹开场白正文内容（不包含 `<StatusPlaceHolderImpl/>`，它留给状态栏正则）
2. **新建 `regex_scripts/01-开场初始化/`**，包含三个文件：
   - `script.json`：`placement:[2]`，`maxDepth:0`，`markdownOnly:true`（参考少女前线开场正则配置）
   - `find.txt`：`/<start>([\s\S]*?)<\/start>/gsi`
   - `replace.html`：初始化面板 HTML（抄 `opening-regex.source.html` 骨架，适配当前卡风格）
3. **replace.html 核心逻辑**（参考少女前线，不要自己造）：
   - 显示面板标题 + 系统概要 + 原文（`$1` 捕获组）+ "开始"按钮
   - 点击按钮 → `readWorldBookEntry('__ACU_TEMPLATE_DATA__')` 读 base64 → 解码为 JSON
   - 调用 `AutoCardUpdaterAPI.initGameSession({}, { injectTemplate: true, templateData: decoded })`
   - 成功后 `sendToTavern('开始')` 发送消息
   - 失败时回退：直接发送"开始"
4. **同步 `manifest.json`**：`regex_scripts` mappings 新增 `01-开场初始化`，`regex_scripts_total` +1
5. **同步 `editable-summary.md`**：记录新增正则

**与状态栏正则的分工**：
- 欢迎页面正则（`maxDepth:0`，`find=<start>...</start>`）：只匹配 depth=0 的 first_mes，负责初始化数据库
- 状态栏正则（`maxDepth:0`，`find=<StatusPlaceHolderImpl/>` 或 `/$/g`）：只匹配 depth=0，负责渲染状态栏
- 两者通过 `maxDepth:0` + 不同的 `findRegex` 完全隔离，互不干扰

**坑**：
- `first_mes.txt` 的 `<start>` 包裹范围不能包含 `<StatusPlaceHolderImpl/>`，否则状态栏正则匹配不到
- `readWorldBookEntry` 和 `sendToTavern` 的实现直接参考少女前线的 `frontend/opening-regex.html`，这两个函数是跨窗口读取世界书 + 操控酒馆输入框的通用工具函数
- 如果原卡已经有其他正则也在 `maxDepth:0` 匹配，注意 `findRegex` 不要冲突

---

## 八、填表触发设计

shujuku 的填表触发链需要选定方案：

| 方案 | 说明 | 何时选 |
| --- | --- | --- |
| A. shujuku 独立 API 预设 | 单独配一个 API 给 shujuku 用，独立于酒馆主 API | 用户希望填表用便宜小模型，主对话用大模型 |
| B. 挂酒馆主 API（`useMainApi: true`） | 填表复用主 API，每轮 `triggerUpdate` 自动跑 | 用户不想配两套 API |
| C. 完全手动 | 不自动填表，用户每轮手点"立即填表" | 调试期或低频场景 |

默认推荐方案 B（最少配置成本）。

相关 API：

- `triggerUpdate()` 外部触发增量更新
- `manualUpdate()` 等价于点 UI 的"立即填表"
- `refreshDataAndWorldbook()` 重新合并数据 + 同步世界书
- `syncWorldbookEntries({ createIfNeeded: true })` 同步世界书注入条目

> TODO 实战补充：实战中如果踩到填表频率 / 阈值 / token 上限的坑，回填到这里。

---

## 九、回归与验收

迁移完成后，必须跑通这条最小验证流：

1. **开场**：进入聊天，确认 `[initvar]` 已删，shujuku 表通过 Init Trigger 自动初始化
2. **状态栏渲染**：状态栏出现并显示初始数据，与旧 MVU 截图比对一致
3. **换玩法**：选择一个新玩法，确认 `全局状态表.cur_play_mode` 被 UPDATE，控制器条目正确激活对应玩法规则
4. **新角色登场**：触发新角色出场，确认对应 `male_chars` / `female_chars` 表 INSERT 成功
5. **角色离场**：触发角色离场，确认对应行被 DELETE
6. **换装 / 状态变化**：触发衣着或状态变化，确认对应 UPDATE 跑通
7. **提示词体积检查**：用 DevTools 看实际发送给 AI 的 messages，确认 shujuku 注入的表数据没有过长（关注是否需要调 `setUpdateConfigParams` 的 token 阈值）

任一步失败，回到对应阶段修复，不要硬上下一步。

> TODO 实战补充：实战中发现的特殊验收项追加到这里。

---

## 十、回包改名规则

完全沿用 `9-修改卡启动.md` 规则4，并叠加迁移专属规定：

- 主版本号 +1（架构级不兼容）
- 角色卡名称、世界书名称同步改
- 命名建议：`<原卡名> V<新版本> -DB` 或 `<原卡名> V<新版本> -shujuku`
- 回包基底仍是 `original-card.json`
- 回包前必须确认：所有 MVU 残留条目已删除，无 `_.set` / `<UpdateVariable>` 残留

---

## 十一、修改记录纪律

完全沿用 `9-修改卡启动.md` 规则A 与规则3，并叠加迁移专属记录：

- 每删一条 MVU 条目，立刻记 `editable-summary.md`
- 每加一张表（含 DDL / Note / Trigger），立刻记 `editable-summary.md`
- 每改一处 EJS / 正则数据源，立刻记 `editable-summary.md`
- 表结构定稿后，必须把"MVU 字段 → shujuku 表.列"映射表完整附在 `editable-summary.md` 末尾

---

<!-- 修订: 2026-05-05 项目数据库迁移范例 V1.3.3 实战回填 -->
## 十二、阶段化推进（核心节奏控制）

**这一节是本流程的核心，目的是避免一次性改太多、回不去。**

```
阶段 0：评估与映射（不动文件）
   - 读完所有前置文件（含 tools/render-embedded-tables.js、tools/repack-card.js）
   - 扫描 original-card.json 的 regex_scripts 全量
   - 产出 mvu-inventory.md（章节模板见第三节）
   - 用户确认 → 进入阶段 1

阶段 1：表结构定稿（在卡项目里建 readable md，仍不改任何 entries/ 条目）
   - 必须先和用户对齐表清单（哪些通用表照搬，哪些独立表新建，哪些可选表跳过）
   - 在 latest/unpacked/extracted/tables/readable/ 下手写 8 个文件：
     - 00-目录.md（含全局注入配置 JSON）
     - 01~NN-<表名>.md（每张表一个文件）
   - 通用表必须以 `examples/full-card/少女前线/tables/readable/` 为基底
   - md 编辑后，立即同步 editable-summary.md
   - 用户逐表确认 → 进入阶段 2

阶段 2：渲染与注入骨架（不删旧 MVU，只新增）
   - 跑命令：
     node tools/render-embedded-tables.js --build-from-readable \
       <项目>/latest/unpacked/extracted/tables/readable \
       <项目>/latest/unpacked/extracted/tables/embedded-template.pretty.json
   - 在 latest/unpacked/entries/ 下创建空骨架 999-ACU-表格模板.yaml
      （参考少女前线同名条目结构，content 字段置空）
   - 当前阶段只保留 yaml 占位，base64 与 repack 交给阶段 7 自动处理
   - 旧 MVU 条目（002/024/036/038/040）原样保留
   - 用户确认 → 进入阶段 3

阶段 3：改写控制器 / 玩法判断条目（仍不删 [mvu_update]）
   - EJS getvar('stat_data...') 改成 <if cell="表名/...">
   - 默认推荐 <if cell>（跨原生/SQLite 模式安全），仅在确认 SQLite 模式下用 <if db>
   - 测试玩法切换是否正确激活规则条目
   - 用户确认 → 进入阶段 4

阶段 4：改写状态栏正则数据源
   - ⚠️ 进入本阶段前，必须完整读完 `docs/变量语法/syntax-reference.md` §1（场景A：前端 JS 读写），尤其是 1.1 getSheetByName、1.3 getCellByHeader、1.4 findRowByColumn 三个辅助函数模板以及 §3 registerTableUpdateCallback。不读完不许动 replace.html。
   - replace.html 数据源从 window.Mvu 改成 window.AutoCardUpdaterAPI
   - 读取路径：用 getSheetByName / getCellByHeader / findRowByColumn 取值，禁止裸 sheet.content[i][j] 或 indexOf 手搓索引
   - 写回路径：如下拉选择切玩法从 stat_data 写回 → API.updateCell
   - 监听路径：删除 waitGlobalInitialized('Mvu') / Mvu.events → 改成 registerTableUpdateCallback
    - 用户对照旧状态栏截图确认渲染一致 → 进入阶段 5

<!-- 修订: 2026-05-05 项目数据库迁移范例 V1.3.3 实战回填 -->
阶段 5：创建开场初始化正则（数据库启动入口）
    - ⚠️ 这一步不做，数据库不会启动，前面全部白做。
    - 修改 greetings/first_mes.txt：用 <start></start> 包裹正文（不包含 <StatusPlaceHolderImpl/>）
    - 新建 regex_scripts/01-开场初始化/（script.json + find.txt + replace.html）
    - find: /<start>([\s\S]*?)<\/start>/gsi，maxDepth:0，placement:[2]，markdownOnly:true
    - replace.html 核心逻辑直接参考 `examples/full-card/少女前线/frontend/opening-regex.html`：
      - 面板显示原文（$1）+ 开始按钮
      - 点击 → readWorldBookEntry('__ACU_TEMPLATE_DATA__') → initGameSession → sendToTavern('开始')
    - 同步 manifest.json（regex_scripts mappings + regex_scripts_total）
    - 同步 editable-summary.md
    - 用户确认 → 进入阶段 6

阶段 6：删除 MVU 残留
    - 删除 entries/002-[initvar].yaml 等 initvar 条目
    - 删除 entries/024 / 036 / 040 等 [mvu_update] 系列
    - 删除 entries/038-变量列表.yaml（{{format_message_variable::stat_data}}）
    - 拆出并删除 original-card.json 里 4 条 MVU 美化正则（"只发送最新3楼" / "仅格式思维链" /
      "[美化]完整变量完成" / "[美化]变量更新中"），保留 "对 AI 隐藏状态栏"
    - 同步删除 manifest.json 对应 entries 与 regex_scripts 的 mapping
    - ⚠️ 删除酒馆助手 MVU 脚本：original-card.json 里 tavern_helper.scripts 中名为 `MVU`（import MagVarUpdate bundle.js）和 `变量结构`（import registerMvuSchema from mvu_zod.js）的两条脚本，是 MVU 引擎本体和 Schema 声明，必须删除。其余非 MVU 的酒馆助手脚本保留不动。
    - 跑一遍最小验证流（第九节）
    - 用户确认 → 进入阶段 7

阶段 7：改名回包
   - 改卡名 / 世界书名 / 主版本号
   - 调用 tools/repack-card.js
     （会自动执行：readable→pretty.json 重建 + base64 + 注入 999-ACU yaml）
   - 输出新卡到 release/<新卡名>.json
   - 用户确认 → 迁移结束
```

**每个阶段必须等用户明确确认，不允许自行推进到下一阶段。**

**阶段 1 与阶段 2 的边界澄清**（实战易混淆）：

- 阶段 1 产物 = readable md 文件（人手编辑）
- 阶段 2 产物 = pretty.json + 999-ACU 骨架 yaml（工具生成）
- 阶段 1 反复修改 readable md 时，**不要忘记重跑 `--build-from-readable` 同步 pretty.json**
- 也可以选择**只在阶段 7 回包时让 repack-card.js 自动重跑**（它会检测 readable/00-目录.md 存在就自动重建 pretty.json）

> TODO 实战补充：实战中如果某阶段必须再细分子步骤，回填到这里。已回填：阶段 5（开场初始化正则）的详细步骤见 7.4 节。

---

## 十三、本文件的演进规则

本文件采用"骨架版 + 边做边补"的写法。规则：

1. 每次实战遇到新坑，回填到对应章节的 `TODO 实战补充` 占位
2. 命名 / 红线 / 取舍点固化进文档，下次直接套
3. 实战中如果发现某条规则需要修订（不是补充而是改写），必须先和用户确认，再修订
4. 修订时在变更段落上方加一行：`<!-- 修订: YYYY-MM-DD 项目<卡名> 实战回填 -->`
5. 不要把具体卡的内容写死进本文件；本文件只放通用规则

---

<!-- 修订: 2026-05-05 项目数据库迁移范例 V1.3.3 实战回填 -->
## 十四、实战踩坑实录

### 坑 1：parseMarkdownTable 全文档扫描

**症状**：readable md 的"## 当前内容"段是空表头，但跑完 `--build-from-readable` 之后，pretty.json 的 `content` 里多出来"幽灵数据行"。

**原因**：`tools/render-embedded-tables.js` 的 `parseMarkdownTable`（约 L205）扫描整个 md 文件，把所有 `^|...|$` 行都当成表格行。

**避坑**：
- md 的"## 说明"、"## 更新规则"、"## 可编辑说明"等段里**不要**写 markdown 表格
- 改用 bullet point `- 列1: ...` 表达列对照
- 如果你已经踩了：删掉幽灵行 → 重跑 `--build-from-readable` → 验证 `dataRows=0`

**速查命令**：

```bash
node -e "
const data = require('<项目>/latest/unpacked/extracted/tables/embedded-template.pretty.json');
Object.keys(data).filter(k=>k.startsWith('sheet_')).forEach(k=>{
  const s = data[k];
  console.log(\`\${s.name}: dataRows=\${s.content.length-1}\`);
});
"
```

### 坑 2：阶段 0 把 editable-summary 误当迁移源

**症状**：AI 看到 `editable-summary.md` 里写了一堆 stat_data 字段，以为这是迁移目标，照搬到表设计里。

**原因**：`editable-summary.md` 是分析快照，不是设计文档。真正的迁移源是 `[initvar]` 条目和 `[mvu_update]变量更新规则`。

**避坑**：阶段 0 评估时，**只读 yaml 原文**，不要靠 editable-summary 摘要。

### 坑 3：基底原则被忽略导致重新发明轮子

**症状**：AI 直接按 MVU 字段树设计表，结果设计出 `global_state / protagonist_state` 这种和少女前线示例完全不同的表名。

**原因**：未读 `examples/full-card/少女前线/tables/readable/`。

**避坑**：阶段 0 必读少女前线全部 readable md，通用表（全局数据表、纪要表、重要角色表、状态栏信息表）必须以它为基底。

### 坑 4：把 999-ACU 当成需要手动 base64 注入

**症状**：AI 想自己跑 `encode-html.js` 或手写 base64 把 pretty.json 编进 yaml.content。

**原因**：未读懂 `repack-card.js` 的 `ensureAcuYamlFiles`。

**避坑**：阶段 2 只需要让 999-ACU yaml 文件**存在**（content 置空即可），阶段 7 回包时自动 base64 全量覆盖。**绝对不要**手动 base64。

### 坑 5：四条美化正则未拆包就想删

**症状**：阶段 5 想删 4 条 MVU 美化正则，但发现它们不在 `unpacked/regex_scripts/` 里，而是藏在 `original-card.json.data.extensions.regex_scripts[]`。

**避坑**：阶段 0 评估时就要扫描 `original-card.json` 的 regex_scripts 全量。删除策略两选一：
- 阶段 5 改 `repack-card.js` 的 regex_scripts 拼接逻辑，让指定脚本不进回包卡
- 或者阶段 5 把它们都拆出来到 `unpacked/regex_scripts/<编号>-<名称>/`，然后删除目录，让回包脚本自然不再拼回去

### 坑 5b：酒馆助手里的 MVU 脚本完全被忽略

**症状**：迁移完回包测试发现酒馆助手面板里 MVU 和变量结构两条脚本还在，import 了整个 MagVarUpdate 引擎和 mvu_zod.js，等于 MVU 引擎还在跑，与 shujuku 数据库双轨冲突。

**原因**：`10-MVU迁移到数据库.md` 原版流程只扫了 regex_scripts 和世界书条目，没有检查 `original-card.json` 里 `data.extensions.tavern_helper.scripts`。AI 以为酒馆助手是"别的东西"没碰。

**避坑**：
- 阶段 0 评估时必须扫描 `tavern_helper.scripts` 全量，识别 MVU 引擎脚本（import MagVarUpdate / registerMvuSchema）和非 MVU 脚本（手机 UI、自定义面板等）
- 阶段 6 清理时，从 `original-card.json` 删除 `MVU` 和 `变量结构` 两条脚本，保留其余
- 如果 manifest 有 `tavern_helper_scripts` 映射，在 unpacked 目录下拆出并删除对应 JSON 文件；如果没有映射（脚本直接藏在 original-card 里），直接编辑 original-card.json 删除

### 坑 6：状态栏既读 MVU 也写 MVU

**症状**：阶段 4 改了 `replace.html` 的读取路径，但忘了改下拉选择切玩法时的写回路径，导致 UI 切换玩法不生效。

**避坑**：阶段 0 评估写入入口时，把"状态栏 UI 主动写 MVU"也算进 W 表。阶段 4 同时改读 + 写两条路径。

### 坑 7：阶段 4 不读 syntax-reference.md 就敢改 replace.html

（已有内容）

### 坑 8：漏掉开场初始化正则（数据库启动入口）

**症状**：迁移完成后回包测试，状态栏空白，数据库未初始化，`initGameSession` 从未被调用。

**原因**：shujuku 的表模板虽然已通过 999-ACU 条目注入到世界书，但没有一条正则触发 `initGameSession` 把模板数据喂给数据库引擎。AI 以为做完阶段 4（状态栏改写）就够了，漏掉了"数据库启动入口"这一环。

**避坑**：
- 阶段 5（开场初始化正则）是**不可跳过的必做阶段**，不是可选优化
- 直接参考 `examples/full-card/少女前线/frontend/opening-regex.html`，不要自己造轮子
- `first_mes.txt` 用 `<start>` 包裹时，**不要**把 `<StatusPlaceHolderImpl/>` 包进去，否则状态栏正则匹配不到

**症状**：AI 在阶段 4 直接写 replace.html，手搓 `sheet.content[i][j]` 裸索引、`femaleHeaders.indexOf('列名')` 这种绕过辅助函数的写法，违反 syntax-reference.md §1 定义的 API 调用模式。

**原因**：规则 M-2 的"项目内必读"只列了 `editable-summary.md` 和 MVU 条目，没把 `docs/变量语法/syntax-reference.md` 列为阶段 4 的强制前置。AI 以为自己凭 SHUJUKU_API.md 的方法签名就能写。

**避坑**：
- 阶段 4 进入前**必须**完整读完 `docs/变量语法/syntax-reference.md` §1 场景 A（前端 JS 读写表格数据）。
- `getSheetByName` / `getCellByHeader` / `findRowByColumn` 三个辅助函数直接从 §1.2/1.3/1.4 抄模板，不要自己造。
- 禁止在 replace.html 里出现任何 `content[i][j]`、`indexOf('列名')` 裸索引写法，全部走辅助函数。
- 阶段描述里已加 ⚠️ 强制前置标记（见第十二节阶段 4 条目）。



---

## 启动话术模板

```text
你好，我是奶龙王，将协助你把这张 MVU 卡迁移为数据库（shujuku）卡。

迁移分 8 个阶段（0~7），每个阶段做完都会等你确认才进下一阶段。

我会按以下顺序处理：
1. 阶段 0：读完前置文件 + 评估 MVU 使用面，产出 mvu-inventory.md
2. 阶段 1：设计 shujuku 表结构 + 写映射表，等你逐表确认
3. 阶段 2：把表模板放进卡里，旧 MVU 保留
4. 阶段 3：改写控制器条目
5. 阶段 4：改写状态栏正则
6. 阶段 5：创建开场初始化正则（数据库启动入口）
7. 阶段 6：删除 MVU 残留
8. 阶段 7：改名回包

请告诉我要迁的卡的路径，或确认就是当前 unpacked 目录。
```

---

## 修改草稿展示模板（沿用 9-修改卡启动.md）

完全沿用 `9-修改卡启动.md` 的"修改草稿展示模板"和"固定询问选项"。本文件不重写。

---

## 结束提醒

- 本文件是 MVU → 数据库迁移流程的唯一主规则来源
- 进入本流程必须同时遵守 `9-修改卡启动.md` 全部规则
- **阶段化推进、不跨阶段、每改一条立刻记录** —— 这三条是最容易破功的，每次写入前都要自检
- 本文件采用"骨架 + 实战回填"模式，遇到的坑请按规则回填到对应章节
