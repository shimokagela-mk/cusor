# 智能机器人项目细颗粒度学习执行路线

## 目标

这份路线解决三个问题：

1. 每一阶段具体学什么。
2. 如何验证自己真的学会了。
3. 每周应该输出什么文档，沉淀成可复用资产。

你的项目定位不是“做小车”，而是：

> 通过自研 ARM CPU + NPU SoC 上的 ROS2 机器人迁移项目，把自己从嵌入式平台工程师升级为机器人系统工程师。

你的主线职责是：

- 建图
- 定位
- Nav2 导航
- ROS2 导航链路
- SoC 平台迁移问题定位
- 与 YOLO/NPU/深度相机/ASR/MCU 的接口集成

## 每周投入方式

按你当前可投入时间设计：

- 工作日：每天 1.5 小时
- 周末：每天 4 小时
- 每周可用时间约 15.5 小时

建议每周分配：

| 类型 | 时间 | 目标 |
| --- | --- | --- |
| 理论学习 | 4 小时 | 看文档、源码、参数含义 |
| 项目验证 | 6 小时 | 在真实机器人或仿真环境中验证 |
| 问题复盘 | 2 小时 | 记录故障、证据、根因 |
| 文档输出 | 3.5 小时 | 写成知识库文档、图、表格 |

## 学习验证分级

不要用“我看过了”判断是否学会。每个知识点按四级验证：

| 等级 | 标准 | 例子 |
| --- | --- | --- |
| L1 看懂 | 能说出概念和作用 | 知道 Topic、Service、Action 的区别 |
| L2 会查 | 能用命令看到真实数据 | 能查 `/scan` 频率、QoS、消息类型 |
| L3 会复现 | 能构造或录制一个问题并复现 | 用 rosbag 复现一次 TF 异常 |
| L4 会解决 | 能定位根因并给出修复/规避方案 | 找出导航不动是 lifecycle 未 active |

每周至少完成一个 L3 或 L4 验证。

## 12 周主线计划

### 第 1 周：系统全貌与 ROS Graph 盘点

学习内容：

- ROS2 Node、Topic、Service、Action 的基本含义。
- 当前机器人完整模块边界。
- RDK X5 与目标 SoC 的启动方式差异。
- 每个节点负责什么、输入什么、输出什么。

重点模块：

- SLAM 节点
- Localization 节点
- Nav2 节点组
- Base controller
- Lidar driver
- Camera/YOLO node
- ASR/Task Manager

必须执行的命令：

```bash
ros2 node list
ros2 node info /node_name
ros2 topic list -t
ros2 service list -t
ros2 action list -t
rqt_graph
```

验证方式：

- 能画出当前系统的 ROS Graph。
- 能解释每个核心节点的输入、输出和负责人。
- 能指出导航指令从 Task Manager 到 MCU 的大致链路。

文档输出：

- `01-system-architecture/current-ros-graph.md`
- `01-system-architecture/node-topic-inventory.md`
- `01-system-architecture/rdk-x5-vs-target-soc-diff.md`

文档必须包含：

- Node 表
- Topic 表
- Action 表
- Service 表
- 每个节点的 owner
- 每条关键链路的频率和消息类型

完成标准：

- 你能不用看代码，向别人讲清楚“机器人收到导航指令后，哪些节点参与了处理”。

### 第 2 周：TF 树、时间戳与 rosbag2

学习内容：

- TF2 基本概念。
- `map -> odom -> base_link -> laser/camera` 的含义。
- `header.stamp` 和 `frame_id` 的意义。
- rosbag2 的录制、回放和问题复现。

重点模块：

- TF publisher
- Static transform publisher
- Lidar frame
- Camera frame
- Odom frame
- Map frame

必须执行的命令：

```bash
ros2 run tf2_tools view_frames
ros2 run tf2_ros tf2_echo map base_link
ros2 run tf2_ros tf2_echo odom base_link
ros2 run tf2_ros tf2_echo base_link laser
ros2 bag record /tf /tf_static /scan /odom /map /cmd_vel
ros2 bag info bag_directory
ros2 bag play bag_directory --clock
```

验证方式：

- 录制一次完整建图或导航 rosbag。
- 用 rosbag 回放并复现至少一个现象。
- 人为关闭一个静态 TF 或改错 frame，观察系统报错。

文档输出：

- `01-system-architecture/tf-tree-analysis.md`
- `02-ros2/rosbag-replay-guide.md`
- `10-debug-cases/tf-error-case.md`

文档必须包含：

- TF 树截图或 PDF
- 每个 frame 的发布者
- 每个关键 sensor 的 `frame_id`
- 一个 TF 异常的复现步骤

完成标准：

- 你能判断一个导航问题是否由 TF 缺失、时间戳错误或 frame 配置错误导致。

### 第 3 周：ROS2 节点、参数、Launch 与 rclcpp 基础

学习内容：

- ROS2 package 基本结构。
- rclcpp publisher/subscriber。
- parameter 声明、读取与 dump。
- launch 文件组织方式。
- 日志级别与节点命名。

重点模块：

- 当前项目 launch 文件。
- Nav2 参数文件。
- SLAM 参数文件。
- Base controller 参数。

建议做一个小验证节点：

- 订阅 `/odom`
- 订阅 `/cmd_vel`
- 统计频率、最大速度、延迟
- 定时打印健康状态

验证方式：

- 能读懂当前项目主要 launch 文件。
- 能 dump Nav2 和 SLAM 参数。
- 能写出一个最小诊断节点或脚本统计关键 topic。

常用命令：

```bash
ros2 param list
ros2 param get /node_name param_name
ros2 param dump /node_name
ros2 launch package_name launch_file.py
ros2 run package_name executable_name
```

文档输出：

- `02-ros2/launch-and-params-analysis.md`
- `02-ros2/diagnostic-node-design.md`

完成标准：

- 你能说清楚某个参数从 YAML 文件到节点运行时如何生效。
- 你能通过参数 dump 对比 RDK X5 与目标 SoC 是否配置一致。

### 第 4 周：DDS、QoS、Executor、Lifecycle

学习内容：

- DDS 在 ROS2 中的作用。
- QoS 的 reliability、history、depth、durability。
- Executor 与 callback 调度。
- Callback Group。
- Lifecycle Node 状态机。

重点模块：

- Lidar topic QoS。
- Camera topic QoS。
- `/tf_static` durability。
- Nav2 lifecycle nodes。
- YOLO/NPU 节点是否阻塞 callback。

验证方式：

- 找出所有关键 topic 的 QoS。
- 复现或构造一次 QoS 不匹配导致的订阅异常。
- 检查 Nav2 所有 lifecycle 节点是否 active。

常用命令：

```bash
ros2 topic info /scan --verbose
ros2 topic info /tf_static --verbose
ros2 lifecycle nodes
ros2 lifecycle get /controller_server
ros2 lifecycle get /planner_server
ros2 lifecycle get /bt_navigator
```

文档输出：

- `02-ros2/qos-inventory.md`
- `02-ros2/lifecycle-state-checklist.md`
- `10-debug-cases/qos-mismatch-case.md`

完成标准：

- 你能解释为什么有些 topic 在 RDK X5 正常，在目标 SoC 上可能收不到。
- 你能判断 Nav2 是没有启动、没有 active，还是通信链路出问题。

### 第 5 周：底盘、MCU、里程计与运动闭环

学习内容：

- `/cmd_vel` 的语义。
- wheel odom 如何产生。
- `odom -> base_link` 的来源。
- UART/CAN 到 MCU 的控制链路。
- 编码器方向、轮径、轮距对定位的影响。

重点模块：

- Base controller
- MCU 通信协议
- Motor driver
- Encoder
- Odom publisher

验证方式：

- 机器人静止时，观察 `/odom` 是否稳定。
- 直线运动时，验证 odom 距离是否接近真实距离。
- 原地旋转时，验证 yaw 方向是否正确。
- `/cmd_vel` 有输出但机器人不动时，沿链路定位到 MCU 或电机。

常用命令：

```bash
ros2 topic echo /cmd_vel
ros2 topic echo /odom
ros2 topic hz /odom
ros2 run tf2_ros tf2_echo odom base_link
```

文档输出：

- `04-localization/odom-calibration-record.md`
- `01-system-architecture/mcu-control-chain.md`
- `10-debug-cases/cmd-vel-to-motor-case.md`

完成标准：

- 你能解释 `/cmd_vel`、MCU、电机、编码器、`/odom` 如何形成闭环。
- 你能判断定位漂移是否与里程计误差有关。

### 第 6 周：slam_toolbox 数据流与建图质量

学习内容：

- LaserScan 数据结构。
- scan matching 的基本思想。
- pose graph。
- loop closure。
- map publish 与 map save。
- slam_toolbox 参数含义。

重点模块：

- `/scan`
- `/odom`
- `/map`
- `map -> odom`
- slam_toolbox 参数文件

验证方式：

- 在同一环境跑三次建图，对比地图一致性。
- 分别测试走廊、窄通道、回环路线。
- 修改一个关键参数，记录建图变化。
- 记录一次建图失败案例。

文档输出：

- `03-slam/slam-toolbox-data-flow.md`
- `03-slam/mapping-test-report.md`
- `03-slam/slam-param-tuning-log.md`
- `10-debug-cases/mapping-failure-case.md`

完成标准：

- 你能区分地图歪斜是 scan、odom、TF、参数还是环境导致。

### 第 7 周：Localization 与 map/odom/base_link 关系

学习内容：

- 定位和建图的区别。
- `map -> odom` 为什么存在。
- 初始位姿的作用。
- AMCL 或当前 localizer 的输入输出。
- 定位漂移、跳变和丢失的常见原因。

重点模块：

- Localization node
- `/initialpose`
- `/particlecloud`，如果使用 AMCL
- `/tf`
- `/scan`
- `/odom`

验证方式：

- 在已有地图上启动定位。
- 机器人从不同初始位置启动，观察定位收敛。
- 快速旋转、走廊、动态障碍下观察定位稳定性。
- 对比 RDK X5 与目标 SoC 的定位延迟。

文档输出：

- `04-localization/localization-data-flow.md`
- `04-localization/map-odom-base-link-analysis.md`
- `04-localization/pose-drift-cases.md`

完成标准：

- 你能解释机器人如何知道自己在哪。
- 你能判断定位跳变是 TF、odom、scan match 还是 CPU 延迟导致。

### 第 8 周：Nav2 全局规划与 Costmap

学习内容：

- Planner Server。
- Global Costmap。
- Static layer、Obstacle layer、Inflation layer。
- Footprint。
- 地图、障碍物和路径之间的关系。

重点模块：

- `/planner_server`
- `/global_costmap`
- global planner plugin
- map server
- costmap 参数

验证方式：

- 同一地图下选择多个目标点，观察全局路径。
- 修改 footprint，观察窄通道能否通过。
- 修改 inflation radius，观察路径是否过度保守。
- 让障碍物进入/离开 costmap，观察变化。

文档输出：

- `05-nav2/global-planner-analysis.md`
- `05-nav2/global-costmap-param-study.md`
- `05-nav2/footprint-and-inflation-test.md`

完成标准：

- 你能解释为什么路径绕远、为什么目标不可达、为什么窄通道过不去。

### 第 9 周：Nav2 Controller、Behavior Tree 与 Recovery

学习内容：

- Controller Server。
- Local Costmap。
- DWB/TEB/MPPI 等 controller 插件，按项目实际为准。
- Behavior Tree。
- Recovery behavior。
- Goal tolerance 与速度/加速度限制。

重点模块：

- `/controller_server`
- `/local_costmap`
- `/cmd_vel`
- BT XML
- Recovery server

验证方式：

- 固定起点终点，调一组 controller 参数并记录差异。
- 复现原地旋转、振荡、到不了目标点等问题。
- 观察 BT 在不同失败场景下如何切换。
- 记录 recovery 触发原因。

文档输出：

- `05-nav2/controller-param-tuning.md`
- `05-nav2/behavior-tree-analysis.md`
- `05-nav2/recovery-case-study.md`
- `10-debug-cases/nav2-oscillation-case.md`

完成标准：

- 你能解释为什么机器人原地旋转、撞墙、绕路、反复 recovery。

### 第 10 周：目标 SoC 性能基线与迁移问题定位

学习内容：

- CPU、内存、I/O、温度、调度延迟对 ROS2 的影响。
- Topic 频率和带宽。
- DDS 延迟。
- 驱动、时间戳、QoS 与平台差异。
- 长稳测试方法。

重点模块：

- Lidar driver
- Camera driver
- NPU runtime
- DDS
- SLAM/Nav2 进程
- MCU 通信链路

验证方式：

- 建立 RDK X5 与目标 SoC 的性能基线。
- 对同一个 rosbag 在两个平台回放。
- 全栈运行时记录 CPU、内存、topic hz、温度。
- 记录一次平台相关问题。

常用命令：

```bash
top
pidstat -durh 1 60
vmstat 1 60
iostat -xz 1 60
dmesg -T
journalctl -b --no-pager
ros2 topic hz /scan
ros2 topic bw /scan
```

文档输出：

- `09-soc-porting/rdk-x5-vs-target-soc-baseline.md`
- `11-performance/performance-baseline-week10.md`
- `09-soc-porting/platform-migration-risk-list.md`

完成标准：

- 你能用数据说明“目标 SoC 上慢在哪里、抖在哪里、丢在哪里”。

### 第 11 周：YOLO/NPU/深度相机与导航接口

学习内容：

- RGB image、depth image、point cloud 的消息形式。
- YOLO 输出格式。
- 2D bbox 与深度融合。
- object pose 如何转到 `base_link`、`odom` 或 `map`。
- AI 延迟如何影响任务和导航。

重点模块：

- Camera node
- Depth topic
- YOLO/NPU node
- Detection topic
- Task Manager
- Nav2 goal interface

验证方式：

- 记录相机和检测 topic 频率。
- 检查 detection 消息是否包含 timestamp 和 frame_id。
- 用一个目标物体触发任务或导航行为。
- 测量 camera -> detection -> task 的延迟。

文档输出：

- `06-yolo-npu/detection-interface-contract.md`
- `07-depth-camera/depth-camera-data-quality.md`
- `06-yolo-npu/ai-latency-budget.md`
- `10-debug-cases/object-to-navigation-case.md`

完成标准：

- 你能和负责 YOLO/NPU 的同事讨论接口设计，而不是只说“模型跑起来了吗”。

### 第 12 周：全链路打通与阶段总结

学习内容：

- 语音到导航链路。
- 视觉到任务链路。
- 导航到执行链路。
- 跨模块问题分层。
- 项目白皮书结构。

重点链路：

```text
Voice -> ASR -> Intent -> Task Manager -> Nav2 -> Controller -> MCU -> Motor
Camera -> YOLO -> Object -> Decision -> Task Manager -> Nav2
Lidar/Odom -> SLAM/Localization -> Nav2 -> cmd_vel -> MCU -> Odom
```

验证方式：

- 完成一次端到端演示。
- 对一个跨模块问题做完整复盘。
- 输出阶段性白皮书。
- 用 10 分钟讲清楚系统架构。

文档输出：

- `01-system-architecture/full-chain-architecture.md`
- `01-system-architecture/phase-1-migration-whitepaper.md`
- `10-debug-cases/cross-module-debug-case.md`
- `11-performance/full-stack-baseline.md`

完成标准：

- 你能主持一次系统问题定位会议。
- 你能把问题拆成平台、通信、定位、规划、控制、AI、MCU 等责任边界。

## 4-6 个月进阶计划

### 进阶 1：源码阅读，不是通读，而是按问题进入

优先顺序：

1. Nav2 参数和 plugin 加载路径。
2. Controller Server 如何输出 `/cmd_vel`。
3. Costmap layer 如何更新障碍物。
4. slam_toolbox scan callback 到 map publish 的路径。
5. Lifecycle manager 如何管理节点状态。

验证方式：

- 每读一个源码路径，必须输出一张调用链图。
- 每张调用链图必须绑定一个真实问题。

文档输出：

- `05-nav2/source-controller-server-call-chain.md`
- `05-nav2/source-costmap-layer-call-chain.md`
- `03-slam/source-slam-toolbox-map-publish.md`

### 进阶 2：系统性能优化

学习内容：

- 线程与 CPU 亲和性。
- 进程优先级。
- DDS 配置。
- 图像分辨率、帧率、NPU 推理延迟。
- SLAM/Nav2 topic 频率调优。
- 日志与 rosbag 对性能的影响。

验证方式：

- 优化前后至少对比三项指标：
  - CPU
  - 内存
  - topic 频率
  - 导航成功率
  - 推理延迟
  - 温度

文档输出：

- `11-performance/optimization-record-001.md`
- `09-soc-porting/dds-config-study.md`
- `11-performance/long-run-stability-report.md`

### 进阶 3：技术选型能力

学习内容：

- slam_toolbox、Cartographer、RTAB-Map、ORB-SLAM3、FAST-LIO 的适用边界。
- 不追求全部移植，重点建立判断标准。

验证方式：

- 至少选择两个候选方案做资料调研。
- 从传感器、算力、场景、维护成本、商业落地角度比较。

文档输出：

- `12-selection-reports/slam-selection-report.md`
- `12-selection-reports/navigation-controller-selection.md`

## 6-12 个月架构化目标

目标不是学更多名词，而是形成平台负责人能力。

应该能独立完成：

- 新传感器接入评估。
- 新 SoC 平台迁移风险评估。
- 新功能接入接口设计。
- 机器人系统性能基线设计。
- 跨模块问题定位会议主持。
- 对外解释整套机器人软件架构。

最终文档包：

```text
robot-knowledge-base/
  01-system-architecture/
    full-chain-architecture.md
    phase-1-migration-whitepaper.md
    module-interface-spec.md
  02-ros2/
    qos-inventory.md
    rosbag-replay-guide.md
  03-slam/
    slam-toolbox-data-flow.md
    mapping-test-report.md
  04-localization/
    localization-data-flow.md
    pose-drift-cases.md
  05-nav2/
    controller-param-tuning.md
    global-costmap-param-study.md
    behavior-tree-analysis.md
  06-yolo-npu/
    detection-interface-contract.md
    ai-latency-budget.md
  09-soc-porting/
    rdk-x5-vs-target-soc-baseline.md
    platform-migration-risk-list.md
  10-debug-cases/
    at-least-10-real-cases.md
  11-performance/
    full-stack-baseline.md
    long-run-stability-report.md
  12-selection-reports/
    slam-selection-report.md
```

## 每篇技术文档的标准结构

建议所有文档使用这个结构：

```text
# 标题

## 背景
为什么要研究这个问题。

## 结论先行
当前结论是什么，适用范围是什么。

## 系统位置
它处在机器人链路的哪一层，输入输出是什么。

## 数据证据
命令输出、topic 频率、日志、截图、rosbag、参数。

## 分析过程
如何从证据走到结论。

## 验证方法
如何复现，如何判断通过。

## 风险与限制
这个结论在哪些场景下可能不成立。

## 后续动作
下一步要修什么、测什么、问谁。
```

## 问题复盘的完成标准

一篇问题复盘只有满足下面条件才算合格：

- 有明确复现步骤。
- 有原始证据，不只有主观描述。
- 有至少两个初始假设。
- 有排查路径，而不只是最终答案。
- 有根因。
- 有修复或规避方案。
- 有验证结果。
- 有一条可复用经验。

## 每周验收表

| 周次 | 学习主题 | L3/L4 验证 | 文档输出 | 是否完成 |
| --- | --- | --- | --- | --- |
| 第 1 周 | ROS Graph | 完成系统盘点 | Node/Topic 表 |  |
| 第 2 周 | TF/rosbag | 复现一个 TF 问题 | TF 分析文档 |  |
| 第 3 周 | 参数/Launch | dump 并对比参数 | Launch 分析 |  |
| 第 4 周 | QoS/Lifecycle | 发现或构造 QoS/Lifecycle 问题 | QoS 清单 |  |
| 第 5 周 | MCU/Odom | 验证运动闭环 | Odom 校准记录 |  |
| 第 6 周 | SLAM | 复现建图问题 | SLAM 调参日志 |  |
| 第 7 周 | Localization | 复现定位漂移 | 定位链路分析 |  |
| 第 8 周 | Planner/Costmap | 解释不可达/绕路 | Costmap 参数研究 |  |
| 第 9 周 | Controller/BT | 复现振荡/recovery | Controller 调参 |  |
| 第 10 周 | SoC 性能 | 输出平台基线 | 性能基线报告 |  |
| 第 11 周 | AI 接口 | 检测触发任务/导航 | Detection 接口契约 |  |
| 第 12 周 | 全链路 | 完成端到端演示 | 阶段白皮书 |  |

## 面试表达转换

项目结束后，不要只说“做了智能小车导航”。应该表达为：

```text
负责 ROS2 机器人软件栈在自研 ARM CPU + NPU SoC 上的迁移与导航链路适配，重点覆盖建图、定位、Nav2、TF、DDS/QoS、底盘控制接口和平台性能问题。通过 rosbag2、TF 分析、Topic 频率、性能基线和长稳测试建立系统级调试方法，并与 YOLO/NPU/深度相机/ASR 模块定义接口边界，支撑机器人端到端任务闭环。
```

这才是从“嵌入式工程师”升级到“机器人系统工程师”的项目价值。
