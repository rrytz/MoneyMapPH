# Impeccable skill — install & usage

The [impeccable](https://github.com/impeccable-ai/impeccable) skill is the
frontend-design/audit skill used by the emerald-ledger redesign work, and its
bundled `detect` CLI is a hard gate check per slice
(`impeccable.cmd detect --json <targets>`, see
`docs/superpowers/plans/2026-09-22-emerald-ledger-redesign.md`).

It is **self-contained**: `SKILL.md` + a launcher (`scripts/impeccable.cmd`)
+ a bundled native binary (`scripts/bin/windows-x64/impeccable.exe` for this
machine). **No Node runtime or npm install is required** — the launcher runs
the binary directly.

## Where OpenCode discovers skills (V2)

| Scope | Location |
|---|---|
| Global | `~/.config/opencode/skills/<skill-id>/` |
| Project | `.opencode/skills/<skill-id>/` (search walks up to the project root) |

Precedence: project scope wins over global. Identical copies in both scopes
are harmless (same content, project one loads).

## Install

### Global (available in every project) — done on this machine

```powershell
# From this repo (or any copy of the skill):
$dest = Join-Path $env:USERPROFILE ".config\opencode\skills"
New-Item -ItemType Directory -Path $dest -Force | Out-Null
Copy-Item -Path ".opencode\skills\impeccable" -Destination (Join-Path $dest "impeccable") -Recurse -Force
```

This repo still carries its own copy at `.opencode/skills/impeccable/`, which
wins on a per-project basis in this checkout; other projects use the global one.

### Per-project (fallback if global is missing)

Just keep (or re-copy) the `impeccable/` folder under `.opencode/skills/` —
auto-discovered. No config file entry needed for the standard locations.

## Verify

```powershell
# Global copy:
& "$env:USERPROFILE\.config\opencode\skills\impeccable\scripts\impeccable.cmd" --version
# Project copy:
& ".opencode\skills\impeccable\scripts\impeccable.cmd" --version
```

Both report the binary build version. **Version drift is normal upstream
metadata, not a broken install**: `--version` reports the bundled binary
build (e.g. `4.0.0`), while `SKILL.md` frontmatter may declare a newer skill
version (e.g. `4.3.1`) and `scripts/VERSION` a track file (`0.1.5`). What
matters is that the launcher runs and `detect` exits 0.

## Usage

1. Per session, the skill's Setup step runs
   `<skill-base-dir>/scripts/impeccable context` once (base dir resolves
   wherever `SKILL.md` lives).
2. Gate check (this repo):

   ```powershell
   & "$env:USERPROFILE\.config\opencode\skills\impeccable\scripts\impeccable.cmd" detect --json <target files>
   ```

   Exit 0 + no anti-patterns = green (advisory notes are non-blocking).

## Notes / caveats

- The skill's `allowed-tools` frontmatter lists both
  `Bash(npx impeccable *)` and
  `Bash(.opencode/skills/impeccable/scripts/impeccable *)` — the latter is a
  project-path fallback; the launcher resolves `<skill-base-dir>` dynamically,
  so global copies work identically.
- On a fresh machine/clone, re-run the global copy step above once (the skill
  is ~16 MB, 52 files); project-local copies are also fine for one-off work.