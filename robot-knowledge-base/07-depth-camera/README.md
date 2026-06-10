# Depth Camera Notes

Use this directory to record depth camera integration details and issues.

Key topics to capture:

- RGB image topic name, type, rate, and QoS.
- Depth image or point cloud topic name, type, rate, and QoS.
- Camera info topic and calibration state.
- RGB-depth alignment method.
- `base_link -> camera_link` static transform.
- Frame drop, timestamp, and bandwidth behavior on the target SoC.

Recommended evidence:

```bash
ros2 topic list -t | grep camera
ros2 topic hz /camera/color/image_raw
ros2 topic hz /camera/depth/image_raw
ros2 topic info /camera/color/image_raw --verbose
ros2 topic info /camera/depth/image_raw --verbose
ros2 run tf2_ros tf2_echo base_link camera_link
```

Keep this directory focused on camera data quality and integration contracts.
YOLO/NPU model details belong in `../06-yolo-npu/`.
