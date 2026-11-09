# Embedded Tables 可读总览

- 来源文件: `examples/markdown-first-demo/extracted/tables/embedded-template.pretty.json`
- 生成时间: 2026-04-08T16:02:21.175Z

这个文件用于快速总览；分表版本位于 `readable/` 目录。

## 表单目录

- 当前状态表
- 关系状态表

## 当前状态表

- uid: `sheet_CurrentStatus`
- orderNo: 1

## 可编辑说明

- 可以直接修改 `## 说明`，会回写到 `sourceData.note`。
- 可以直接修改 `## 更新规则`，但必须保持以下四行格式：`- 初始化: ...`、`- 更新: ...`、`- 插入: ...`、`- 删除: ...`。
- 可以直接修改 `## 当前内容` 下的 Markdown 表格，会回写到 `content`。
- 可以直接修改 `## 更新配置` 中的 JSON，会回写到 `updateConfig`，适合调整上下文深度、批次、更新频率等运行参数。
- 可以直接修改 `## 导出配置` 中的 JSON，会回写到 `exportConfig`，适合调整分组参数、导出参数与注入位置。
- 不要修改 `# 表名`、`uid`、`orderNo`。这些字段当前仅用于展示，不参与回写。
- 修改完成后，运行回包流程即可自动同步到 `embedded-template.pretty.json`。

## 说明

- 记录当前场景的位置、时间和天数。此表有且仅有一行。

## 更新规则

- 初始化: 故事初始化时插入一条记录。
- 更新: 每轮更新位置、时间和天数。
- 插入: 禁止操作。
- 删除: 禁止删除。

## 当前内容

| 当前位置 | 当前时间 | 天数 |
| --- | --- | --- |

## 更新配置

```json
{
  "uiSentinel": -1,
  "contextDepth": 2,
  "updateFrequency": 1,
  "batchSize": 1,
  "skipFloors": -1
}
```

## 导出配置

```json
{
  "enabled": false,
  "splitByRow": false
}
```


## 关系状态表

- uid: `sheet_Relationship`
- orderNo: 1

## 可编辑说明

- 可以直接修改 `## 说明`，会回写到 `sourceData.note`。
- 可以直接修改 `## 更新规则`，但必须保持以下四行格式：`- 初始化: ...`、`- 更新: ...`、`- 插入: ...`、`- 删除: ...`。
- 可以直接修改 `## 当前内容` 下的 Markdown 表格，会回写到 `content`。
- 可以直接修改 `## 更新配置` 中的 JSON，会回写到 `updateConfig`，适合调整上下文深度、批次、更新频率等运行参数。
- 可以直接修改 `## 导出配置` 中的 JSON，会回写到 `exportConfig`，适合调整分组参数、导出参数与注入位置。
- 不要修改 `# 表名`、`uid`、`orderNo`。这些字段当前仅用于展示，不参与回写。
- 修改完成后，运行回包流程即可自动同步到 `embedded-template.pretty.json`。

## 说明

- 记录角色之间的关系状态。

## 更新规则

- 初始化: 有关联关系的角色登场时插入对应行。
- 更新: 关系变化时更新对应行。
- 插入: 新关系建立时插入新行。
- 删除: 禁止删除。

## 当前内容

| 角色1 | 角色2 | 关系 | 亲密值 | 特殊状态 |
| --- | --- | --- | --- | --- |

## 更新配置

```json
{
  "uiSentinel": -1,
  "contextDepth": 2,
  "updateFrequency": 1,
  "batchSize": 1,
  "skipFloors": -1
}
```

## 导出配置

```json
{
  "enabled": false,
  "splitByRow": false
}
```
