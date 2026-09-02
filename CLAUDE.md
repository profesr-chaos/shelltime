# Shelltime

Electron + React + SQLite time tracker for Windows. See README.md for structure and commands.

## Before every PR

A PreToolUse hook blocks `gh pr create` until the `review` subagent has signed off on HEAD.

1. Run the `review` subagent (`.claude/agents/review.md`) on `git diff origin/main...HEAD`.
2. Fix each defect it reports. Commit. Run it again until it reports none.
3. Put the final review output, unchanged, in your last message to the user.
4. Run `git rev-parse HEAD > .claude/.review-ok`, then `gh pr create`.

Any new commit after the marker invalidates it. Review again before you retry.
