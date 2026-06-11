# 性能基线模板

当你需要对比 RDK X5 与目标 SoC，或者对比优化前后效果时，使用这个模板。

## 测试元信息

- 日期：
- 测试人：
- 平台：
- 硬件版本：
- OS 镜像：
- ROS2 发行版：
- Git commit/软件包版本：
- 地图：
- 场景：
- 启动命令：

## 系统信息

```bash
uname -a
lsb_release -a
lscpu
free -h
df -h
```

记录：

| 项目 | 值 |
| --- | --- |
| CPU 核数 |  |
| CPU governor |  |
| 内存 |  |
| 存储 |  |
| NPU runtime |  |
| ROS2 发行版 |  |
| DDS 实现 |  |

## ROS2 Graph 基线

| 指标 | 值 |
| --- | --- |
| Node 数量 |  |
| Topic 数量 |  |
| Action 数量 |  |
| Service 数量 |  |
| 关键 lifecycle 状态 |  |

关键 topic 频率：

| Topic | 期望频率 | 实测频率 | 带宽 | QoS 备注 |
| --- | --- | --- | --- | --- |
| `/scan` |  |  |  |  |
| `/odom` |  |  |  |  |
| `/tf` |  |  |  |  |
| `/map` |  |  |  |  |
| `/cmd_vel` |  |  |  |  |
| detection topic |  |  |  |  |
| depth topic |  |  |  |  |

## 资源占用

| 进程/节点 | CPU 平均 | CPU 峰值 | 内存平均 | 内存峰值 | 线程数 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| SLAM |  |  |  |  |  |  |
| Localization |  |  |  |  |  |  |
| Planner |  |  |  |  |  |  |
| Controller |  |  |  |  |  |  |
| Base controller |  |  |  |  |  |  |
| YOLO/NPU node |  |  |  |  |  |  |
| ASR node |  |  |  |  |  |  |

命令：

```bash
pidstat -durh 1 60
vmstat 1 60
iostat -xz 1 60
```

## 延迟与行为

| 链路 | 测量方式 | 基线 | 优化后 | 备注 |
| --- | --- | --- | --- | --- |
| lidar 到 SLAM |  |  |  |  |
| localization 到 Nav2 |  |  |  |  |
| Nav2 goal 到 path |  |  |  |  |
| path 到 `/cmd_vel` |  |  |  |  |
| `/cmd_vel` 到 odom 响应 |  |  |  |  |
| camera 到 detection |  |  |  |  |
| detection 到 task |  |  |  |  |

## 稳定性结果

| 测试 | 持续时间 | 结果 | 失败现象 | 日志 |
| --- | --- | --- | --- | --- |
| 空闲 |  |  |  |  |
| 建图 |  |  |  |  |
| 定位 |  |  |  |  |
| 重复导航目标 |  |  |  |  |
| AI + ASR 全栈 |  |  |  |  |

## 结论

- 主要瓶颈：
- 最大迁移风险：
- 推荐优化方向：
- 后续负责人：
