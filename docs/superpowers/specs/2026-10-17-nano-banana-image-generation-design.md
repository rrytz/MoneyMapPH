# Nano Banana image generation for OpenCode — design

**Date:** 2026-10-17
**Status:** approved for planning
**Scope:** harness tooling (`~/.config/opencode`), not application code

## Problem

The user wants image generation available inside OpenCode, writing assets into the
repository. Google AI Studio plans include Nano Banana, but that benefit is
**AI-Studio-UI-only** — Google's documentation states direct Gemini API use is
billed and managed separately. So the user's Google AI subscription cannot be
used here.

Nano Banana is also **absent from OpenCode's `google` provider catalog**. The
provider lists 7 models (Gemini text, Veo video, Lyria music, Gemma) and no image
model. Configuring a provider cannot produce this capability; a tool must call
the Gemini image API directly.

A credential exists (`google` / `Google 2`, `active=1` in the `credential` table
of `opencode.db`), but this design deliberately does **not** read it. See
*Credential handling*.

## Model selection

From the Gemini API model list, verified 2026-10-17:

| Model | Endpoint | Role |
|---|---|---|
| Nano Banana 2.1 | `gemini-nano-banana-2.1` | **Default** |
| Nano Banana 2 Lite | `gemini-3.1-flash-lite-image` | Cheap fast drafts |
| Nano Banana Pro | `gemini-3-pro-image` | 4K, studio layouts, precise text |
| Nano Banana (original) | `gemini-2.5-flash-image` | Legacy; access restricted. Not used. |

Default is 2.1 (new stable, best quality and typography). The others are
selectable per call.

## Architecture

Three files in `~/.config/opencode/`, mirroring the existing
`tools/changed-files.ts` → `plugins/lib/changed-files-store.ts` split already in
place:

```
tools/nano-banana.ts              thin OpenCode wiring, no logic
plugins/lib/nano-banana-client.ts pure: no OpenCode imports, no filesystem
commands/nanobanana.md            slash command wrapper
```

The lib exposes `generate({prompt, inputImage, model}, fetchImpl)` returning
`{bytes, mime}`. Injecting `fetch` is what makes the parsing and error paths
testable without network access — that is the entire reason for the split, since
malformed-response handling is what actually breaks when a provider changes a
response shape.

## Tool interface

| Arg | Required | Meaning |
|---|---|---|
| `prompt` | yes | what to generate, or what to change |
| `inputImage` | no | path to an existing image; presence switches generate → edit |
| `model` | no | defaults to `gemini-nano-banana-2.1` |
| `name` | no | output filename stem |

One tool, two modes. A separate edit tool would duplicate the entire argument
list, model selection, and output handling.

Returns the written path, byte count, mime type, and model used.

## Invocation

- **Command** `/nanobanana` — the user runs it; explicit, visible cost.
- **Tool** — the agent may call it, **gated behind an approval prompt** so it
  cannot spend API quota without consent.

### UNRESOLVED — must be verified before implementation

The V2 permission documentation specifies an ordered `permissions` array with
string action names and notes *"V1 uses different field and action names."*

The installed OpenCode is **1.18.29, which is V1**, and its global config uses the
V1 shape (`"permission": { "mcp_*": "ask" }`), not V2's `permissions` array. The
V2 docs also do not clearly document the permission action name for a *custom*
tool (only `<server>_<tool>` for MCP tools, and a note that plugins may define
further actions).

**Therefore:** the exact rule that gates this tool on 1.18.29 is unknown. It must
be confirmed against V1 documentation or a live experiment *before* any gating
config is written. Do not transliterate the V2 example — that risks a rule that
silently never fires, which is worse than no rule because it reads as coverage.

## Output location

`assets/generated/` at project root.

Not `public/`. `public/` holds PWA icons and splash screens that ship to users
and get bundled by Next.js; generated drafts have no business being web-served.
`assets/generated/` is committed deliberately.

Filenames are slugified from `name`, plus the extension implied by the returned
mime type.

## Credential handling

`GEMINI_API_KEY` read from the process environment.

Rejected alternative: reading the existing key from OpenCode's `credential`
table. It would avoid duplicating a secret, but a tool reaching into a private
315MB SQLite database couples the harness to an undocumented internal schema. If
OpenCode changes that schema, the tool fails in a way that looks like "Google
rejected your key" — a misleading error at the worst possible moment.

Set the variable as a **Windows user environment variable**, not via
`opencode service set env`, so the key never enters PowerShell history.

## Failure handling

| Condition | Behaviour |
|---|---|
| `GEMINI_API_KEY` absent | Fail with the exact setup command. Never no-op. |
| HTTP 429 | Surface rate-limit text and retry-after. Do not retry blind. |
| HTTP 4xx | Fail loudly. Do not retry, do not swallow. |
| Response contains no image part | Report the field names actually present, not a generic failure. |
| Zero-byte result | Refuse to leave the file on disk. |

The last two rows are the point of the split. A tool that writes a 0-byte PNG and
reports success is a verifier that cannot report its own emptiness — the failure
mode this repository's `AGENTS.md` documents repeatedly. Each of these paths must
assert on what it found before reporting on it.

## Testing

Unit tests against the lib with an injected stub `fetch`. No network.

Covered: happy path generate; happy path edit; HTTP 429; HTTP 4xx; malformed
response with no image part; missing `GEMINI_API_KEY`.

Plus one **live smoke test, run manually**, to prove real wiring. A unit test
cannot verify the credential, the endpoint, or the actual response shape — only a
real call can, and only the user can authorise spending on it.

## Out of scope

Batching, upscaling, style presets, automatic git commit of results, image
metadata editing, and non-Google providers.

## Open questions for the user

None blocking. If the V1 permission investigation (above) shows custom tools
cannot be gated, the fallback is to expose the tool to the command only and have
the agent shell out to the command — at the cost of the agent being able to invoke
it without approval, which is the outcome to avoid.