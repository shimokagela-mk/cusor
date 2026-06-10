# 音频与 ASR 笔记

这个目录用于记录音频、ASR、意图识别和任务管理的集成契约。

即使音频由其他同事负责，导航也依赖下面这条链路：

```text
Mic -> ASR -> Intent -> Task Manager -> Nav2 Action -> Controller -> MCU
```

最小接口问题：

- 哪个 topic 或 service 承载 ASR 文本？
- 哪个 topic 或 service 承载 intent？
- intent 如何变成导航目标？
- 任务是一次性的、可取消的，还是连续的？
- 失败如何反馈给用户？
- 系统如何避免重复执行同一条命令？

推荐证据：

```bash
ros2 topic list -t
ros2 action list -t
ros2 service list -t
ros2 topic echo /intent_topic --once
ros2 action info /navigate_to_pose
```

这个目录只关注语音命令到机器人行为的接口。ASR 模型训练细节对导航负责人来说优先级较低。
