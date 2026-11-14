# shujuku SQL / ORM 模板语法速查

本文按 shujuku 当前源码与 `docs/syntax-reference.md` 总结。它描述的是提示词文本里的数据库模板语法，不是 `window.AutoCardUpdaterAPI` 的前端 JS 调用。

## 运行模式

这些语法只在 SQLite 模式生效：

- `{[db.表名.方法链]}`
- `{[db.expr/rand/calc/max/min(...)]}`
- `{[sql "SELECT ..."]}`
- `{[... as 变量名]}` 与 `$v:变量名`
- `<if db="...">`、`<if sql="...">`
- `<if cond="db:... | sql:... | v:...">`

原生模式下，上述标签会原样保留，不会替换。

## ORM 查询

基础格式：

```text
{[db.背包物品表.where('物品名称', '铁剑').get('数量')]}
```

常用构建方法：

| 方法 | 说明 |
| --- | --- |
| `.where('列', '值')` | 等值筛选 |
| `.where('列', '>', 数值)` | 比较筛选，支持 `>` `>=` `<` `<=` `!=` `=` |
| `.orWhere('列', '值')` | 开启 OR 分支 |
| `.whereIn('列', [值...])` | IN |
| `.whereNotIn('列', [值...])` | NOT IN |
| `.whereBetween('列', 最小, 最大)` | 闭区间 BETWEEN，会自动排序 |
| `.whereNull('列')` | IS NULL |
| `.whereNotNull('列')` | IS NOT NULL |
| `.whereLike('列', '模式')` | LIKE，`%` 任意字符，`_` 单字符 |
| `.groupBy('列')` | GROUP BY |
| `.having('表达式')` | HAVING，常配合 groupBy |
| `.distinct()` | SELECT DISTINCT |
| `.orderBy('列', 'ASC')` | 排序，支持 `ASC` / `DESC` |
| `.limit(数量)` | LIMIT |
| `.offset(数量)` | OFFSET，无 limit 时会补 `LIMIT -1` |

终结方法：

| 方法 | 返回 |
| --- | --- |
| `.get('列')` | 第一行指定列 |
| `.first()` | 第一行所有列 |
| `.list('列')` | 某列所有行 |
| `.all()` | 所有行所有列 |
| `.count()` | 行数 |
| `.sum/avg/max/min('列')` | 聚合值 |
| `.exists()` | 是否存在 |
| `.value('SQL表达式')` | 在当前 WHERE 上下文执行 `SELECT <表达式>` |
| `.toSQL()` | 调试用 SQL 字符串 |

## 常用示例

```text
铁剑数量：{[db.背包物品表.where('物品名称', '铁剑').get('数量')]}
武器库存：{[db.背包物品表.where('类别', '武器').sum('数量')]}
未离场角色：{[db.重要角色表.where('是否离场', '否').list('姓名')]}
药水数量：{[db.背包物品表.whereLike('物品名称', '%药水%').count()]}
```

OR 示例：

```text
{[db.重要角色表.where('姓名', '艾莉').orWhere('姓名', '本').list('姓名')]}
```

分组示例：

```text
{[db.背包物品表.groupBy('类别').having('COUNT(*) > 1').all()]}
```

## 静态方法

```text
{[db.expr("3 + 5 * 2")]}
{[db.rand(1, 100)]}
{[db.calc("$v:sword_cnt + 1")]}
{[db.max(3, 7, 1)]}
{[db.min(3, 7, 1)]}
```

规则：

- `db.expr()` 只接受能被 `SELECT <表达式>` 求值的表达式。
- `db.rand(min, max)` 是闭区间随机整数，`min > max` 会自动交换。
- `db.calc()` 适合拿 `$v:` 变量做算术。
- `db.max/min()` 会过滤非数值参数；全过滤时返回 `null`。

## 原生 SQL

基础格式：

```text
{[sql "SELECT SUM(数量) FROM 背包物品表"]}
```

支持：

- SELECT
- 子查询
- JOIN
- CASE WHEN
- GROUP BY / HAVING
- CTE
- 窗口函数

不支持：

- `UPDATE`
- `INSERT`
- `DELETE`
- `CREATE`

因为模板替换走只读查询路径。

返回格式：

| 结果 | 文本 |
| --- | --- |
| 0 行 | 空字符串 |
| 1 行 x 1 列 | 直接返回值 |
| N 行 x 1 列 | 用 `, ` 拼接 |
| N 行 x M 列 | 每行 `列名: 值, 列名: 值`，多行换行 |

## 中文名与英文名

中文表名/列名会通过 DDL 注释生成的 NameMapper 翻译为英文物理名。

```text
{[db.inventory.where('item_name', '铁剑').get('quantity')]}
```

等价于：

```text
{[db.背包物品表.where('物品名称', '铁剑').get('数量')]}
```

建议教程示例优先用中文，生产 SQL 遇到带 `/` 的列名时用英文列名或方括号转义。

## 变量

任何 db/sql 标签都可以存变量：

```text
{[db.背包物品表.where('物品名称','铁剑').get('数量') as sword_cnt]}
你有 $v:sword_cnt 把铁剑。
```

规则：

- `as` 后变量名只能用英文、数字、下划线，且不能数字开头。
- 标签存变量后本身替换为空字符串。
- 变量只在当前单条消息内有效。
- 想用变量算术，优先用 `{[db.calc("$v:x + 1")]}`。

## 踩坑

- 原生模式下 SQL/ORM 标签不会执行。
- `{[sql ...]}` 只能读，不能写。
- `<calc expr="$v:x + 1" />` 不适合 `$v:`，因为执行顺序早于 db/sql 变量生成。
- `where('列', null)` 是 `IS NULL`，不要写成字符串 `'null'`。
- 变量名不能中文。
- SQL 里字符串用英文单引号，字符串内部单引号写成两个单引号。
