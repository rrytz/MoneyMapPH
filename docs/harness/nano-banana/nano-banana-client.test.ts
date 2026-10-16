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

  test("emits response_format when any of the image options is supplied", () => {
    const body = buildRequestBody({
      prompt: "a red cube",
      apiKey: "k",
      mimeType: "image/webp",
      aspectRatio: "16:9",
      imageSize: "2K",
    })
    assert.deepEqual(body.response_format, {
      type: "image",
      mime_type: "image/webp",
      aspect_ratio: "16:9",
      image_size: "2K",
    })
  })

  test("response_format carries only the options that were supplied", () => {
    const body = buildRequestBody({
      prompt: "a red cube",
      apiKey: "k",
      aspectRatio: "1:1",
    })
    assert.deepEqual(body.response_format, {
      type: "image",
      aspect_ratio: "1:1",
    })
    assert.ok(!("mime_type" in (body.response_format as object)))
    assert.ok(!("image_size" in (body.response_format as object)))
  })

  // An absent key and a key present but empty are different facts, so this
  // asserts the key is missing rather than merely falsy.
  test("omits response_format entirely when no image option is supplied", () => {
    const body = buildRequestBody({ prompt: "a red cube", apiKey: "k" })
    assert.ok(!("response_format" in body), "response_format was present")
    assert.deepEqual(Object.keys(body).sort(), ["input", "model"])
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
  // image/webp is a *known* mime type with its own extension, so it is not a
  // valid fallback probe. Asserting ".png" for it contradicts MIME_EXTENSIONS.
  test("maps png to .png, jpeg to .jpg and webp to .webp", () => {
    assert.equal(extensionFor("image/png"), ".png")
    assert.equal(extensionFor("image/jpeg"), ".jpg")
    assert.equal(extensionFor("image/webp"), ".webp")
  })

  test("falls back to .png for an unknown mime type", () => {
    assert.equal(extensionFor("image/gif"), ".png")
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
      return jsonResponse({
        output_image: { data: PNG_B64, mime_type: "image/png" },
      })
    }) as unknown as typeof fetch

    await generateImage({ prompt: "a red cube", apiKey: "secret", fetchImpl })
    assert.equal(seenUrl, ENDPOINT)
    assert.equal(seenKey, "secret")
  })

  // Every other stub in this file returns a canned response and ignores the
  // request entirely, so a regression that dropped the prompt from the wire
  // body -- or sent the wrong shape -- would leave all of them green.
  test("serializes the prompt into the request body it puts on the wire", async () => {
    let seenBody: unknown = undefined
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      assert.equal(typeof init.body, "string", "init.body was not a string")
      seenBody = JSON.parse(init.body as string)
      return jsonResponse({
        output_image: { data: PNG_B64, mime_type: "image/png" },
      })
    }) as unknown as typeof fetch

    await generateImage({
      prompt: "a red cube on grass",
      apiKey: "k",
      fetchImpl,
    })

    assert.ok(seenBody !== undefined, "the stub never observed init.body")
    const body = seenBody as Record<string, unknown>
    assert.deepEqual(body.input, [
      { type: "text", text: "a red cube on grass" },
    ])
    assert.equal(body.model, DEFAULT_MODEL)
  })

  test("an explicit model reaches the wire body and the returned result", async () => {
    let seenBody: unknown = undefined
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      seenBody = JSON.parse(init.body as string)
      return jsonResponse({
        output_image: { data: PNG_B64, mime_type: "image/png" },
      })
    }) as unknown as typeof fetch

    const result = await generateImage({
      prompt: "x",
      apiKey: "k",
      model: "gemini-nano-banana-2.5",
      fetchImpl,
    })

    assert.equal((seenBody as Record<string, unknown>).model, "gemini-nano-banana-2.5")
    assert.equal(result.model, "gemini-nano-banana-2.5")
  })

  // The catch here could not fail if the read succeeded, so it is asserted
  // rather than assumed: a helper that swallows its own failure is the defect
  // it was written to replace.
  test("says the error body could not be read instead of reporting it empty", async () => {
    const fetchImpl = (async () =>
      ({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        headers: new Headers(),
        text: async () => {
          throw new Error("stream closed before the body finished")
        },
      }) as unknown as Response) as unknown as typeof fetch

    await assert.rejects(
      generateImage({ prompt: "x", apiKey: "k", fetchImpl }),
      (err: unknown) => {
        assert.ok(err instanceof NanoBananaError)
        assert.equal(err.kind, "http-error")
        assert.match(err.message, /could not be read/)
        assert.match(err.message, /stream closed before the body finished/)
        return true
      }
    )
  })

  test("200 with a non-JSON body is classified, not a raw SyntaxError", async () => {
    const fetchImpl = (async () =>
      new Response("<html>proxy interstitial</html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      })) as unknown as typeof fetch

    await assert.rejects(
      generateImage({ prompt: "x", apiKey: "k", fetchImpl }),
      (err: unknown) => {
        assert.ok(err instanceof NanoBananaError)
        assert.equal(err.kind, "http-error")
        assert.match(err.message, /text\/html/)
        assert.match(err.message, /proxy interstitial/)
        return true
      }
    )
  })

  test("a transport failure is classified, not a raw TypeError", async () => {
    const fetchImpl = (async () => {
      throw new TypeError("fetch failed")
    }) as unknown as typeof fetch

    await assert.rejects(
      generateImage({ prompt: "x", apiKey: "k", fetchImpl }),
      (err: unknown) =>
        err instanceof NanoBananaError && err.kind === "http-error"
    )
  })

  // The error path guards its body read and this one did not: a 200 whose
  // transfer is cut mid-image makes text() reject with a bare TypeError that
  // carries no kind, so err.kind was undefined for the caller to branch on.
  test("a truncated 200 body read is classified, not a raw TypeError", async () => {
    const fetchImpl = (async () =>
      ({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({ "content-type": "application/json" }),
        text: async () => {
          throw new TypeError("terminated")
        },
      }) as unknown as Response) as unknown as typeof fetch

    await assert.rejects(
      generateImage({ prompt: "x", apiKey: "k", fetchImpl }),
      (err: unknown) => {
        assert.ok(
          err instanceof NanoBananaError,
          `expected NanoBananaError, got ${err?.constructor?.name}: ${err}`
        )
        assert.equal(err.kind, "http-error")
        assert.match(err.message, /200/)
        assert.match(err.message, /application\/json/)
        assert.match(err.message, /terminated/)
        return true
      }
    )
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

  // The payload here carries an empty string, so parseInteraction rejects it
  // first and `empty-image` is never reached. The branch that actually decodes
  // to zero bytes is covered by the next test.
  test("throws when the payload carries empty data", async () => {
    const fetchImpl = (async () =>
      jsonResponse({
        output_image: { data: "", mime_type: "image/png" },
      })) as unknown as typeof fetch

    await assert.rejects(
      generateImage({ prompt: "x", apiKey: "k", fetchImpl }),
      (err: unknown) =>
        err instanceof NanoBananaError &&
        err.kind === "no-image-in-response"
    )
  })

  test("throws empty-image when non-empty base64 decodes to zero bytes", async () => {
    const fetchImpl = (async () =>
      jsonResponse({
        // Whitespace is a non-empty string, so it clears parseInteraction, but
        // it is not valid base64 and decodes to nothing.
        output_image: { data: "   ", mime_type: "image/png" },
      })) as unknown as typeof fetch

    await assert.rejects(
      generateImage({ prompt: "x", apiKey: "k", fetchImpl }),
      (err: unknown) => {
        assert.ok(err instanceof NanoBananaError)
        assert.equal(err.kind, "empty-image")
        assert.match(err.message, /0 bytes/)
        return true
      }
    )
  })
})
