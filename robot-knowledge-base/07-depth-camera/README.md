# 深度相机笔记

这个目录用于记录深度相机集成细节和问题。

需要重点记录：

- RGB image topic 名称、类型、频率和 QoS。
- Depth image 或 point cloud topic 名称、类型、频率和 QoS。
- Camera info topic 与标定状态。
- RGB-depth 对齐方式。
- `base_link -> camera_link` 静态坐标变换。
- 目标 SoC 上的掉帧、时间戳和带宽表现。

推荐证据：

```bash
ros2 topic list -t | grep camera
ros2 topic hz /camera/color/image_raw
ros2 topic hz /camera/depth/image_raw
ros2 topic info /camera/color/image_raw --verbose
ros2 topic info /camera/depth/image_raw --verbose
ros2 run tf2_ros tf2_echo base_link camera_link
```

这个目录只关注相机数据质量和集成契约。YOLO/NPU 模型细节放在 `../06-yolo-npu/`。
