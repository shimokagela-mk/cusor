// Zod schema 范例：在 JS-Slash-Runner / MVU 脚本中可直接使用全局 z。
// 本文件只展示 schema 写法，不含具体业务正文，可作为模板拷贝。

(function () {
    'use strict';

    if (typeof z === 'undefined') {
        console.warn('[zod 样例] 未检测到全局 z；请确认运行在 JS-Slash-Runner 环境内');
        return;
    }

    // 1. 校验 LLM 返回的工具调用参数
    const ToolArgs = z.object({
        action: z.enum(['buy', 'sell', 'info']),
        target: z.string().min(1),
        quantity: z.coerce.number().int().min(1).default(1),
    });

    // 2. 校验 generate JSON schema 输出
    const ChapterReply = z.object({
        chapter: z.string(),
        summary: z.string(),
        tags: z.array(z.string()).default([]),
        characters: z.array(z.object({
            name: z.string(),
            mood: z.enum(['neutral', 'happy', 'sad', 'angry']).default('neutral'),
        })).default([]),
    });

    // 3. 校验 MVU stat_data 子树
    const Leaf = z.tuple([z.unknown(), z.string()]);
    const StatSubtree = z.object({
        角色A: z.object({
            好感度: Leaf,
            着装: z.object({
                上装: Leaf,
                下装: Leaf,
            }).partial(),
        }),
    });

    // 4. 透传未知字段
    const PassthroughMessage = z.object({
        role: z.enum(['system', 'user', 'assistant']),
        content: z.string(),
    }).passthrough();

    // 5. 严格 + 转换 + 默认值
    const Settings = z.object({
        theme: z.enum(['light', 'dark']).default('dark'),
        retry: z.coerce.number().int().min(0).max(5).default(3),
        keys: z.array(z.string()).optional(),
    }).strict();

    // 暴露到全局便于复用（实际项目里建议挂在唯一命名空间下）
    window.ZodExampleSchemas = {
        ToolArgs,
        ChapterReply,
        StatSubtree,
        PassthroughMessage,
        Settings,
    };

    function tryParse(name, schema, value) {
        const result = schema.safeParse(value);
        if (result.success) {
            console.log(`[zod 样例] ${name} 通过`, result.data);
        } else {
            console.warn(`[zod 样例] ${name} 失败`, result.error.issues);
        }
    }

    // 简单自检
    tryParse('ToolArgs', ToolArgs, { action: 'buy', target: '示例物品', quantity: '2' });
    tryParse('ChapterReply', ChapterReply, { chapter: '第一章', summary: '占位摘要' });
    tryParse('Settings', Settings, { theme: 'dark', retry: '3' });
})();
