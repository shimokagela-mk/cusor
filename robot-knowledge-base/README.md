# Robot Knowledge Base

This knowledge base turns the smart robot migration project into reusable
engineering assets. The goal is to grow from embedded Linux / SoC platform work
into ROS2 robot system engineering.

## Project context

- Source platform: RDK X5
- Target platform: company ARM CPU + NPU SoC
- OS/runtime: Ubuntu + ROS2 + DDS
- Main responsibility: mapping, localization, Nav2, ROS2 navigation chain, and
  target SoC adaptation
- Adjacent modules: YOLO/NPU/depth camera, audio/ASR, MCU base controller

## Directory map

```text
robot-knowledge-base/
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

## Weekly operating rhythm

Each week should produce:

1. One technical note.
2. One problem review.
3. One architecture or data-flow update.
4. One reproducible case, preferably backed by logs, rosbag, screenshots, or
   command output.

## Growth checkpoints

Use these checkpoints to decide whether the project is producing career value:

- Can I explain the full path from a navigation command to motor movement?
- Can I identify whether a failure belongs to perception, localization,
  planning, control, MCU communication, or SoC adaptation?
- Can I replay a problem with rosbag2 and isolate the responsible module?
- Can I quantify CPU, memory, bandwidth, latency, temperature, and stability
  differences between RDK X5 and the target SoC?
- Can I define interfaces between YOLO/depth camera results and navigation or
  task management?

## Documentation rule

For every important issue, record evidence before conclusions. A useful note
must contain command output, topic names, node names, message types, timing
data, parameters, or reproduction steps.
