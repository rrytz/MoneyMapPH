import { realpathSync } from "node:fs"
import { isAbsolute, relative, resolve } from "node:path"

export const ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/interactions"
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

// Containment for a caller-supplied file path: is `target` inside `root`?
//
// This is the only thing between an agent and arbitrary-file exfiltration to a
// third party -- whatever passes here is read in full and POSTed to Gemini.
// The tool's scope is the project it runs in; outside it is a refusal.
//
// Comparison is on RESOLVED paths via path.relative, never a string prefix:
// `C:\proj-evil\x.png` startsWith `C:\proj`, so a naive prefix test would
// accept a sibling directory that shares a name with the project. path.relative
// compares whole segments.
//
// Deliberately NOT a bare `rel.startsWith("..")` either: a file the project
// legitimately contains can be named `..data\x.png` and that is not an escape.
// Only a leading `..` SEGMENT is one.
//
// BOTH SIDES ARE RESOLVED, and that is not redundancy. Measured on this
// platform (Node 24.12, Windows) against a fixture of real junctions:
//
//                            junction escape   file behind a symlinked root
//   lexical only                  ACCEPTED              accepted   <- the bug
//   realpath(target) only        rejected          REJECTED      <- false reject
//   realpath(root)+realpath(t)   rejected              accepted
//
// `..` traversal and absolute paths are handled by `relative`; a symlink or
// Windows junction *inside* the project is not, because no amount of lexical
// segment comparison can see through one. A junction inside the project
// pointing outside therefore passed the lexical guard, and the file it reached
// was read and uploaded. This is not hypothetical here: `obsidian/` in this
// repository is a junction, so symlinked project trees are the normal case
// rather than an exotic one.
//
// One-sided resolution is the trap, and it is a trap in BOTH directions:
// resolving only the target pins the target's real location against a root
// still in its junction spelling, so a project reached through a junction has
// its own files compared against its own directory and every one of them is
// declared an escape. That is the "would break legitimately symlinked project
// trees" objection, and measurement says the objection is right about the
// symptom and wrong about the cause -- it is the one-sided form that breaks,
// so do not "simplify" this back to a single realpath call.
//
// KNOWN LIMIT, stated rather than implied: `realpathSync` throws ENOENT for a
// path that does not exist, so a missing target falls back to the lexical
// spelling. That is deliberate -- it is what keeps a plainly-missing file
// reporting "not found" instead of being mislabelled an escape -- and it is
// not a hole, because a path that does not exist is refused by the existence
// check immediately after this one, before anything is read. A missing file
// reached through an escaping junction is likewise not readable.
function realPathOrLexical(p: string): string {
  try {
    return realpathSync(p)
  } catch {
    return resolve(p)
  }
}

export function containsPath(root: string, target: string): boolean {
  // Resolve BOTH sides. See the note above realPathOrLexical for why one side
  // is not enough -- it breaks in the opposite direction.
  const rel = relative(realPathOrLexical(root), realPathOrLexical(target))
  // Empty means target === root. Inside by definition; the is-a-file check
  // downstream rejects it on its own merits.
  if (rel === "") return true
  // relative() returns an absolute path when the two are on different drives,
  // or one is UNC. That is never "inside" a local root.
  if (isAbsolute(rel)) return false
  const [firstSegment] = rel.split(/[\\/]/)
  return firstSegment !== ".."
}

// Both body reads need this, not just the error path: a 200 whose transfer is
// cut short mid-image (a multi-megabyte base64 payload) makes response.text()
// reject with a bare TypeError carrying no kind, and the caller that branches
// on err.kind would see undefined -- the exact outcome this library exists to
// prevent. The error path degrades the text into its message; the success path
// has no message left to show, so it throws.
type BodyRead =
  | { ok: true; text: string }
  | { ok: false; reason: string }

async function readBody(response: Response): Promise<BodyRead> {
  try {
    return { ok: true, text: await response.text() }
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    }
  }
}

// A swallowed read produces a failure message that names nothing -- and
// "the body was empty" and "the body could not be read" are different facts,
// so this reports which one happened instead of collapsing both to "".
async function readErrorBody(response: Response): Promise<string> {
  const read = await readBody(response)
  return read.ok ? read.text : `(error body could not be read: ${read.reason})`
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
  let response: Response
  try {
    response = await doFetch(ENDPOINT, {
      method: "POST",
      headers: {
        "x-goog-api-key": opts.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildRequestBody({ ...opts, model })),
    })
  } catch (err) {
    // DNS failure, TLS error, offline machine: fetch rejects before any
    // response exists, so there is no status to report -- only the transport.
    throw new NanoBananaError(
      "http-error",
      `No response from ${ENDPOINT}: ${
        err instanceof Error ? err.message : String(err)
      }`
    )
  }

  if (!response.ok) {
    const body = await readErrorBody(response)
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

  // A 200 with a non-JSON body is a real possibility -- a corporate proxy
  // interstitial or a WAF challenge page -- and response.json() would surface
  // it as a bare SyntaxError with no kind and no hint what was actually found.
  // The read itself can also fail (truncated transfer), which is the same
  // failure to a caller: nothing readable and no kind.
  const read = await readBody(response)
  if (!read.ok) {
    throw new NanoBananaError(
      "http-error",
      `Gemini returned ${response.status} but the body could not be read ` +
        `(content-type: ${
          response.headers.get("content-type") ?? "(none)"
        }). ${read.reason}`
    )
  }
  const text = read.text
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new NanoBananaError(
      "http-error",
      `Gemini returned ${response.status} with a body that is not JSON ` +
        `(content-type: ${response.headers.get("content-type") ?? "(none)"}). ` +
        `First 500 chars: ${text.slice(0, 500) || "(empty body)"}`
    )
  }

  const parsed = parseInteraction(json)
  // Buffer is already a Uint8Array; wrapping it copied the whole image for
  // nothing. A hand-rolled base64 decoder was rejected instead -- it throws
  // InvalidCharacterError on invalid input, a third untyped failure path.
  // Note: for inputs under Buffer.poolSize>>>1 this is a view onto Node's
  // shared pool, so .buffer spans more than these bytes -- honour byteOffset
  // and byteLength rather than the whole .buffer.
  const bytes = Buffer.from(parsed.data, "base64")

  if (bytes.length === 0) {
    throw new NanoBananaError(
      "empty-image",
      `output_image.data decoded to 0 bytes (${parsed.data.length} base64 chars). Nothing was written to disk.`
    )
  }

  return { bytes, mimeType: parsed.mimeType, model }
}
