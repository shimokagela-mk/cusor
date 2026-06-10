# SLAM Selection Report Template

Use this template after the current `slam_toolbox` solution is understood. The
goal is not to chase every algorithm, but to build selection judgment.

## Selection question

Which SLAM/localization solution best fits this robot product on the target ARM
CPU + NPU SoC?

## Product constraints

| Constraint | Requirement |
| --- | --- |
| Environment | indoor / outdoor / mixed |
| Robot speed |  |
| Sensor set | lidar / depth camera / IMU / wheel odom |
| CPU budget |  |
| Memory budget |  |
| Power budget |  |
| Map size |  |
| Dynamic obstacle level |  |
| Cost sensitivity |  |
| Maintenance ability |  |

## Candidate comparison

| Candidate | Sensor input | Strength | Weakness | Compute cost | Integration cost | Fit |
| --- | --- | --- | --- | --- | --- | --- |
| slam_toolbox | 2D lidar + odom | ROS2-friendly, practical indoor mapping | depends on lidar/odom quality | low-medium | low | TBD |
| Cartographer | 2D/3D lidar + IMU | mature pose graph, good mapping | heavier and more complex | medium-high | medium | TBD |
| ORB-SLAM3 | camera/IMU | visual SLAM capability | sensitive to texture/light, integration cost | medium-high | high | TBD |
| RTAB-Map | RGB-D/stereo/lidar | practical RGB-D mapping | resource pressure | medium-high | medium-high | TBD |
| FAST-LIO | lidar + IMU | strong lidar-inertial odometry | needs suitable lidar/IMU | medium | high | TBD |

## Evaluation scenarios

| Scenario | Why it matters | Metric |
| --- | --- | --- |
| Corridor | Feature-poor mapping | map drift |
| Narrow passage | Navigation usability | pass/fail, map quality |
| Loop route | Loop closure | closure error |
| Dynamic people | Real environment | robustness |
| Low light | Visual methods | failure rate |
| Long run | Stability | CPU, memory, pose drift |

## Metrics

- Mapping success rate.
- Localization stability.
- CPU usage.
- Memory usage.
- Sensor dependency.
- Integration difficulty.
- Debuggability.
- Commercial maintainability.

## Recommendation

Recommended solution:

Reason:

Risks:

Fallback:

Next experiment:
