# Git 使用说明

仓库地址：<https://github.com/niccolecantdoit-rgb/nailongwang.git>

本文件只说明日常更新、提交和推送。普通 `git pull --ff-only` / `git push origin main` 不会整目录覆盖仓库。真正需要防的是乱暂存、强推、硬重置、清理工作区，以及提交 `.gitignore` 中应保留为本地输出的文件。

## 更新当前分支

日常更新当前分支：

```bash
git status --short
git pull --ff-only
```

- `.gitignore` 中的用户输出目录不会被 Git 跟踪；普通 pull 只更新已跟踪文件，不会主动覆盖这些未跟踪输出文件。
- 如果 pull 提示会覆盖本地未跟踪文件、无法 fast-forward、出现冲突或工作区状态不清楚，停止并报告原因。
- 不要为了继续 pull 改用 `reset --hard`、`clean -fd`、`checkout -- .` 或其他覆盖/删除命令。

## 提交并推送

```bash
git commit -m "更新说明"
git push origin main
git tag -a "奶龙王vx.x.x" -m "更新日志"
git push origin "奶龙王vx.x.x"
```

- 只暂存本次任务实际修改的文件。
- 不要用 `git add .`，除非已经确认所有变更都属于本次任务。
- 推送前确认暂存区只包含本次任务相关文件。
- 普通 `git push origin main` 只推送本地 commit；如果远端不接受，停止并报告，不要强推。
- 标签版本按更新规模递增：修 bug 加 `0.0.1`，小更新加 `0.1.0`，大更新加 `1.0.0`。
- 标签写错时，先确认没有其他人依赖该标签，再决定是否重建标签。

## 不提交

提交前按根目录 `.gitignore` 核对本地输出目录：

- `奶龙王一键制卡/projects/`
- `奶龙王一键制卡/output/`
- `_inbox/`
- `奶龙工具箱/projects/`
- `node_modules/`
- `.opencode/`
- `.limcode/`

这些目录中的用户文件、临时文件、缓存文件、本地密钥、个人配置和无关构建产物不要提交。

如果不确定某个路径是否被忽略，先执行：

```bash
git check-ignore -v <路径>
```

如果某个输出文件已经被 Git 跟踪，`.gitignore` 不会保护它；停止并报告，不要自行删除跟踪记录。

## 禁止命令

除非用户明确要求并确认风险，否则不要执行：

```bash
git push --force
git push --force-with-lease
git push --mirror
git reset --hard
git checkout -- .
git restore .
git clean -fd
git clean -fdx
git checkout --ours .
git checkout --theirs .
```

这些命令可能重写远端历史、丢弃本地改动或删除 `.gitignore` 中的用户输出文件。

## 合并其他分支

只有用户明确要求“把某个分支合进当前分支”时使用：

```bash
git status --short
git fetch origin
git branch --show-current
git diff --name-status <当前分支>..origin/<要合并的分支>
git log --oneline --left-right <当前分支>...origin/<要合并的分支>
git merge --no-ff origin/<要合并的分支>
```

- 合并前工作区应干净；如果存在未提交改动，停止并报告。
- 如果出现冲突，逐个读取冲突文件并手工合并。
- 不要用“全部采用当前分支”或“全部采用对方分支”掩盖冲突。
