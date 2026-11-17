# Zod API 速查

来源：

- 仓库：<https://github.com/colinhacks/zod>
- API 文档：<https://zod.dev/api>

对应机器可检索数据库：`data/zod-api.json`

> JS-Slash-Runner 已经内置 zod，全局变量 `z` 可直接使用。本速查只列在酒馆生态（JS-Slash-Runner / MVU / SillyTavern Extension / shujuku 输出校验）中实际会用到的语法。

## 0. 入口

```js
// JS-Slash-Runner 环境（推荐）
const Schema = z.object({ name: z.string() });

// Node 项目
import { z } from 'zod';
```

类型推断：

```ts
type T = z.infer<typeof Schema>;
type In = z.input<typeof Schema>;
type Out = z.output<typeof Schema>;
```

---

## 1. 基本类型

```js
z.string()
z.number()
z.bigint()
z.boolean()
z.date()
z.null()
z.undefined()
z.unknown()
z.any()
z.never()
z.void()
z.nan()
```

常用约束：

```js
z.string().min(1).max(100).regex(/^[A-Z]/)
z.string().email()
z.string().url()
z.string().uuid()
z.string().trim()

z.number().int().min(0).max(100)
z.number().nonnegative()
z.number().multipleOf(5)

// Zod 4
z.stringbool()
z.file().max(1024 * 1024).mime('image/png')
```

---

## 2. 字面量与枚举

```js
z.literal('male')
z.enum(['system', 'user', 'assistant'])
z.nativeEnum(MyEnum)
z.templateLiteral([z.number(), z.enum(['px', 'rem'])])
```

---

## 3. 容器

```js
z.object({
  name: z.string(),
  age: z.number().int().min(0),
})

z.strictObject({ name: z.string() }) // 未知键报错
z.looseObject({ name: z.string() })  // 未知键透传

z.array(z.string()).min(1).max(10)

z.tuple([z.literal('_.set'), z.string(), z.any(), z.any()])

z.record(z.string(), z.unknown())
z.partialRecord(z.enum(['id', 'name', 'email']), z.string())
z.looseRecord(z.string().regex(/_phone$/), z.string())

z.map(z.string(), z.number())
z.set(z.string())
```

`z.object` 修饰：

```js
const User = z.object({ name: z.string(), age: z.number() });

User.partial()                  // 全部字段可选
User.deepPartial()              // 嵌套全可选
User.required()                 // 全部必填
User.pick({ name: true })       // 取子集
User.omit({ age: true })        // 排除字段
User.extend({ email: z.string().email() })
User.merge(z.object({ id: z.string() }))
User.passthrough()              // 保留未声明字段
User.strict()                   // 出现未声明字段就报错
User.strip()                    // 去掉未声明字段（默认行为）
User.catchall(z.string())       // 未声明字段必须符合给定 schema
```

---

## 4. 组合

```js
z.union([z.string(), z.number()])

z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), value: z.string() }),
  z.object({ type: z.literal('number'), value: z.number() }),
])

z.intersection(A, B)

const Tree: z.ZodType<TreeT> = z.lazy(() => z.object({
  value: z.string(),
  children: z.array(Tree).default([]),
}))

z.string().optional()
z.string().nullable()
z.string().nullish()
z.string().default('hello')
z.string().catch('fallback')
```

---

## 5. 转换与精化

```js
z.string()
  .refine(s => s.length > 0, '不能为空')
  .transform(s => s.trim());

z.number().superRefine((val, ctx) => {
  if (val < 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: '必须非负' });
});

z.string().pipe(z.string().email());

z.preprocess(v => Number(v), z.number());

z.string().prefault('fallback').trim();
z.instanceof(URL).check(z.property('protocol', z.literal('https:')));
z.codec(z.string(), z.date(), {
  decode: value => new Date(value),
  encode: value => value.toISOString(),
});

z.string().brand<'UserId'>();

z.coerce.number().int();
z.coerce.string();
```

---

## 6. 解析

```js
const result = Schema.safeParse(input);
if (!result.success) {
  console.warn(result.error.issues);
} else {
  doSomething(result.data);
}

// 抛出版本（适合 try/catch）
const data = Schema.parse(input);

// 异步（含异步 refine/transform）
await Schema.parseAsync(input);
await Schema.safeParseAsync(input);
```

`ZodError` 关键字段：

```js
error.issues          // ZodIssue[]
error.format()        // 嵌套对象错误树
error.flatten()       // { fieldErrors, formErrors }
error.toString()
```

---

## 7. 在酒馆生态里的常用模式

### 7.1 校验 LLM 返回的工具调用参数

```js
const ToolArgs = z.object({
  city: z.string(),
  unit: z.enum(['c', 'f']).default('c'),
});

const result = ToolArgs.safeParse(JSON.parse(rawText));
if (!result.success) {
  toastr.error('工具参数解析失败');
  return;
}
const { city, unit } = result.data;
```

### 7.2 校验 generate 的 JSON Schema 输出

```js
const Reply = z.object({
  chapter: z.string(),
  summary: z.string(),
  tags: z.array(z.string()).default([]),
});

const text = await generate({ user_input: '生成章节摘要', json_schema: ReplyJsonSchema });
const data = Reply.parse(JSON.parse(text));
```

### 7.3 校验 MVU stat_data 的某棵子树

```js
const Leaf = z.tuple([z.unknown(), z.string()]);
const Stat = z.object({
  角色A: z.object({
    状态值: Leaf,
    着装: z.object({
      上装: Leaf,
      下装: Leaf,
    }).partial(),
  }),
});

eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, vars => {
  const result = Stat.safeParse(vars.stat_data);
  if (!result.success) console.warn('[MVU] stat_data 不符合 schema', result.error.issues);
});
```

### 7.4 宽松解析（强制类型 + 默认值）

```js
const Q = z.object({
  qty: z.coerce.number().int().min(1).default(1),
});

Q.parse({ qty: '3' });   // -> { qty: 3 }
Q.parse({});             // -> { qty: 1 }
```

### 7.5 透传未知字段（不破坏 SillyTavern 原始结构）

```js
const Msg = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string(),
}).passthrough();
```

---

## 8. 集成约束

1. JS-Slash-Runner 已暴露全局 `z`，脚本内无需 import。
2. Zod 4 新 API 需要确认目标脚本环境内置 zod 版本；跨版本脚本默认使用 `object/string/array/union/safeParse` 等稳定子集。
3. 运行时校验优先 `safeParse`，避免未捕获异常打断脚本。
4. zod 不要用来反序列化敏感字段（密钥等），它只做形状校验。
5. 与 MVU 配合时，先用 `_.get` 取子树再 `safeParse`，避免在整棵 `stat_data` 上跑大 schema。
6. 与 `generate` JSON schema 输出配合时，把 zod schema 与 `json_schema` 字段保持同名同类型，便于双向验证。

## 9. Zod 4 注意点

- `z.strictObject` / `z.looseObject` 比旧式 `.strict()` / `.passthrough()` 更直观；维护 SillyTavern 原始 JSON 时优先宽松保留未知字段。
- enum/literal 键的 `z.record` 在 Zod 4 会做穷尽键检查；只允许部分键时用 `z.partialRecord`。
- `z.codec` 是双向转换，适合日期、URL 等可逆结构；普通脚本里只做解析时仍优先 `transform` / `pipe`。
- `z.property` / `.check()` 更偏底层，性能敏感或实例属性校验时再用；常规错误信息优先 `refine` / `superRefine`。
