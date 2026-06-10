# Audio and ASR Notes

Use this directory to record audio, ASR, intent, and task-manager integration
contracts.

Even if audio is owned by another teammate, navigation depends on this chain:

```text
Mic -> ASR -> Intent -> Task Manager -> Nav2 Action -> Controller -> MCU
```

Minimum interface questions:

- What topic or service carries ASR text?
- What topic or service carries intent?
- How does an intent become a navigation goal?
- Is the task one-shot, cancellable, or continuous?
- How are failures reported to the user?
- How does the system avoid repeated command execution?

Recommended evidence:

```bash
ros2 topic list -t
ros2 action list -t
ros2 service list -t
ros2 topic echo /intent_topic --once
ros2 action info /navigate_to_pose
```

Keep this directory focused on the interface from voice commands to robot
behavior. ASR model training details are lower priority for the navigation owner.
