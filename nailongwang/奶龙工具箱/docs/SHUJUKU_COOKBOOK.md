# shujuku 速查菜谱

这份文档是“遇到需求直接抄”的 shujuku 菜谱。完整语法见：

- `SQL_TEMPLATE_SYNTAX.md`
- `TEMPLATE_VARIABLES_AND_IF.md`
- `LLM_CALLAI_API.md`
- `CROSSFIRE_VECTOR_INDEX.md`
- `SHUJUKU_API.md`

## 读一个单元格

```text
{[db.背包物品表.where('物品名称', '铁剑').get('数量')]}
```

## 列出一列

```text
{[db.重要角色表.where('是否离场', '否').list('姓名')]}
```

## 统计数量

```text
未离场人数：{[db.重要角色表.where('是否离场', '否').count()]}
```

## 求和 / 平均 / 最大 / 最小

```text
物品总数：{[db.背包物品表.sum('数量')]}
平均数量：{[db.背包物品表.avg('数量')]}
最大库存：{[db.背包物品表.max('数量')]}
最小库存：{[db.背包物品表.min('数量')]}
```

## 判断是否存在

```text
{[db.背包物品表.where('物品名称', '铁剑').exists()]}
```

配合 if：

```html
<if db="db.背包物品表.where('物品名称','铁剑').exists()">有铁剑。<else>没有铁剑。</if>
```

## 多条件 AND

```text
{[db.重要角色表.where('是否离场', '否').where('姓名', '艾莉').get('过往经历')]}
```

## OR 条件

```text
{[db.重要角色表.where('姓名', '艾莉').orWhere('姓名', '本').list('姓名')]}
```

## IN / BETWEEN / LIKE

```text
{[db.背包物品表.whereIn('类别', ['武器', '消耗品']).list('物品名称')]}
{[db.背包物品表.whereBetween('数量', 3, 10).list('物品名称')]}
{[db.背包物品表.whereLike('物品名称', '%药水%').count()]}
```

## 分组聚合

```text
{[db.背包物品表.groupBy('类别').having('COUNT(*) > 1').all()]}
```

## 排序分页

```text
{[db.纪要表.orderBy('编码索引', 'DESC').limit(3).all()]}
```

## 调试 SQL

```text
{[db.背包物品表.where('类别', '武器').toSQL()]}
```

## 直接写 SELECT

```text
{[sql "SELECT SUM(数量) FROM 背包物品表 WHERE 类别='武器'"]}
```

JOIN：

```text
{[sql "SELECT a.姓名, b.物品名称 FROM 重要角色表 a JOIN 背包物品表 b ON INSTR(a.持有的重要物品, b.物品名称) > 0"]}
```

CASE：

```text
{[sql "SELECT 姓名, CASE WHEN 是否离场='否' THEN '在场' ELSE '离场' END AS 状态 FROM 重要角色表"]}
```

## 存变量

```text
{[db.背包物品表.where('物品名称','铁剑').get('数量') as sword_cnt]}
你有 $v:sword_cnt 把铁剑。
```

## 用变量算术

```text
{[db.背包物品表.where('物品名称','铁剑').get('数量') as sword_cnt]}
{[db.calc("$v:sword_cnt * 2") as sword_power]}
双持评分：$v:sword_power
```

不要这样写：

```html
<calc id="x" expr="$v:sword_cnt + 1" />
```

因为 `<calc>` 早于 `$v:` 生成。

## 随机

原生/SQLite 都可用：

```html
<random id="roll" min="1" max="100" />
本次骰点：$random:roll
```

SQLite 表达式随机：

```text
{[db.rand(1, 100)]}
```

## 条件显示

关键词：

```html
<if seed="战斗">战斗内容</if>
```

表格：

```html
<if cell="背包物品表/铁剑/数量 >= 3">铁剑充足<else>铁剑不足</if>
```

统一条件：

```html
<if cond="seed:战斗 & cell:背包物品表/铁剑/数量 >= 3">战斗中且铁剑充足。</if>
```

数据库条件：

```html
<if cond="db:背包物品表.where('物品名称','铁剑').exists() & v:sword_cnt > 0">铁剑可用。</if>
```

## 前端读取整库

```js
const data = window.AutoCardUpdaterAPI.exportTableAsJson();
console.log(data);
```

## 前端改一个单元格

```js
await window.AutoCardUpdaterAPI.updateCell('背包物品表', 1, '数量', 2);
```

对象参数：

```js
await window.AutoCardUpdaterAPI.updateCell({
  tableName: '背包物品表',
  rowIndex: 1,
  colIdentifier: '数量',
  value: 2,
  skipNotify: true,
});
```

## 前端批量写行

```js
await window.AutoCardUpdaterAPI.updateRow('背包物品表', 1, {
  数量: 2,
  类别: '武器',
});
```

## 前端调用 AI

```js
const context = window.AutoCardUpdaterAPI.getStoryContext(5);

const result = await window.AutoCardUpdaterAPI.callAI([
  { role: 'system', content: '你是剧情分析助手。' },
  { role: 'user', content: `请分析以下剧情：\n\n${context}` },
], { maxTokens: 1200 });
```

## 当前聊天注入剧情预设

```js
const ok = window.AutoCardUpdaterAPI.injectPlotPresetToCurrentChat('战斗场景');
```

传空字符串表示当前聊天跟随全局：

```js
window.AutoCardUpdaterAPI.injectPlotPresetToCurrentChat('');
```

## 当前聊天注入模板预设

```js
await window.AutoCardUpdaterAPI.injectTemplatePresetToCurrentChat('任务专用模板');
```

## 排错速查

| 现象 | 常见原因 |
| --- | --- |
| `{[db...]}` 原样显示 | 不是 SQLite 模式 |
| `{[sql "UPDATE..."]}` 没效果 | 模板 SQL 只读 |
| `$v:x` 没值 | 变量未在同一条消息里生成 |
| `<calc expr="$v:x + 1" />` 不生效 | 执行顺序早于 `$v:` |
| `<if cond="seed:A,B & ...">` 结果奇怪 | `,` 和 `&` 被外层 cond 解析 |
| 中文列名带 `/` 的 SQL 报错 | 用英文列名或方括号转义 |
