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