#!/usr/bin/env python3
"""Generate changelog from conventional commits between two refs.

Usage:
    python scripts/generate_changelog.py v1.0.0 v1.1.0
    python scripts/generate_changelog.py v1.0.0          # v1.0.0 to HEAD
    python scripts/generate_changelog.py                  # latest tag to HEAD
"""

import subprocess
import sys
import re
from datetime import datetime

# Commit type display order and labels
TYPE_ORDER = [
    ("feat", "✨ Features"),
    ("fix", "🐛 Bug Fixes"),
    ("perf", "⚡ Performance"),
    ("refactor", "♻️ Refactor"),
    ("docs", "📝 Documentation"),
    ("build", "📦 Build"),
    ("ci", "🔧 CI"),
    ("test", "🧪 Tests"),
    ("chore", "🏠 Chores"),
]

SCOPE_PATTERN = re.compile(r"^(\w+)(?:\(([^)]+)\))?(!)?: (.+)$")


def git(*args: str) -> str:
    result = subprocess.run(
        ["git", *args],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    return result.stdout.strip()


def get_latest_tag() -> str | None:
    tag = git("describe", "--tags", "--abbrev=0")
    return tag if tag else None


def get_commits(from_ref: str, to_ref: str) -> list[dict]:
    """Get commits between two refs, newest first."""
    log_format = "%H|%s|%an|%ai"
    raw = git("log", f"{from_ref}..{to_ref}", f"--pretty=format:{log_format}")
    if not raw:
        return []

    commits = []
    for line in raw.splitlines():
        parts = line.split("|", 3)
        if len(parts) < 4:
            continue
        sha, subject, author, date = parts
        parsed = SCOPE_PATTERN.match(subject)
        if parsed:
            ctype, scope, bang, description = parsed.groups()
            commits.append({
                "sha": sha[:8],
                "type": ctype,
                "scope": scope,
                "breaking": bang == "!",
                "description": description,
                "author": author,
                "date": date[:10],
            })
        else:
            # Non-conventional commit — skip or show as misc
            commits.append({
                "sha": sha[:8],
                "type": None,
                "scope": None,
                "breaking": False,
                "description": subject,
                "author": author,
                "date": date[:10],
            })
    return commits


def generate_markdown(commits: list[dict], from_ref: str, to_ref: str) -> str:
    """Generate markdown changelog grouped by type."""
    lines = []

    # Group by type
    grouped: dict[str, list[dict]] = {}
    for c in commits:
        t = c["type"] or "other"
        grouped.setdefault(t, []).append(c)

    # Breaking changes section
    breaking = [c for c in commits if c["breaking"]]
    if breaking:
        lines.append("## ⚠️ Breaking Changes\n")
        for c in breaking:
            scope = f"**{c['scope']}**: " if c["scope"] else ""
            lines.append(f"- {scope}{c['description']} (`{c['sha']}`)")
        lines.append("")

    # Typed sections
    for type_key, label in TYPE_ORDER:
        items = grouped.pop(type_key, [])
        if not items:
            continue
        lines.append(f"## {label}\n")
        for c in items:
            scope = f"**{c['scope']}**: " if c["scope"] else ""
            lines.append(f"- {scope}{c['description']} (`{c['sha']}`)")
        lines.append("")

    # Remaining (non-conventional)
    other = grouped.get("other", [])
    if other:
        lines.append("## Other Changes\n")
        for c in other:
            lines.append(f"- {c['description']} (`{c['sha']}`)")
        lines.append("")

    return "\n".join(lines)


def main():
    # Ensure UTF-8 output on Windows
    import io
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    else:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    args = sys.argv[1:]

    if len(args) >= 2 and args[0]:
        from_ref, to_ref = args[0], args[1]
    elif len(args) == 1 and args[0]:
        from_ref, to_ref = args[0], "HEAD"
    else:
        latest = get_latest_tag()
        if latest:
            from_ref, to_ref = latest, "HEAD"
        else:
            # No tags yet — find the root commit
            root = git("rev-list", "--max-parents=0", "HEAD")
            from_ref, to_ref = root, "HEAD"

    commits = get_commits(from_ref, to_ref)
    if not commits:
        print(f"No commits found between {from_ref} and {to_ref}")
        sys.exit(0)

    md = generate_markdown(commits, from_ref, to_ref)

    # Header
    tag_display = to_ref if to_ref != "HEAD" else get_latest_tag() or "latest"
    header = f"# Changelog {tag_display}\n\n"
    date_str = datetime.now().strftime("%Y-%m-%d")
    header += f"*Released on {date_str}*\n\n"
    header += f"Full diff: [{from_ref}...{to_ref}](../compare/{from_ref}...{to_ref})\n\n"
    header += "---\n\n"

    print(header + md)


if __name__ == "__main__":
    main()
