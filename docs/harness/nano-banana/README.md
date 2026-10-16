# nano-banana harness files

Backup of record and restore instructions for the Nano Banana OpenCode tool.

## Why this copy exists

These files **run** from `~/.config/opencode/`, which is:

- **not a git repository**, so there is no version history there; and
- **ECC-managed** — `ecc-install-state.json` tracks every file in `tools/` and
  `plugins/lib/` as installed from `ecc-universal`.

An `ecc repair` or an ECC update can overwrite or delete these files. This
directory is the recovery path.

## Deploy map

| Repo file | Deploy to |
|---|---|
| `nano-banana-client.ts` | `~/.config/opencode/plugins/lib/` |
| `nano-banana-client.test.ts` | `~/.config/opencode/plugins/lib/` |
| `path-containment.ts` | `~/.config/opencode/plugins/lib/` |
| `nano-banana-containment.test.ts` | `~/.config/opencode/plugins/lib/` |
| `nano-banana.ts` | `~/.config/opencode/tools/` |
| `nanobanana.md` | `~/.config/opencode/commands/` |

Omitting `path-containment.ts` leaves `nano-banana.ts` unable to resolve its own
import at load time. It is not optional.

## Restore

```powershell
$src = ".\"
$dst = "$env:USERPROFILE\.config\opencode"
Copy-Item "$src\nano-banana-client.ts"       "$dst\plugins\lib\" -Force
Copy-Item "$src\nano-banana-client.test.ts"  "$dst\plugins\lib\" -Force
Copy-Item "$src\path-containment.ts"         "$dst\plugins\lib\" -Force
Copy-Item "$src\nano-banana-containment.test.ts" "$dst\plugins\lib\" -Force
Copy-Item "$src\nano-banana.ts"              "$dst\tools\" -Force
Copy-Item "$src\nanobanana.md"               "$dst\commands\" -Force
```

Then re-check the permission gate in `~/.config/opencode/opencode.json`. It is
**unversioned and unrecoverable from this repo** — an ECC rewrite of that file
drops the line with nothing in-repo recording that it must exist:

```json
"permission": {
  "mcp_*": "ask",
  "nano-banana": "ask"
}
```

## Credential

**No API key is stored here.** `GEMINI_API_KEY` must be set in the Windows
environment (System Properties > Environment Variables > User variables).

It is deliberately **not** read from OpenCode's `credential` table. Coupling
the tool to an undocumented internal schema would break on upgrade, and it
would fail in a way that looks like "Google rejected your key".

Never set it with `opencode service set env` or a `$env:` assignment — both
write the key into PowerShell history.

## Tests

```powershell
node --test "docs\harness\nano-banana\*.test.ts"
```

47 tests. No network. Note the **glob form is required** — passing a bare
directory fails on Node 24.12 with `MODULE_NOT_FOUND`.

## Known-benign warning

`MODULE_TYPELESS_PACKAGE_JSON` appears on load, because the nearest
`package.json` sets no `"type": "module"`. It affects parse performance only,
not correctness. Expected noise, not a regression.

## Design notes

- The client library is **pure by convention**: zero imports, no filesystem, no
  `process`. That is what lets its suite run as pure unit tests against a stubbed
  `fetch`. Nothing fails if `node:fs` returns to it — verify, don't assume.
- `inputImage` is contained to the project directory via **both-sided**
  `realpathSync`. One-sided resolution is the trap: it falsely rejects
  legitimate files reached through a symlinked tree. This repo's `obsidian/` is
  a Junction, so symlinked trees are not hypothetical here.
- `http-error` is a **category, not a diagnosis** — it is reachable from three
  distinct causes. Read `err.message` for detail.