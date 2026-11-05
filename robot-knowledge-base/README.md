# 机器人知识库

这个知识库用于把智能机器人平台迁移项目沉淀为可复用的工程资产。目标是从嵌入式 Linux / SoC 平台能力，升级到 ROS2 机器人系统工程能力。

## 项目背景

- 原始平台：RDK X5
- 目标平台：公司自研 ARM CPU + NPU SoC
- 系统与运行环境：Ubuntu + ROS2 + DDS
- 你的主要职责：建图、定位、Nav2、ROS2 导航链路、目标 SoC 平台适配
- 相关模块：YOLO/NPU/深度相机、音频/ASR、MCU 底板控制器

## 目录地图

```text
robot-knowledge-base/
  00-learning-roadmap/
  01-system-architecture/
  02-ros2/
  03-slam/
  04-localization/
  05-nav2/
  06-yolo-npu/
  07-depth-camera/
  08-audio-asr/
  09-soc-porting/
  10-debug-cases/
  11-performance/
  12-selection-reports/
```

## 推荐阅读顺序

1. [细颗粒度学习执行路线](00-learning-roadmap/detailed-learning-roadmap.md)
2. [系统架构地图](01-system-architecture/system-map.md)
3. [ROS2 导航调试手册](02-ros2/ros2-navigation-debugging.md)
4. [SLAM 与定位指南](03-slam/slam-localization-guide.md)
5. [Nav2 调试手册](05-nav2/nav2-debugging-guide.md)
6. [SoC 迁移与性能基线](09-soc-porting/soc-migration-performance.md)
7. [AI 感知与导航集成](06-yolo-npu/ai-navigation-integration.md)

## 每周工作节奏

每周至少沉淀：

1. 一篇技术笔记。
2. 一次问题复盘。
3. 一次架构图或数据流更新。
4. 一个可复现案例，最好包含日志、rosbag、截图或命令输出。

## 成长检查点

用下面的问题判断这个项目是否正在产生职业成长价值：

- 我能不能讲清楚导航指令从下发到电机转动的完整路径？
- 我能不能判断一个故障属于感知、定位、规划、控制、MCU 通信还是 SoC 适配？
- 我能不能用 rosbag2 复现问题，并隔离出责任模块？
- 我能不能量化 RDK X5 和目标 SoC 在 CPU、内存、带宽、延迟、温度、稳定性上的差异？
- 我能不能定义 YOLO/深度相机结果与导航或任务管理之间的接口？

## 文档规则

所有重要问题都要先记录证据，再给结论。一篇有价值的笔记必须包含命令输出、话题名、节点名、消息类型、时序数据、参数或复现步骤。
