# Problem Review Template

Use this template for every meaningful robot issue. The goal is to preserve the
debugging process, not only the final fix.

## Summary

- Title:
- Date:
- Owner:
- Platform: RDK X5 / target SoC / both
- Module: hardware / driver / ROS2 / TF / SLAM / localization / Nav2 / MCU /
  AI / ASR / task manager
- Severity:
- Status: open / mitigated / fixed / cannot reproduce

## Symptom

Describe what happened in observable terms:

- What did the robot do?
- What was expected?
- Is the issue stable or intermittent?
- Does it happen on RDK X5, target SoC, or both?

## Reproduction steps

1.
2.
3.

Environment:

- Map:
- Start pose:
- Goal pose:
- Launch command:
- Hardware setup:
- Battery/power state:

## Evidence

Attach or link:

- rosbag path:
- logs:
- screenshots/video:
- parameter dumps:
- TF tree:
- topic rates:
- CPU/memory records:
- MCU/CAN/UART logs:

Minimum commands:

```bash
ros2 node list
ros2 topic list -t
ros2 lifecycle nodes
ros2 run tf2_tools view_frames
ros2 bag info bag_directory
dmesg -T | tail -n 200
journalctl -b --no-pager | tail -n 300
```

## Initial hypotheses

| Hypothesis | Layer | Evidence for | Evidence against | Next check |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

## Debug process

Record the path, including failed attempts.

| Step | Action | Result | Conclusion |
| --- | --- | --- | --- |
| 1 |  |  |  |

## Root cause

State the root cause in one or two sentences.

Good format:

```text
Because <condition>, <module> produced <wrong behavior>, which caused
<observable robot symptom>.
```

## Fix

- Code/config change:
- Parameter change:
- Hardware change:
- Operational workaround:

## Verification

| Test | Before | After | Pass/Fail |
| --- | --- | --- | --- |
|  |  |  |  |

## Lessons

- What signal would have found this faster?
- Which checklist should be updated?
- Does this issue expose a missing interface contract?
- Does this issue affect the migration white paper?
