# Performance Baseline Template

Use this template whenever comparing RDK X5 and the target SoC, or before and
after an optimization.

## Test metadata

- Date:
- Tester:
- Platform:
- Hardware revision:
- OS image:
- ROS2 distro:
- Git commit/package version:
- Map:
- Scenario:
- Launch command:

## System information

```bash
uname -a
lsb_release -a
lscpu
free -h
df -h
```

Record:

| Item | Value |
| --- | --- |
| CPU cores |  |
| CPU governor |  |
| Memory |  |
| Storage |  |
| NPU runtime |  |
| ROS2 distro |  |
| DDS implementation |  |

## ROS2 graph baseline

| Metric | Value |
| --- | --- |
| Node count |  |
| Topic count |  |
| Action count |  |
| Service count |  |
| Critical lifecycle states |  |

Critical topic rates:

| Topic | Expected rate | Actual rate | Bandwidth | QoS notes |
| --- | --- | --- | --- | --- |
| `/scan` |  |  |  |  |
| `/odom` |  |  |  |  |
| `/tf` |  |  |  |  |
| `/map` |  |  |  |  |
| `/cmd_vel` |  |  |  |  |
| detection topic |  |  |  |  |
| depth topic |  |  |  |  |

## Resource usage

| Process/node | CPU avg | CPU max | Memory avg | Memory max | Threads | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| SLAM |  |  |  |  |  |  |
| Localization |  |  |  |  |  |  |
| Planner |  |  |  |  |  |  |
| Controller |  |  |  |  |  |  |
| Base controller |  |  |  |  |  |  |
| YOLO/NPU node |  |  |  |  |  |  |
| ASR node |  |  |  |  |  |  |

Commands:

```bash
pidstat -durh 1 60
vmstat 1 60
iostat -xz 1 60
```

## Latency and behavior

| Chain | Measurement | Baseline | Optimized | Notes |
| --- | --- | --- | --- | --- |
| lidar to SLAM |  |  |  |  |
| localization to Nav2 |  |  |  |  |
| Nav2 goal to path |  |  |  |  |
| path to `/cmd_vel` |  |  |  |  |
| `/cmd_vel` to odom response |  |  |  |  |
| camera to detection |  |  |  |  |
| detection to task |  |  |  |  |

## Stability results

| Test | Duration | Result | Failures | Logs |
| --- | --- | --- | --- | --- |
| Idle |  |  |  |  |
| Mapping |  |  |  |  |
| Localization |  |  |  |  |
| Repeated navigation goals |  |  |  |  |
| Full stack with AI and ASR |  |  |  |  |

## Conclusion

- Main bottleneck:
- Biggest migration risk:
- Recommended optimization:
- Follow-up owner:
