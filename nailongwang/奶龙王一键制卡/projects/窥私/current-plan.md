# 窥私 制卡计划

## 基本信息

- 卡名：窥私 · Mid · 完整新卡 · 五件套无立绘
- 版本：v0.7.6

## 当前阶段

阶段8 打包确认 — **v0.7.6。** 第3到第6步各自写开：乳头乳晕、三角裤阴蒂逼口、连续三下或每一档、高潮的忍和液体落点。禁止并成一句。JSON 与 PNG 往返见本次构建。

## 组件

| 资产 | 路径 |
|------|------|
| 开场白 | frontend/opening.html |
| 开场正则 | frontend/opening-regex.html |
| 状态栏 | frontend/status-bar.html |
| 剧情推进预设 | frontend/剧情推进.json + entries/998-ACU |
| 推进美化/正则 | frontend/推进美化.html + 推进正则配置.json |
| 表格 ACU | entries/999-ACU-表格模板.yaml |
| release | release/窥私.json（已 build+verify） |

## 表格

| 文件 | 表 |
|------|-----|
| 001 | 全局数据表 |
| 002 | 重要角色表 |
| 003 | 堕落服从表 |
| 004 | 把柄清单表 |
| 005 | 浅残留表 |
| 006 | 隐私供词录 |
| 007 | 隐私交叉表 |
| 008 | 纪要表 |

## 验收

- verify-release：passed（21 条目；ACU 模板/预设匹配）
- shujuku fake both：填表变化数 6；`api.callAI 已生成`；上游 bundle 404 走 fallback，正式填表验收需本机有 shujuku dist

## 进度记录

- 001–019 世界书；五女语料；019+first_mes
- 表格八张写入
- 前端五件套 + 998/999 ACU + release JSON
