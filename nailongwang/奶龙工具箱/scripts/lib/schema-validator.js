'use strict';

/**
 * 轻量 JSON Schema 校验器，零依赖。
 * 支持的关键字（够当前项目使用即可）：
 *   type / const / required / properties / patternProperties / items
 *   additionalProperties / oneOf / anyOf / minLength / minItems / maxItems
 *   minProperties
 *   #/$defs/<name> 形式的本地 $ref
 *
 * 项目自定义关键字：
 *   requireKeyPattern: string
 *     要求对象至少有一个 key 符合该正则。用于“至少有一个 sheet_*”这类语义。
 */

function typeOf(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value === 'number' ? 'number' : typeof value;
}

function typeMatches(value, expected) {
    const actual = typeOf(value);
    if (Array.isArray(expected)) return expected.includes(actual);
    if (expected === 'integer') return Number.isInteger(value);
    return actual === expected;
}

function resolveRef(ref, rootSchema) {
    if (!ref.startsWith('#/$defs/')) return null;
    const key = ref.slice('#/$defs/'.length);
    return rootSchema.$defs ? rootSchema.$defs[key] : null;
}

function validateSchema(value, schema, where = '$', rootSchema = schema) {
    const errors = [];

    function add(msg) { errors.push(`${where}: ${msg}`); }

    if (!schema) {
        add('schema 缺失');
        return errors;
    }

    if (schema.$ref) {
        const target = resolveRef(schema.$ref, rootSchema);
        if (!target) {
            add(`无法解析 $ref ${schema.$ref}`);
            return errors;
        }
        return validateSchema(value, target, where, rootSchema);
    }

    if (schema.const !== undefined && value !== schema.const) {
        add(`期望 const=${JSON.stringify(schema.const)}，实际=${JSON.stringify(value)}`);
    }

    if (schema.type && !typeMatches(value, schema.type)) {
        add(`类型错误，期望 ${JSON.stringify(schema.type)}，实际 ${typeOf(value)}`);
        return errors;
    }

    if (schema.oneOf) {
        const pass = schema.oneOf.filter(s => validateSchema(value, s, where, rootSchema).length === 0);
        if (pass.length !== 1) add(`oneOf 校验失败，通过数量=${pass.length}`);
    }

    if (schema.anyOf) {
        const pass = schema.anyOf.some(s => validateSchema(value, s, where, rootSchema).length === 0);
        if (!pass) add('anyOf 校验失败');
    }

    if (schema.required && value && typeof value === 'object' && !Array.isArray(value)) {
        for (const key of schema.required) {
            if (!(key in value)) add(`缺少必填字段 ${key}`);
        }
    }

    if (schema.properties && value && typeof value === 'object' && !Array.isArray(value)) {
        for (const [key, sub] of Object.entries(schema.properties)) {
            if (key in value) {
                errors.push(...validateSchema(value[key], sub, `${where}.${key}`, rootSchema));
            }
        }
    }

    if (schema.patternProperties && value && typeof value === 'object' && !Array.isArray(value)) {
        for (const [pattern, sub] of Object.entries(schema.patternProperties)) {
            const re = new RegExp(pattern);
            for (const key of Object.keys(value)) {
                if (re.test(key)) errors.push(...validateSchema(value[key], sub, `${where}.${key}`, rootSchema));
            }
        }
    }

    if (schema.items && Array.isArray(value)) {
        value.forEach((item, i) => errors.push(...validateSchema(item, schema.items, `${where}[${i}]`, rootSchema)));
    }

    if (schema.additionalProperties && typeof schema.additionalProperties === 'object'
        && value && typeof value === 'object' && !Array.isArray(value)) {
        const known = new Set(Object.keys(schema.properties || {}));
        for (const [pattern] of Object.entries(schema.patternProperties || {})) {
            const re = new RegExp(pattern);
            for (const key of Object.keys(value)) if (re.test(key)) known.add(key);
        }
        for (const key of Object.keys(value)) {
            if (!known.has(key)) {
                errors.push(...validateSchema(value[key], schema.additionalProperties, `${where}.${key}`, rootSchema));
            }
        }
    }

    if (schema.minItems !== undefined && Array.isArray(value) && value.length < schema.minItems) {
        add(`数组长度 ${value.length} < minItems ${schema.minItems}`);
    }
    if (schema.maxItems !== undefined && Array.isArray(value) && value.length > schema.maxItems) {
        add(`数组长度 ${value.length} > maxItems ${schema.maxItems}`);
    }
    if (schema.minLength !== undefined && typeof value === 'string' && value.length < schema.minLength) {
        add(`字符串长度 ${value.length} < minLength ${schema.minLength}`);
    }

    if (schema.minProperties !== undefined && value && typeof value === 'object' && !Array.isArray(value)) {
        const count = Object.keys(value).length;
        if (count < schema.minProperties) add(`对象属性数 ${count} < minProperties ${schema.minProperties}`);
    }

    if (schema.requireKeyPattern && value && typeof value === 'object' && !Array.isArray(value)) {
        const re = new RegExp(schema.requireKeyPattern);
        const has = Object.keys(value).some(k => re.test(k));
        if (!has) add(`对象缺少区配 ${schema.requireKeyPattern} 的属性`);
    }

    return errors;
}

module.exports = { validateSchema, typeOf };
