import { tool } from "@opencode-ai/plugin/tool"
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import { extname, isAbsolute, join, resolve } from "node:path"
import {
  DEFAULT_MODEL,
  type InputImage,
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

// Windows device names, matched against the WHOLE stem.
//
// MEASURED, and this corrects an assumption: on this machine (Node 24.12,
// Windows) `writeFileSync` did NOT reject any of `con.png`, `nul.png`,
// `aux.png`, `prn.png`, `com1.png`, `lpt1.png` -- all eight were written, read
// back through Node, and read back correctly through `cmd /c type`. So this is
// NOT a fix for an observed failure. It is cheap insurance: the classic
// breakage is a shell redirect or a DOS-path consumer, not Node's fs, and
// `slugify` can hand back "con" from a prompt as ordinary as "con manila,
// premium". If it never fires, it costs 15 lines.
//
// It lives here rather than in `slugify` because it is a filesystem rule, not
// a naming rule, and `slugify` is Task 1's committed, 28-test contract.
//
// `CLOCK$`, `CONIN$` and `CONOUT$` are absent on purpose: `slugify` collapses
// every non `[a-z0-9]` character to `-`, so those spellings can never survive
// into a stem.
const WINDOWS_RESERVED_STEMS = new Set([
  "CON",
  "PRN",
  "AUX",
  "NUL",
  ...Array.from({ length: 9 }, (_, i) => `COM${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `LPT${i + 1}`),
])

// MEASURED: a 255-character filename component writes; 256 throws. So the
// limit is real, not folklore -- and it applies to `args.name`, which arrives
// from a model with no bound at all. `args.prompt.slice(0, 60)` bounds only the
// default stem. 64 leaves room for the longest extension (".webp") plus slack.
// `slugify` emits ASCII only, so characters and bytes are the same here.
const MAX_STEM_LENGTH = 64

// Order matters: truncate first, then test for a reserved name, so the test
// always runs against the string that will actually be written.
function safeStem(slug: string): string {
  let stem =
    slug.length > MAX_STEM_LENGTH
      ? slug.slice(0, MAX_STEM_LENGTH).replace(/-+$/, "")
      : slug

  if (WINDOWS_RESERVED_STEMS.has(stem.toUpperCase())) {
    stem = `${stem}-image`
  }

  // A slug that truncates to nothing (all hyphens, already unstripped only if
  // the cap landed mid-hyphen-run) falls back the same way `slugify` does.
  return stem.length > 0 ? stem : "image"
}

// Filesystem failures are not Gemini failures, so they are raised as a plain
// Error carrying the offending path and the underlying errno rather than being
// forced into a `NanoBananaErrorKind` that would misdescribe them.
function writeOutput(file: string, bytes: Uint8Array): number {
  try {
    writeFileSync(file, bytes)
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    throw new Error(
      `nano-banana: the image was generated but could not be written to ` +
        `${file}${code ? ` (${code})` : ""}: ` +
        `${err instanceof Error ? err.message : String(err)}`
    )
  }

  // Measure the file, not the buffer. `generateImage` already rejects a 0-byte
  // payload, so the only way to get 0 here is a write that did not land -- and
  // a statSync is the only thing that can tell that. Reporting the buffer
  // length instead would restate what the library already proved.
  const written = statSync(file).size

  // The constraint is "never leave a zero-byte image on disk", and throwing a
  // message that tells the caller to delete it leaves the file exactly where
  // it is. Remove it here, then fail.
  if (written === 0) {
    try {
      unlinkSync(file)
    } catch {
      /* the file is already the problem; the message below names the path */
    }
    throw new NanoBananaError(
      "empty-image",
      `Wrote ${file} and it is 0 bytes on disk. The file was deleted rather ` +
        `than left behind; nothing usable was produced.`
    )
  }

  return written
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

    let inputImage: InputImage | undefined
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

    let result
    try {
      result = await generateImage({
        prompt: args.prompt,
        apiKey,
        model: args.model,
        mimeType: args.mimeType,
        aspectRatio: args.aspectRatio,
        imageSize: args.imageSize,
        inputImage,
      })
    } catch (err) {
      // `kind` is a category, not a diagnosis -- `http-error` alone covers a
      // transport failure, a non-JSON 200 and an unreadable body. The status,
      // content-type and underlying detail all live in `err.message`, so that
      // is what gets surfaced, verbatim. No file has been written at this
      // point: the write happens below and the mkdir below that.
      if (err instanceof NanoBananaError) {
        return [
          `nano-banana failed (${err.kind}). Nothing was written to disk.`,
          "",
          err.message,
        ].join("\n")
      }
      throw err
    }

    const stem = safeStem(slugify(args.name ?? args.prompt.slice(0, 60)))
    const dir = join(context.directory, OUTPUT_DIR)
    try {
      mkdirSync(dir, { recursive: true })
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      throw new Error(
        `nano-banana: the image was generated but ${dir} could not be created` +
          `${code ? ` (${code})` : ""}: ` +
          `${err instanceof Error ? err.message : String(err)}`
      )
    }

    const filename = stem + extensionFor(result.mimeType)
    const file = join(dir, filename)
    const written = writeOutput(file, result.bytes)

    const rel = join(OUTPUT_DIR, filename)
    return [
      `Generated ${rel}`,
      `model:    ${result.model}`,
      `format:   ${result.mimeType}`,
      `bytes:    ${written}`,
      inputImage ? "mode:     edit (1 input image)" : "mode:     generate",
    ].join("\n")
  },
})
