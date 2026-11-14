# MVU（MagVarUpdate）样例

- 模式：G
- 入口：`window.Mvu` + JS-Slash-Runner
- 速查：`docs/MVU_API.md`
- API 数据库：`data/mvu-api.json`

## 文件

| 文件 | 用途 | Schema |
| --- | --- | --- |
| `initvar-format.json` | `[InitVar]` 世界书初始变量 | `schemas/mvu-initvar.schema.json` |
| `mvu-script.json` | MVU 控制脚本 JSON（命令清理、范围限制、单轮幅度、绿灯激活） | `schemas/js-slash-runner-script.schema.json` |
| `update-block-format.txt` | `<UpdateVariable>` / `<JSONPatch>` / `<initvar>` 文本格式 | （格式说明，无 schema） |

## 生成

```powershell
npm run new -- mvu-initvar 初始变量
npm run new -- mvu-script 变量控制脚本
```

## 重要约束

- 必须 `await waitGlobalInitialized('Mvu')`。
- 事件用 `Mvu.events.*`，不要用旧字符串。
- `[InitVar]` 叶子必须为 `[初始值, 字段说明]` 二元数组。
