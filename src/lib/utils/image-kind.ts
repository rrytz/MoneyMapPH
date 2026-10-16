// Magic-byte image kind sniffing, shared by upload actions.
// Content kind comes from magic bytes, never the extension or the
// client-asserted MIME - both lie (iOS omits the type; extensions
// rename). PNG, JPEG, WebP only. Unidentified input is rejected,
// not guessed.
export function sniffImageKind(bytes: Uint8Array): "png" | "jpeg" | "webp" | null {
  if (bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (bytes.length >= 3 &&
    bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "webp";
  return null;
}
