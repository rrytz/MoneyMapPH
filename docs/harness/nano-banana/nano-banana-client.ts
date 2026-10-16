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
