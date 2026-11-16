# shujuku 模板变量与条件语法速查

本文总结 shujuku 当前模板引擎支持的变量、条件和执行顺序。适用于提示词文本、表格模板、剧情预设等会经过数据库模板处理的内容。

## 能力矩阵

| 语法 | 原生模式 | SQLite 模式 |
| --- | :---: | :---: |
| `<random>` / `$random:` | 可用 | 可用 |
| `<calc>` / `$calc:` | 可用 | 可用 |
| `<max>` / `$max:` | 可用 | 可用 |
| `<min>` / `$min:` | 可用 | 可用 |
| `<if seed="...">` | 可用 | 可用 |
| `<if cell="...">` | 可用 | 可用 |
| `<if cond="...">` 的非 db/sql/v 前缀 | 可用 | 可用 |
| `{[db...]}` / `{[sql ...]}` / `$v:` | 不可用 | 可用 |
| `<if db="...">` / `<if sql="...">` | 不可用 | 可用 |

## random

直接输出随机数：

```html
<random min="1" max="100" />
```

存成变量：

```html
<random id="roll" min="1" max="100" />
本次骰点：$random:roll
```

规则：

- `min` / `max` 是闭区间。
- `id` 只能英文、数字、下划线。
- 原生 `<random>` 不支持负数；负数随机建议 SQLite 模式用 `db.expr()`。

## calc / max / min

```html
<calc id="score" expr="$random:roll + 5" />
最终分数：$calc:score

<max id="best" values="$calc:score, 10, 20" />
最大值：$max:best

<min id="low" values="$calc:score, 10, 20" />
最小值：$min:low
```

规则：

- `<calc>` 支持 `+ - * / %` 和括号。
- `<calc>` 结果向下取整。
- `<max>/<min>` 的 `values` 是逗号分隔的独立值，不写 `1+2` 这种表达式。
- 这些变量只在当前消息内有效。

## v 变量

SQLite 模式下，db/sql 可以存 `$v:`：

```text
{[db.背包物品表.where('物品名称','铁剑').get('数量') as sword_cnt]}
铁剑数量：$v:sword_cnt
```

规则：

- 变量名必须匹配 `[a-zA-Z_][a-zA-Z0-9_]*`。
- 标签存变量后自身输出为空。
- 每条消息开始会清空 `$v:`。

## if 标签

基础结构：

```html
<if 类型="表达式">命中内容</if>
<if 类型="表达式">命中内容<else>未命中内容</if>
```

允许类型：

- `seed`
- `cell`
- `cond`
- `db`
- `sql`

### seed

```html
<if seed="战斗">战斗内容</if>
<if seed="战斗&魔法">同时有战斗和魔法</if>
<if seed="战斗,逃跑">战斗或逃跑</if>
<if seed="!安全">不安全</if>
```

### cell

```html
<if cell="背包物品表/铁剑/数量 >= 3">铁剑充足<else>铁剑不足</if>
```

三段式含义：

```text
表名 / 行标识 / 列名
```

匹配规则：

- 先按表名找表。
- 再按列名找表头。
- 行标识会在该表每行的任意单元格里精确匹配。
- 找不到时会尝试行列互换，兼容写反。

### db / sql

仅 SQLite 模式：

```html
<if db="db.背包物品表.count() > 2">物品超过 2 种。</if>
<if db="背包物品表.where('物品名称','铁剑').exists()">有铁剑。</if>

<if sql="SELECT COUNT(*) FROM 重要角色表 WHERE 是否离场='否'">存在未离场角色。</if>
```

`db` 表达式可省略开头的 `db.`。

### cond

`cond` 是统一条件表达式：

```html
<if cond="seed:战斗 & cell:背包物品表/铁剑/数量 > 2">战斗中且铁剑充足。</if>
<if cond="db:背包物品表.count() > 2 & v:sword_cnt > 0">数据库条件命中。</if>
<if cond="random:1-100 > 80">触发稀有事件。</if>
```

前缀：

| 前缀 | 说明 |
| --- | --- |
| `seed:` | 关键词 |
| `cell:` | 单元格比较 |
| `random:` | 随机变量或 `min-max` 内联随机 |
| `calc:` | calc 变量比较 |
| `max:` / `min:` | max/min 变量比较 |
| `db:` | ORM 条件，仅 SQLite |
| `sql:` | SQL 条件，仅 SQLite |
| `v:` | `$v:` 变量，仅 SQLite |

逻辑优先级：

1. `()`
2. `!`
3. `&`
4. `,`

注意：`cond` 子表达式内部不要再直接混入 `,` 或 `&`，否则会被外层逻辑拆开。

## 执行顺序

每条消息按这个顺序处理：

```text
1. 解析 <random>
2. 替换 $random:
3. 解析 <calc>
4. 解析 <max>
5. 解析 <min>
6. 替换 $calc: / $max: / $min:
7. SQLite 模式下替换 {[db...]} / {[sql ...]}，生成 $v:
8. 替换 $v:
9. 最后解析 <if>
```

关键推论：

- `<calc expr="$v:x + 1" />` 不可靠，因为 `$v:` 还没生成。
- 要对 `$v:` 做算术，用 `{[db.calc("$v:x + 1") as y]}`。
- `<if>` 最后执行，所以可以读前面已经生成的 `$random:`、`$calc:`、`$v:`。
- 变量不跨消息保存。
