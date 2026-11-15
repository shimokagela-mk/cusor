# 表格模板格式规范

## 概述

表格模板用于定义数据库表格的结构和行为，包括：
- 表格列定义
- AI操作指令
- 更新配置（控制上下文深度、分组与并发填表）
- 导出配置（控制世界书条目生成）

### 职责边界（强制规则）

- 数据表负责记录、约束和更新变量。
- 世界书负责读取变量、做条件判断、输出表现与叙事指令。
- 具体变量更新规则必须只写在数据表的 `sourceData.note` / 可编辑 md 的 `## 说明` 中。
- 世界书条目与事件条目不得重复定义变量的具体数值涨跌幅。
- 若某个规则属于“变量怎么变”，就必须写进表说明；若属于“变量达到什么条件时触发什么表现”，才写进世界书条目。
- 写变量规则时，优先写清字段应该怎么写，以及字段应该怎么变：字段职责、字段格式、来源归属、计量口径、总累计还是当前值、变化规则、必要边界。
- 变量变化规则必须可执行、可判定；不能只写抽象因果关系，必须让 AI 看完后知道什么情况下记小幅变化、明显变化、重大变化。
- 规则提供稳定边界与必要口径即可；大量补丁限制、过细 case 或替 AI 做完全部判断的脚本会降低模板稳定性。
- 表格中的 `sourceData.note` / `## 说明` 与 `sourceData.*Node` / `## 更新规则` 必须严格分工。
- `## 说明` 负责字段定义与变量规则；只要这张表负责某个变量，就必须在 `## 说明` 中写清该变量如何变化。`## 更新规则` 只负责最小操作语义：初始化、更新、插入、删除。
- 如果某条内容放在 `## 更新规则` 中，只是在重复 `## 说明` 已经承担的内容，就应该移回 `## 说明` 或直接删除。

---

## 必需表格

### 1. 纪要表（必须存在且格式固定）

**UID**: `sheet_3NoMc1wI`

```json
{
  "sheet_3NoMc1wI": {
    "uid": "sheet_3NoMc1wI",
    "name": "纪要表",
    "sourceData": {
      "note": "轮次日志，每轮交互后必须立即插入一条新记录。",
      "initNode": "故事初始化时，插入一条新记录用于记录初始化剧情。",
      "deleteNode": "禁止删除。",
      "updateNode": "禁止操作。",
      "insertNode": "每轮交互结束后插入一条新记录。"
    },
    "content": [
      [null, "时间跨度", "地点", "纪要", "概览", "编码索引"]
    ],
    "exportConfig": {
      "enabled": true,
      "splitByRow": true,
      "entryName": "纪要",
      "entryType": "keyword",
      "keywords": "编码索引",
      "preventRecursion": true,
      "injectionTemplate": "<记忆回溯>\n$1\n</记忆回溯>",
      "extraIndexEnabled": true,
      "extraIndexColumns": ["概览", "编码索引"],
      "extraIndexInjectionTemplate": "<已发生的事件概览>\n$1\n</已发生的事件概览>"
    }
  }
}
```

**关键配置**：
- `exportConfig.enabled: true` - 生成世界书条目
- `exportConfig.splitByRow: true` - 每行一个条目
- `exportConfig.entryType: "keyword"` - 关键词触发
- `exportConfig.keywords: "编码索引"` - 触发列
- `exportConfig.extraIndexEnabled: true` - 生成索引条目

### 2. 重要角色表（必须存在且有关键配置）

**UID**: `sheet_NcBlYRH5`

```json
{
  "sheet_NcBlYRH5": {
    "uid": "sheet_NcBlYRH5",
    "name": "重要角色表",
    "sourceData": { ... },
    "content": [
      [null, "姓名", "一句话介绍", "外貌特征", "当前状态", ...]
    ],
    "exportConfig": {
      "enabled": true,
      "splitByRow": true,
      "entryName": "重要人物表",
      "entryType": "keyword",
      "keywords": "姓名",
      "preventRecursion": true,
      "extraIndexEnabled": true,
      "extraIndexColumns": ["姓名", "一句话介绍"],
      "extraIndexInjectionTemplate": "以下为已经登场过的角色：\n<已登场角色>\n$1\n</已登场角色>"
    }
  }
}
```

**关键配置**：
- 必须包含 `姓名` 和 `一句话介绍` 列
- `exportConfig.extraIndexColumns` 必须包含这两列
- `exportConfig.keywords: "姓名"` - 使用姓名列作为触发关键词

---

## 表格格式结构

### 完整格式

```json
{
  "sheet_xxx": {
    "uid": "sheet_xxx",
    "name": "表格名称",
    "sourceData": {
      "note": "表格说明，AI读取此字段理解表格用途",
      "initNode": "初始化时的操作说明",
      "deleteNode": "删除时的操作说明",
      "updateNode": "更新时的操作说明",
      "insertNode": "插入新行时的操作说明"
    },
    "content": [
      [null, "列1", "列2", "列3"],
      [null, "数据1", "数据2", "数据3"]
    ],
    "updateConfig": {
      "uiSentinel": -1,
      "contextDepth": -1,
      "updateFrequency": -1,
      "batchSize": -1,
      "skipFloors": -1
    },
    "exportConfig": {
      "enabled": false,
      "splitByRow": false,
      "entryName": "条目名称",
      "entryType": "constant",
      "keywords": "",
      "preventRecursion": true,
      "injectionTemplate": "",
      "extraIndexEnabled": false,
      "extraIndexEntryName": "索引条目名称",
      "extraIndexColumns": [],
      "extraIndexColumnModes": {},
      "extraIndexInjectionTemplate": "",
      "entryPlacement": { "position": "at_depth_as_system", "depth": 2, "order": 10000 },
      "extraIndexPlacement": { "position": "at_depth_as_system", "depth": 2, "order": 10010 }
    },
    "orderNo": 0
  },
  "mate": {
    "type": "chatSheets",
    "version": 1,
    "updateConfigUiSentinel": -1,
    "globalInjectionConfig": {
      "readableEntryPlacement": { "position": "before_char", "depth": 2, "order": 99981 },
      "wrapperPlacement": { "position": "before_char", "depth": 2, "order": 99980 }
    }
  }
}
```

---

## `-1` 参数的含义（重要补充）

在表格模板的 [`updateConfig`](prompts/templates/table-format-spec.md:112) 中，如果一整串默认参数写成 `-1`，含义统一都是：**当前表不在表级单独覆写，而是使用全局设置**。

常见写法如下：

```json
{
  "uiSentinel": -1,
  "contextDepth": -1,
  "updateFrequency": -1,
  "batchSize": -1,
  "skipFloors": -1
}
```

这表示：
- [`uiSentinel`](prompts/templates/table-format-spec.md:171) 使用全局默认哨兵值
- [`contextDepth`](prompts/templates/table-format-spec.md:174) 使用全局上下文深度
- [`updateFrequency`](prompts/templates/table-format-spec.md:185) 使用全局更新频率
- [`batchSize`](prompts/templates/table-format-spec.md:179) 使用全局批次规模
- [`skipFloors`](prompts/templates/table-format-spec.md:188) 使用全局跳层设置

也就是说，**这一串参数只要写成 `-1`，都应理解为“跟随全局”，而不是“当前表自己定义了一个特殊值”**。

其中需要特别注意：
- [`contextDepth`](prompts/templates/table-format-spec.md:174) 和 [`batchSize`](prompts/templates/table-format-spec.md:179) 不仅是普通参数，还是表格分组依据的一部分
- 如果它们写成 `-1`，就表示**交给全局设置决定最终生效值**，不是手动声明一个新的表级分组
- 只有当这两个参数写成明确数字时，才表示你在当前表上显式控制分组

---

## updateConfig 关键配置说明（新增重点）

数据库插件会以 `updateConfig.contextDepth` 和 `updateConfig.batchSize` 的**组合值**作为分组依据：

- 两个值都相同：这些表会被归为同一组，进入同一批次填表
- 任意一个值不同：这些表会被拆到不同组，可并发填表
- 因此这两个字段不只是普通参数，还是**控制分组策略的核心旋钮**
- 如果某张表把这两个字段写成 `-1`，则应理解为该表先继承全局设置，再按全局解析后的实际值参与分组

### uiSentinel
- UI 侧识别用保留值
- 写成 `-1`：表示使用全局默认哨兵值
- 若项目没有特殊 UI 识别需求，通常保持 `-1` 即可

### contextDepth
- 控制该组表格在更新时参考的上下文楼层
- 值越高，通常说明该组需要更深的上下文参与判断
- **同时也是分组键的一部分**
- 写成 `-1`：表示该表不单独指定上下文深度，改为使用全局设置

### batchSize
- 控制该组表格采用的批次规模
- 建议与该组计划承载的表数量和复杂度相匹配
- **默认建议与 `contextDepth` 保持相同数值，便于维护与识别分组**
- **同时也是分组键的一部分**
- 写成 `-1`：表示该表不单独指定批次规模，改为使用全局设置

### updateFrequency
- 控制更新频率
- 写成 `-1`：表示该表使用全局更新频率
- 没有特殊要求时，通常不需要在表级单独覆写

### skipFloors
- 控制跳过的楼层
- 写成 `-1`：表示该表使用全局跳层设置
- 没有特殊需求时，通常不需要在表级单独覆写

### 推荐分组方法

1. 先判断每张表的复杂度：轻量 / 中等 / 长文本 / 特殊规则 / 战斗专用
2. 将依赖相似上下文、复杂度接近的表放入同组
3. **若某张表是规则表、校验表、战斗规则表、系统规则表，它必须与依赖这些规则的业务表放在同一组**，否则填表 AI 无法在同批更新时看到规则
4. 纪要表这类长文本总结表可优先单独拆组，但前提是不承担其他表的规则支撑职责
5. **默认总分组数不超过 3 组**，除非用户明确提出要做更细分的特殊拆组
6. 同组表使用完全相同的 `contextDepth + batchSize`，默认优先采用同值配对
7. 若无明确理由，优先保持 `contextDepth = batchSize`
8. 不同组至少改动其中一个值，避免数据库插件误判为同组

### 推荐展示格式

```text
分组A（contextDepth=4, batchSize=4）：全局数据表、背包物品表、主角装备表
分组B（contextDepth=7, batchSize=7）：系统规则表、主角信息、重要角色表、主角技能表、任务与事件表、战斗场景表、选项表
分组C（contextDepth=8, batchSize=8）：纪要表
```

---

## exportConfig 关键配置说明

### enabled
- `true`: 生成世界书条目
- `false`: 不生成条目，仅供前端显示

### splitByRow
- `true`: 每行数据生成一个独立条目
- `false`: 整个表格生成一个条目

### entryType
- `"constant"`: 常驻条目，始终存在
- `"keyword"`: 关键词触发条目

### keywords
- 当 `entryType: "keyword"` 时，指定触发关键词所在的列名
- 例如：`"keywords": "姓名"` 表示使用姓名列的值作为触发关键词

### preventRecursion
- `true`: 禁止递归触发其他条目
- 建议：所有条目都设置为 `true`

### injectionTemplate
- 条目内容的注入模板
- 使用 `$1` 作为数据占位符
- 例如：`"<记忆回溯>\n$1\n</记忆回溯>"`

### extraIndexEnabled
- `true`: 生成额外的索引条目
- 用于汇总显示多行数据

### extraIndexColumns
- 索引条目包含的列名数组
- 例如：`["姓名", "一句话介绍"]`

### extraIndexColumnModes
- 列的模式配置：
  - `"both"`: 同时在主条目和索引条目中显示
  - `"index_only"`: 仅在索引条目中显示

### extraIndexInjectionTemplate
- 索引条目的注入模板
- 例如：`"<已登场角色>\n$1\n</已登场角色>"`

---

## 注意事项

1. **纪要表和重要角色表必须存在**，否则AI无法正常记录剧情和角色信息
2. **重要角色表必须包含"姓名"和"一句话介绍"列**，这是关键词触发和索引生成的关键
3. **UID必须唯一**，建议使用固定格式 `sheet_xxxxxxxx`
4. **mate字段必须存在**，这是表格系统正常工作的基础
5. **表格模板支持两种源文件格式**：
   - YAML 拆分格式（推荐）：每张表一个 YAML 文件，放在 `tables/` 目录下
   - JSON 单文件格式：所有表写在 `tables/table-template.json` 中
6. **制作表格模板时，必须显式规划 `contextDepth + batchSize` 分组方案**
7. **复杂表、长文本表、特殊规则表优先考虑拆组，以便并发填表并降低单批次压力**
8. **构建产物自动输出到 `tables/_build/table-template.json`**，不手动编辑

---

## 模板文件

标准模板文件位于：

- YAML 拆分格式：`templates/tables/000-meta.yaml` + `templates/tables/001-*.yaml`
- JSON 单文件格式：`templates/tables/table-template.json`

YAML 拆分格式的目录结构：

```
tables/
├── 000-meta.yaml           ← mate 元信息
├── 001-全局数据表.yaml     ← 按 orderNo 排序编号
├── 002-重要角色表.yaml
├── 003-纪要表.yaml
├── 004-自定义表.yaml       ← 根据需求添加
└── _build/                 ← 构建产物（自动生成）
    └── table-template.json
```

每个 YAML 文件对应一张表，包含该表的完整定义（uid、name、sourceData、content、updateConfig、exportConfig、orderNo）。

该模板包含：
- 纪要表（必需）
- 重要角色表（必需）
- 全局数据表（可选）
- 主角状态表（可选）
