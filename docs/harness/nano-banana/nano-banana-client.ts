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