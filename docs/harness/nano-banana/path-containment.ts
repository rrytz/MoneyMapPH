import { realpathSync } from "node:fs"
import { isAbsolute, relative, resolve } from "node:path"

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
//
// WHY IT LIVES HERE AND NOT IN `nano-banana-client.ts`: the client library is
// specified PURE -- no OpenCode imports, no filesystem access, no `process` --
// and that isolation is what lets its 28 tests run as unit tests against a
// stubbed `fetch` with no filesystem fixture at all. `node:fs` at the top of
// that file would weaken the property for the whole module to accommodate one
// helper that is a filesystem-boundary control rather than API logic. So the
// control is its own module, with its own committed suite
// (`nano-banana-containment.test.ts`) against real directories, real files and
// real junctions.
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