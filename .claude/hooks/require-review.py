"""PreToolUse hook: block `gh pr create` until the review subagent has signed off on HEAD.

The review marker is .claude/.review-ok and holds the commit SHA the review covered.
Write it after a clean review with:  git rev-parse HEAD > .claude/.review-ok
"""
import json
import re
import subprocess
import sys
from pathlib import Path

MARKER = Path(".claude/.review-ok")
# `gh pr create` at the start of a command or after a shell separator, not inside a string.
PR_CREATE = re.compile(r"(^|[;&|(])\s*gh\s+pr\s+create\b", re.MULTILINE)

payload = json.loads(sys.stdin.buffer.read().decode("utf-8-sig"))
command = payload.get("tool_input", {}).get("command", "")
if not PR_CREATE.search(command):
    sys.exit(0)

head = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()

# PowerShell `>` writes UTF-16 (5.1) or UTF-8 with BOM (7+); bash writes plain UTF-8. Accept all three.
raw = MARKER.read_bytes() if MARKER.exists() else b""
reviewed = ""
for encoding in ("utf-8-sig", "utf-16"):
    try:
        reviewed = raw.decode(encoding).strip()
        break
    except UnicodeDecodeError:
        continue

if reviewed == head:
    sys.exit(0)

print(
    "Blocked: no review on record for HEAD.\n"
    "1. Run the `review` subagent on `git diff origin/main...HEAD`.\n"
    "2. Fix each reported defect and re-run until it reports none.\n"
    "3. Show the final review output to the user.\n"
    "4. Run: git rev-parse HEAD > .claude/.review-ok\n"
    "Then retry gh pr create.",
    file=sys.stderr,
)
sys.exit(2)
