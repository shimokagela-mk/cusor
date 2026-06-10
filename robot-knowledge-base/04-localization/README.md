# Localization Notes

Use this directory for localization-specific notes that should not be mixed with
general SLAM documentation.

Recommended files to add during the project:

- `amcl-or-localizer-params.md`
- `pose-drift-cases.md`
- `map-to-odom-analysis.md`
- `localization-test-report.md`

Minimum evidence for each localization issue:

- `/tf` and `/tf_static`
- `/odom`
- `/scan`
- map file
- initial pose
- robot video or RViz screenshot
- whether the issue reproduces on RDK X5, target SoC, or both
