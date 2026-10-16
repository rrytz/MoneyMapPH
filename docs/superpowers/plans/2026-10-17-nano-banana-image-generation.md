# Nano Banana Image Generation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give OpenCode a gated image-generation tool backed by Gemini's Nano Banana models, writing PNG/JPEG output into `assets/generated/` in the active project.

**Architecture:** Two files in `~/.config/opencode/`. A pure client library (`plugins/lib/nano-banana-client.ts`) with no OpenCode imports and an injectable `fetch`, wrapped by a thin tool (`tools/nano-banana.ts`) that handles filesystem and naming only. The filename becomes the tool name, so `nano-banana.ts` registers as tool `nano-banana`, which is the key used in the V1 `permission` block that gates it behind approval.

**Tech Stack:** TypeScript (native type stripping), Node 24.12 `node --test`, OpenCode plugin SDK `@opencode-ai/plugin@1.18.29`, Gemini REST API v1beta `interactions` endpoint.

## Global Constraints

- **OpenCode version is 1.18.29 (V1 line), not V2.** Use the V1 `permission` object keyed by tool name. Do NOT use the V2 `permissions` array syntax.
- **V1 default for most permissions is `allow`.** The gate is load-bearing, not decorative. Without it the tool spends paid API quota silently.
- **API key comes from the `GEMINI_API_KEY` environment variable only.** Do not read OpenCode's `credential` table, and do not write the key into any file.
- **Never put the key on a command line.** It must not appear in shell history. Set it as a Windows user environment variable.
- **Endpoint:** `POST https://generativelanguage.googleapis.com/v1beta/interactions`
- **Auth header:** `x-goog-api-key: <key>`
- **Default model:** `gemini-nano-banana-2.1`
- **Output directory:** `assets/generated/` resolved relative to `context.directory`. Never write into `public/`.
- **Never leave a zero-byte image on disk.**
- **Error messages must report what was actually found**, never a generic failure string.
- Test runner is `node --test`, verified working with `.ts` imports on node 24.12. There is no `bun` on PATH and no test framework installed.

---

## File Structure

> **AMENDED (pre-flight, user-approved).** This plan originally targeted
> `~/.config/opencode/` directly. Those paths are **not in a git repository**, so
> per-task commits and review diffs were impossible and Task 5's backup would
> have been the only versioned artifact. **Authoring now happens in this repo**
> under `docs/harness/nano-banana/`; the files are then **copied** to
> `~/.config/opencode/` in Task 5. The tool still runs globally — only the
> authoring location moved.

| Author here (versioned) | Deploy to (unversioned) | Responsibility |
|---|---|---|
| `docs/harness/nano-banana/nano-banana-client.ts` | `~/.config/opencode/plugins/lib/` | Pure logic: request building, response parsing, error classification, filename slugging. No OpenCode imports, no filesystem, no `process`. |
| `docs/harness/nano-banana/nano-banana-client.test.ts` | `~/.config/opencode/plugins/lib/` | Unit tests, stubbed `fetch`, no network. |
| `docs/harness/nano-banana/nano-banana.ts` | `~/.config/opencode/tools/` | OpenCode wiring: arg schema, reading the input image, writing the output file. |
| `docs/harness/nano-banana/nanobanana.md` | `~/.config/opencode/commands/` | Slash command that invokes the tool. |
| — (not authored) | `~/.config/opencode/opencode.json` | One added line: the permission gate. Edited in place by Task 3. |
| `docs/harness/nano-banana/README.md` | — | Restore instructions. |

Tasks 1, 2 and 4 author into `docs/harness/nano-banana/` and are committed here.
Task 3 edits the live global config directly and **cannot** be committed — take
the `.bak-nanobanana` backup it mandates. Task 5 copies Tasks 1/2/4 into place
and adds the README.

`~/.config/opencode/` remains **ECC-managed** (`ecc-install-state.json` tracks
every file in `tools/` and `plugins/lib/` as installed from `ecc-universal`), so
the in-repo copy is also the recovery path after an `ecc repair`.

---

### Task 1: Client library

**Files:**
- Create: `docs/harness/nano-banana/nano-banana-client.ts`
- Test: `docs/harness/nano-banana/nano-banana-client.test.ts`

Both land side by side, so the test's `./nano-banana-client.ts` import resolves in-repo. This task does **not** touch `~/.config/opencode/`.

**Interfaces:**
- Consumes: nothing. This is the base unit.
- Produces:
  - `class NanoBananaError extends Error` with a `kind` property. `kind` is one of `"missing-credential" | "rate-limited" | "http-error" | "no-image-in-response" | "empty-image"`.
  - `const ENDPOINT: string`
  - `const DEFAULT_MODEL: string`
  - `type InputImage = { data: string; mimeType: string }` — `data` is base64, no data-URL prefix.
  - `type GenerateOptions = { prompt: string; apiKey: string; model?: string; inputImage?: InputImage; mimeType?: string; aspectRatio?: string; imageSize?: string; fetchImpl?: typeof fetch }`
  - `type GeneratedImage = { bytes: Uint8Array; mimeType: string; model: string }`
  - `function buildRequestBody(opts: GenerateOptions): Record<string, unknown>`
  - `function parseInteraction(json: unknown): { data: string; mimeType: string }`
  - `function extensionFor(mimeType: string): string`
  - `function slugify(name: string): string`
  - `function generateImage(opts: GenerateOptions): Promise<GeneratedImage>`

- [ ] **Step 1: Write the failing test file**

Create `~/.config/opencode/plugins/lib/nano-banana-client.test.ts`:

```typescript
import { test, describe } from "node:test"
import assert from "node:assert/strict"
import {
  DEFAULT_MODEL,
  ENDPOINT,
  NanoBananaError,
  buildRequestBody,
  extensionFor,
  generateImage,
  parseInteraction,
  slugify,
} from "./nano-banana-client.ts"

const PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

describe("buildRequestBody", () => {
  test("sends a text-only input array for generate", () => {
    const body = buildRequestBody({ prompt: "a red cube", apiKey: "k" })
    assert.equal(body.model, DEFAULT_MODEL)
    assert.deepEqual(body.input, [{ type: "text", text: "a red cube" }])
  })

  test("appends an image part when inputImage is supplied", () => {
    const body = buildRequestBody({
      prompt: "make it blue",
      apiKey: "k",
      inputImage: { data: "QUJD", mimeType: "image/png" },
    })
    const input = body.input as Array<Record<string, unknown>>
    assert.equal(input.length, 2)
    assert.deepEqual(input[1], {
      type: "image",
      data: "QUJD",
      mime_type: "image/png",
    })
  })

  test("text part comes first so it is read before the image", () => {
    const body = buildRequestBody({
      prompt: "make it blue",
      apiKey: "k",
      inputImage: { data: "QUJD", mimeType: "image/png" },
    })
    const input = body.input as Array<Record<string, unknown>>
    assert.equal(input[0].type, "text")
  })
})

describe("parseInteraction", () => {
  test("returns base64 data and mime type on a well-formed response", () => {
    const parsed = parseInteraction({
      output_image: { data: PNG_B64, mime_type: "image/png" },
    })
    assert.equal(parsed.data, PNG_B64)
    assert.equal(parsed.mimeType, "image/png")
  })

  test("defaults mime type to image/png when absent", () => {
    const parsed = parseInteraction({ output_image: { data: PNG_B64 } })
    assert.equal(parsed.mimeType, "image/png")
  })

  test("throws no-image-in-response and names the keys actually present", () => {
    assert.throws(
      () => parseInteraction({ candidates: [], promptFeedback: {} }),
      (err: unknown) => {
        assert.ok(err instanceof NanoBananaError)
        assert.equal(err.kind, "no-image-in-response")
        assert.match(err.message, /candidates/)
        assert.match(err.message, /promptFeedback/)
        return true
      }
    )
  })

  test("throws rather than returning empty data", () => {
    assert.throws(
      () => parseInteraction({ output_image: { data: "" } }),
      (err: unknown) =>
        err instanceof NanoBananaError && err.kind === "no-image-in-response"
    )
  })
})

describe("extensionFor", () => {
  test("maps png to .png and jpeg to .jpg", () => {
    assert.equal(extensionFor("image/png"), ".png")
    assert.equal(extensionFor("image/jpeg"), ".jpg")
  })

  test("falls back to .png for an unknown mime type", () => {
    assert.equal(extensionFor("image/webp"), ".png")
  })
})

describe("slugify", () => {
  test("lowercases and hyphenates", () => {
    assert.equal(slugify("My Great Logo"), "my-great-logo")
  })

  test("strips characters that are unsafe in a filename", () => {
    assert.equal(slugify("A/B: C?D"), "a-b-c-d")
  })

  test("returns image when the name slugifies to nothing", () => {
    assert.equal(slugify("///"), "image")
  })
})

describe("generateImage", () => {
  test("throws missing-credential when apiKey is empty", async () => {
    await assert.rejects(
      generateImage({ prompt: "x", apiKey: "" }),
      (err: unknown) =>
        err instanceof NanoBananaError && err.kind === "missing-credential"
    )
  })

  test("posts to the interactions endpoint with the key header", async () => {
    let seenUrl = ""
    let seenKey = ""
    const fetchImpl = (async (url: string, init: RequestInit) => {
      seenUrl = String(url)
      seenKey = (init.headers as Record<string, string>)["x-goog-api-key"]
      return jsonResponse({ output_image: { data: PNG_B64, mime_type: "image/png" } })
    }) as unknown as typeof fetch

    await generateImage({ prompt: "a red cube", apiKey: "secret", fetchImpl })
    assert.equal(seenUrl, ENDPOINT)
    assert.equal(seenKey, "secret")
  })

  test("returns decoded bytes on success", async () => {
    const fetchImpl = (async () =>
      jsonResponse({
        output_image: { data: PNG_B64, mime_type: "image/png" },
      })) as unknown as typeof fetch

    const result = await generateImage({
      prompt: "a red cube",
      apiKey: "k",
      fetchImpl,
    })
    assert.ok(result.bytes.length > 0)
    assert.equal(result.mimeType, "image/png")
    assert.equal(result.model, DEFAULT_MODEL)
  })

  test("classifies 429 as rate-limited and includes the body", async () => {
    const fetchImpl = (async () =>
      new Response("quota exhausted for this project", {
        status: 429,
        headers: { "content-type": "text/plain" },
      })) as unknown as typeof fetch

    await assert.rejects(
      generateImage({ prompt: "x", apiKey: "k", fetchImpl }),
      (err: unknown) => {
        assert.ok(err instanceof NanoBananaError)
        assert.equal(err.kind, "rate-limited")
        assert.match(err.message, /quota exhausted/)
        return true
      }
    )
  })

  test("classifies 400 as http-error and does not retry", async () => {
    let calls = 0
    const fetchImpl = (async () => {
      calls += 1
      return new Response("API key not valid", { status: 400 })
    }) as unknown as typeof fetch

    await assert.rejects(
      generateImage({ prompt: "x", apiKey: "bad", fetchImpl }),
      (err: unknown) => {
        assert.ok(err instanceof NanoBananaError)
        assert.equal(err.kind, "http-error")
        assert.match(err.message, /API key not valid/)
        return true
      }
    )
    assert.equal(calls, 1)
  })

  test("throws empty-image when the payload decodes to zero bytes", async () => {
    const fetchImpl = (async () =>
      jsonResponse({ output_image: { data: "", mime_type: "image/png" } })) as unknown as typeof fetch

    await assert.rejects(
      generateImage({ prompt: "x", apiKey: "k", fetchImpl }),
      (err: unknown) => {
        assert.ok(err instanceof NanoBananaError)
        return ["no-image-in-response", "empty-image"].includes(err.kind)
      }
    )
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
node --test "C:\Users\RITZ\.config\opencode\plugins\lib\nano-banana-client.test.ts"
```

Expected: FAIL with `Cannot find module` / `ERR_MODULE_NOT_FOUND` for `nano-banana-client.ts`. The library does not exist yet.

- [ ] **Step 3: Write the implementation**

Create `~/.config/opencode/plugins/lib/nano-banana-client.ts`:

```typescript
export const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions"
export const DEFAULT_MODEL = "gemini-nano-banana-2.1"

export type NanoBananaErrorKind =
  | "missing-credential"
  | "rate-limited"
  | "http-error"
  | "no-image-in-response"
  | "empty-image"

export class NanoBananaError extends Error {
  readonly kind: NanoBananaErrorKind
  constructor(kind: NanoBananaErrorKind, message: string) {
    super(message)
    this.name = "NanoBananaError"
    this.kind = kind
  }
}

export type InputImage = { data: string; mimeType: string }

export type GenerateOptions = {
  prompt: string
  apiKey: string
  model?: string
  inputImage?: InputImage
  mimeType?: string
  aspectRatio?: string
  imageSize?: string
  fetchImpl?: typeof fetch
}

export type GeneratedImage = { bytes: Uint8Array; mimeType: string; model: string }

const MIME_EXTENSIONS: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
}

export function buildRequestBody(opts: GenerateOptions): Record<string, unknown> {
  const input: Array<Record<string, unknown>> = [
    { type: "text", text: opts.prompt },
  ]
  if (opts.inputImage) {
    input.push({
      type: "image",
      data: opts.inputImage.data,
      mime_type: opts.inputImage.mimeType,
    })
  }

  const body: Record<string, unknown> = {
    model: opts.model ?? DEFAULT_MODEL,
    input,
  }

  if (opts.mimeType || opts.aspectRatio || opts.imageSize) {
    body.response_format = {
      type: "image",
      ...(opts.mimeType ? { mime_type: opts.mimeType } : {}),
      ...(opts.aspectRatio ? { aspect_ratio: opts.aspectRatio } : {}),
      ...(opts.imageSize ? { image_size: opts.imageSize } : {}),
    }
  }

  return body
}

// Reports the keys that were actually present. A generic "generation failed"
// string cannot tell the caller whether the model refused, returned prose, or
// changed shape -- and "found nothing" and "nothing exists" are not the same
// answer.
export function parseInteraction(
  json: unknown
): { data: string; mimeType: string } {
  const outputImage =
    json && typeof json === "object"
      ? (json as Record<string, unknown>).output_image
      : undefined

  const data =
    outputImage && typeof outputImage === "object"
      ? (outputImage as Record<string, unknown>).data
      : undefined

  if (typeof data !== "string" || data.length === 0) {
    const keys =
      json && typeof json === "object" ? Object.keys(json as object) : []
    throw new NanoBananaError(
      "no-image-in-response",
      `Response contained no output_image.data. Top-level keys present: ${
        keys.length > 0 ? keys.join(", ") : "(none - response was not an object)"
      }`
    )
  }

  const rawMime =
    outputImage && typeof outputImage === "object"
      ? (outputImage as Record<string, unknown>).mime_type
      : undefined

  return {
    data,
    mimeType: typeof rawMime === "string" ? rawMime : "image/png",
  }
}

export function extensionFor(mimeType: string): string {
  return MIME_EXTENSIONS[mimeType] ?? ".png"
}

export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return slug.length > 0 ? slug : "image"
}

export async function generateImage(
  opts: GenerateOptions
): Promise<GeneratedImage> {
  if (!opts.apiKey) {
    throw new NanoBananaError(
      "missing-credential",
      "GEMINI_API_KEY is not set. Set it as a Windows user environment variable " +
        "(System Properties > Environment Variables), then restart OpenCode. " +
        "Do not pass the key on a command line -- it would land in shell history."
    )
  }

  const model = opts.model ?? DEFAULT_MODEL
  const doFetch = opts.fetchImpl ?? fetch
  const response = await doFetch(ENDPOINT, {
    method: "POST",
    headers: {
      "x-goog-api-key": opts.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildRequestBody({ ...opts, model })),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    if (response.status === 429) {
      const retryAfter = response.headers.get("retry-after")
      throw new NanoBananaError(
        "rate-limited",
        `Gemini rate limit reached (429)${
          retryAfter ? `; retry after ${retryAfter}s` : ""
        }. ${body.slice(0, 500)}`
      )
    }
    throw new NanoBananaError(
      "http-error",
      `Gemini API returned ${response.status} ${response.statusText}. ${body.slice(0, 500)}`
    )
  }

  const json = await response.json()
  const parsed = parseInteraction(json)
  const bytes = new Uint8Array(Buffer.from(parsed.data, "base64"))

  if (bytes.length === 0) {
    throw new NanoBananaError(
      "empty-image",
      `output_image.data decoded to 0 bytes (${parsed.data.length} base64 chars). Nothing was written to disk.`
    )
  }

  return { bytes, mimeType: parsed.mimeType, model }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```powershell
node --test "C:\Users\RITZ\.config\opencode\plugins\lib\nano-banana-client.test.ts"
```

Expected: `# pass 18`, `# fail 0`. If any fail, read the failure text before changing anything — a failure here means the client mis-parses or mis-classifies, which is exactly what the split exists to surface.

- [ ] **Step 5: Record the files outside git**

`~/.config/opencode/` is not a git repository. Do not run `git add` here. Task 5 copies these files into the money-manager repo as a backup of record.

---

### Task 2: Tool wiring

**Files:**
- Create: `docs/harness/nano-banana/nano-banana.ts`

**Import-path caveat (consequence of authoring in-repo):** the tool imports the
lib as `../plugins/lib/nano-banana-client.ts`, which is correct **after** the
Task 5 copy into `~/.config/opencode/tools/`. In the repo it does not resolve,
and it is not meant to — the repo copy is a backup, deployed verbatim. Therefore
**Step 2 below cannot run in-repo**; it is deferred to Task 5, where the file is
in its real location. Do not "fix" the import to `./nano-banana-client.ts` —
that would break the deployed copy.

**Interfaces:**
- Consumes: `generateImage`, `extensionFor`, `slugify`, `NanoBananaError`, `InputImage` from `../plugins/lib/nano-banana-client.ts`.
- Produces: OpenCode tool named `nano-banana` (name is derived from the filename). Args: `prompt` (string, required), `inputImage` (string, optional path), `model` (string, optional), `name` (string, optional filename stem), `mimeType` (enum, optional), `aspectRatio` (enum, optional), `imageSize` (enum, optional).

- [ ] **Step 1: Create the tool file**

Create `~/.config/opencode/tools/nano-banana.ts`:

```typescript
import { tool } from "@opencode-ai/plugin/tool"
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { extname, isAbsolute, join, resolve } from "node:path"
import {
  DEFAULT_MODEL,
  NanoBananaError,
  extensionFor,
  generateImage,
  slugify,
} from "../plugins/lib/nano-banana-client.ts"

const OUTPUT_DIR = "assets/generated"

const INPUT_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
}

export default tool({
  description:
    "Generate or edit an image with Google's Nano Banana models and save it to " +
    "assets/generated/. Use inputImage to edit an existing image; omit it to " +
    "generate from the prompt alone. Costs paid API quota, so only call when " +
    "the user has asked for an image.",
  args: {
    prompt: tool.schema
      .string()
      .describe("What to generate, or what to change about the input image"),
    inputImage: tool.schema
      .string()
      .optional()
      .describe("Path to an existing image to edit. Omit to generate from scratch."),
    model: tool.schema
      .enum([
        "gemini-nano-banana-2.1",
        "gemini-3.1-flash-image",
        "gemini-3.1-flash-lite-image",
        "gemini-3-pro-image",
      ])
      .optional()
      .describe(`Model to use (default: ${DEFAULT_MODEL})`),
    name: tool.schema
      .string()
      .optional()
      .describe("Output filename stem, no extension (default: derived from the prompt)"),
    mimeType: tool.schema
      .enum(["image/png", "image/jpeg"])
      .optional()
      .describe("Requested output format (default: whatever the model returns)"),
    aspectRatio: tool.schema
      .enum(["1:1", "3:2", "2:3", "4:3", "3:4", "4:5", "5:4", "9:16", "16:9", "21:9"])
      .optional()
      .describe("Requested aspect ratio"),
    imageSize: tool.schema
      .enum(["1K", "2K", "4K"])
      .optional()
      .describe("Requested resolution"),
  },
  async execute(args, context) {
    const apiKey = process.env.GEMINI_API_KEY ?? ""

    let inputImage: { data: string; mimeType: string } | undefined
    if (args.inputImage) {
      const resolved = isAbsolute(args.inputImage)
        ? args.inputImage
        : resolve(context.directory, args.inputImage)

      if (!existsSync(resolved)) {
        return `inputImage not found: ${resolved}. It does not exist.`
      }
      if (!statSync(resolved).isFile()) {
        return `inputImage is not a file: ${resolved}`
      }

      const mimeType = INPUT_MIME[extname(resolved).toLowerCase()]
      if (!mimeType) {
        return `Unsupported input image type: ${extname(resolved) || "(no extension)"}. Supported: ${Object.keys(INPUT_MIME).join(", ")}`
      }

      inputImage = {
        data: readFileSync(resolved).toString("base64"),
        mimeType,
      }
    }

    const result = await generateImage({
      prompt: args.prompt,
      apiKey,
      model: args.model,
      mimeType: args.mimeType,
      aspectRatio: args.aspectRatio,
      imageSize: args.imageSize,
      inputImage,
    })

    const stem = slugify(args.name ?? args.prompt.slice(0, 60))
    const dir = join(context.directory, OUTPUT_DIR)
    mkdirSync(dir, { recursive: true })

    const file = join(dir, stem + extensionFor(result.mimeType))
    writeFileSync(file, result.bytes)

    const written = statSync(file).size
    if (written === 0) {
      throw new NanoBananaError(
        "empty-image",
        `Wrote ${file} but it is 0 bytes. Delete it and report the failure.`
      )
    }

    const rel = join(OUTPUT_DIR, stem + extensionFor(result.mimeType))
    return [
      `Generated ${rel}`,
      `model:    ${result.model}`,
      `format:   ${result.mimeType}`,
      `bytes:    ${written}`,
      inputImage ? "mode:     edit (1 input image)" : "mode:     generate",
    ].join("\n")
  },
})
```

- [ ] **Step 2: Verify the tool file parses (syntax only, no imports resolved)**

The tool's import of the lib does not resolve in-repo (see the caveat above), so
verify syntax without executing the import graph:

```powershell
cd C:\xampp\htdocs\money-manager
node --experimental-strip-types --check docs\harness\nano-banana\nano-banana.ts
```

Expected: no output, exit code 0.

This does **not** prove the tool loads inside OpenCode — that requires the
deployed location and is deferred to Task 5 Step 3.5. Say so in the report
rather than claiming the tool is verified.

- [ ] **Step 3: Confirm no barrel edit is needed**

OpenCode discovers tools by placing files in `~/.config/opencode/tools/`; the filename becomes the tool name. Do **not** edit `tools/index.ts` — that barrel belongs to ECC and rewriting it risks conflicting with `ecc repair`.

---

### Task 3: Permission gate

**Files:**
- Modify: `~/.config/opencode/opencode.json` (the `permission` block)

**Interfaces:**
- Consumes: tool name `nano-banana` from Task 2.
- Produces: an approval prompt before any Nano Banana call.

- [ ] **Step 1: Back up the config**

Run:

```powershell
Copy-Item "$env:USERPROFILE\.config\opencode\opencode.json" "$env:USERPROFILE\.config\opencode\opencode.json.bak-nanobanana" -Force
```

Expected: no output. Confirm the copy exists before continuing.

- [ ] **Step 2: Add the gate**

In `~/.config/opencode/opencode.json`, replace the existing line:

```json
  "permission": {
    "mcp_*": "ask"
  }
```

with:

```json
  "permission": {
    "mcp_*": "ask",
    "nano-banana": "ask"
  }
```

- [ ] **Step 3: Verify the JSON still parses**

Run:

```powershell
Get-Content "$env:USERPROFILE\.config\opencode\opencode.json" -Raw | ConvertFrom-Json | Out-Null; if ($?) { "JSON OK" } else { "JSON BROKEN - restore from .bak-nanobanana" }
```

Expected: `JSON OK`

- [ ] **Step 4: Confirm the gate fires**

Restart OpenCode, then ask the agent to call `nano-banana`. **An approval prompt must appear before the request is sent.**

If no prompt appears, the gate is not firing. Do not proceed — an ungated tool spends paid quota silently. Fall back to the spec's agreed fallback: delete `tools/nano-banana.ts`, leave the command as the only entry point, and record that the agent cannot generate images itself.

---

### Task 4: Slash command

**Files:**
- Create: `docs/harness/nano-banana/nanobanana.md`

Authored in-repo; copied to `~/.config/opencode/commands/` in Task 5.

**Interfaces:**
- Consumes: the `nano-banana` tool from Task 2.
- Produces: a `/nanobanana` command the user can invoke directly.

- [ ] **Step 1: Create the command file**

Create `~/.config/opencode/commands/nanobanana.md`:

```markdown
---
description: Generate or edit an image with Nano Banana and save it to assets/generated/
---

Generate or edit an image using the `nano-banana` tool.

Request: $ARGUMENTS

Work out these arguments before calling the tool, and ask the user about
anything ambiguous rather than guessing:

- `prompt` — required. Use their wording, expanded into a specific visual
  prompt only if they asked for detail.
- `inputImage` — set this only if they named an existing image to change.
  Omit it entirely for generation from scratch.
- `name` — the filename stem. Default to a short kebab-case slug of what they
  asked for. Ask before overwriting an existing file.
- `model` — default to `gemini-nano-banana-2.1`. Only change it if they asked
  for a cheaper draft (`gemini-3.1-flash-lite-image`) or 4K studio output
  (`gemini-3-pro-image`).
- `aspectRatio` / `imageSize` — set only when the intended use implies them
  (a banner is not square; print is not 1K).

After the tool returns, report the output path and format. Do not commit the
file — the user decides that.
```

- [ ] **Step 2: Verify the command is discovered**

Restart OpenCode and type `/` in the TUI.

Expected: `nanobanana` appears in the command list.

---

### Task 5: Credential, live smoke test, and backup

**Files:**
- Create (backup of record): `docs/harness/nano-banana/` in the money-manager repo

**Interfaces:**
- Consumes: everything from Tasks 1-4.
- Produces: a proven-working tool and a recoverable copy of the harness files.

- [ ] **Step 1: Set the environment variable (USER MUST DO THIS)**

This step cannot be automated. It must not be run with the key on a command
line, or it enters PowerShell history.

Tell the user, verbatim:

> Set `GEMINI_API_KEY` in Windows: System Properties > Environment Variables >
> User variables > New. Name `GEMINI_API_KEY`, value = a Gemini API key from
> https://aistudio.google.com/apikey. Do NOT run `opencode service set env` or
> any `$env:` assignment — both write the key into PowerShell history.
> Then fully quit and reopen OpenCode so the server picks up the new process
> environment.

Wait for the user to confirm. Do not proceed on an assumption.

- [ ] **Step 2: Confirm the variable reached the OpenCode server process**

Run, in a fresh PowerShell window opened *after* the variable was set:

```powershell
if ($env:GEMINI_API_KEY) { "GEMINI_API_KEY is set (length " + $env:GEMINI_API_KEY.Length + ")" } else { "NOT SET - OpenCode will inherit this empty value" }
```

Expected: `GEMINI_API_KEY is set (length NN)`.

Never print the value itself. Report only whether it is set and its length.

- [ ] **Step 3: Run the live smoke test (USER AUTHORISES THIS)**

Ask the user to run `/nanobanana` with a short prompt, for example:

> a simple flat illustration of a green piggy bank on a white background, no text

Verify all of the following yourself — do not report success from the tool's
own message alone:

```powershell
Test-Path "C:\xampp\htdocs\money-manager\assets\generated"
Get-ChildItem "C:\xampp\htdocs\money-manager\assets\generated" | Select-Object Name, Length
```

Expected: the directory exists and contains one file with `Length` greater than
0.

Also open the image and confirm it renders as an actual image, not a
zero-byte or truncated file. A file of non-zero length is not proof of a valid
image.

- [ ] **Step 4: Copy the harness files into the repo as a backup of record**

Run:

```powershell
New-Item -ItemType Directory -Force -Path "C:\xampp\htdocs\money-manager\docs\harness\nano-banana" | Out-Null
Copy-Item "$env:USERPROFILE\.config\opencode\plugins\lib\nano-banana-client.ts"      "C:\xampp\htdocs\money-manager\docs\harness\nano-banana\" -Force
Copy-Item "$env:USERPROFILE\.config\opencode\plugins\lib\nano-banana-client.test.ts" "C:\xampp\htdocs\money-manager\docs\harness\nano-banana\" -Force
Copy-Item "$env:USERPROFILE\.config\opencode\tools\nano-banana.ts"                   "C:\xampp\htdocs\money-manager\docs\harness\nano-banana\" -Force
Copy-Item "$env:USERPROFILE\.config\opencode\commands\nanobanana.md"                "C:\xampp\htdocs\money-manager\docs\harness\nano-banana\" -Force
```

Then create `docs/harness/nano-banana/README.md` containing:

```markdown
# nano-banana harness files

Backup of record for the Nano Banana OpenCode tool.

These live in `~/.config/opencode/` at runtime, which is **not** a git
repository and is **managed by ECC** (`ecc-install-state.json` tracks every
file in `tools/` and `plugins/lib/`). An `ecc repair` or ECC update can
overwrite or delete them.

Restore:

    Copy-Item .\nano-banana-client.ts      $env:USERPROFILE\.config\opencode\plugins\lib\ -Force
    Copy-Item .\nano-banana-client.test.ts $env:USERPROFILE\.config\opencode\plugins\lib\ -Force
    Copy-Item .\nano-banana.ts             $env:USERPROFILE\.config\opencode\tools\       -Force
    Copy-Item .\nanobanana.md              $env:USERPROFILE\.config\opencode\commands\   -Force

Then re-add the permission gate to `~/.config/opencode/opencode.json` if it is
missing:

    "permission": { "mcp_*": "ask", "nano-banana": "ask" }

**No API key is stored here.** `GEMINI_API_KEY` must be set in the Windows
environment; see the spec for why it is not read from OpenCode's credential
table.
```

- [ ] **Step 5: Commit the backup**

Run:

```powershell
cd C:\xampp\htdocs\money-manager
git add docs/harness/nano-banana
git commit -m "chore: back up the nano-banana harness files

These run from ~/.config/opencode/, which is not version-controlled and
is ECC-managed. Without this copy an ecc repair silently removes the
tool. No credential is included."
```

Expected: a commit adding 5 files under `docs/harness/nano-banana/`.

---

## Out of Scope

Batching, upscaling, style presets, multi-turn `previous_interaction_id`
continuity, Google Search grounding, automatic git commit of results, and any
non-Google provider.

## Risks Carried Into Implementation

1. **ECC can delete these files.** Mitigated by Task 5 Step 4.
2. **`GEMINI_API_KEY` is not set yet.** The tool fails with an actionable
   message until Task 5 Step 1 is done. That failure is by design.
3. **Two copies of the Google key now exist** — one in OpenCode's `credential`
   table, one in the Windows environment. The tool uses only the latter. The
   former is unrelated to this tool.
4. **The gate is verified by observation, not by unit test.** Only Task 3 Step 4
   proves it. If that prompt does not appear, fall back to command-only.