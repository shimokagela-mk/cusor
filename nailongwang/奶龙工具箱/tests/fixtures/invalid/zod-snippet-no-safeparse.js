// 用于校验失败用例：zod 样例必须出现对象 schema 与安全解析调用
const Schema = z.string();
const data = Schema.parse('hello');
console.log(data);
