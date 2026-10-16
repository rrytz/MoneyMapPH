import { test, describe, before, after } from "node:test"
import assert from "node:assert/strict"
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import { join, parse } from "node:path"
import { tmpdir } from "node:os"
import { containsPath } from "./nano-banana-client.ts"

// `containsPath` is the containment control: whatever it accepts is read in full
// and POSTed to a third-party API. It is therefore tested against real
// directories, real files and real Windows junctions -- not string fixtures,
// because the defect it guards is that a *string* comparison cannot see through
// a reparse point, and a string fixture would be exactly the thing that hides
// it.
//
// Fixture layout (all under one temp root, removed in `after`):
//
//   base/proj/assets/legit.png        the project
//   base/proj-evil/x.png              sibling sharing the project's name
//   base/outside/secret.png           not the project's
//   base/proj-root-link  -> proj      junction: project reached THROUGH a link
//   base/proj/link        -> outside  junction: escape from inside the project
//
// The last two are the pair the fix is about, and they point in opposite
// directions. A test that cannot tell them apart is not a test of this change.

const SECRET = "SUPER-SECRET-CONTENT-THAT-MUST-NEVER-BE-UPLOADED"

let base: string
let proj: string
let projEvil: string
let outside: string
let projRootLink: string
let escapeLink: string
let legit: string
let secret: string

// Throws with the reason rather than leaving a half-built fixture, so a failed
// setup is never mistaken for a passing assertion.
function requireLink(link: string, target: string): void {
  assert.ok(
    lstatSync(link).isSymbolicLink(),
    `${link} is not a reparse point -- the fixture did not exercise the code under test`
  )
  assert.equal(realpathSync(link), realpathSync(target))
}

before(() => {
  base = mkdtempSync(join(tmpdir(), "nano-banana-containment-"))
  proj = join(base, "proj")
  projEvil = join(base, "proj-evil")
  outside = join(base, "outside")
  projRootLink = join(base, "proj-root-link")
  escapeLink = join(proj, "link")

  mkdirSync(join(proj, "assets"), { recursive: true })
  mkdirSync(projEvil, { recursive: true })
  mkdirSync(outside, { recursive: true })

  legit = join(proj, "assets", "legit.png")
  secret = join(outside, "secret.png")
  writeFileSync(legit, "legit-image-bytes")
  writeFileSync(join(projEvil, "x.png"), "sibling-image-bytes")
  writeFileSync(secret, SECRET)

  // `junction` is a directory link that needs no elevation on Windows, which
  // `symlink`'s `dir` type would. On a platform without either, this throws and
  // the two junction tests SKIP visibly below rather than passing on nothing.
  try {
    symlinkSync(proj, projRootLink, "junction")
  } catch {
    /* reported by the skip guards below */
  }
  try {
    symlinkSync(outside, escapeLink, "junction")
  } catch {
    /* reported by the skip guards below */
  }

  // Prove the fixture is real before any assertion is measured through it: a
  // containment suite that silently degraded to lexical-only paths would still
  // be green, and would be testing the old bug.
  assert.ok(existsSync(legit), `fixture missing: ${legit}`)
  assert.equal(
    readFileSync(secret, "utf8"),
    SECRET,
    "fixture secret is not readable -- the escape case would be vacuous"
  )
})

after(() => {
  if (!base) return
  // Delete the links with unlink before the recursive delete. A junction's
  // target is not part of the link, and the assertion after it is the check on
  // that: deleting a link must leave its target alone.
  for (const link of [escapeLink, projRootLink]) {
    if (existsSync(link)) {
      try {
        unlinkSync(link)
      } catch {
        rmSync(link, { force: true })
      }
    }
  }
  assert.equal(
    existsSync(secret),
    true,
    "removing the junction also removed its target -- cleanup reached outside the fixture"
  )
  rmSync(base, { recursive: true, force: true })
  assert.equal(existsSync(base), false, `fixture root survived cleanup: ${base}`)
})

describe("containsPath -- paths with no reparse point in them", () => {
  test("accepts a file inside the root, given absolutely", () => {
    assert.equal(containsPath(proj, legit), true)
  })

  test("accepts a path spelled with a relative segment that stays inside", () => {
    // Not `join`, which normalises the `..` away: the point is that a `..` in
    // the middle of a path is not an escape.
    assert.equal(
      containsPath(proj, `${join(proj, "assets")}\\..\\assets\\legit.png`),
      true
    )
  })

  test("accepts a directory inside the root, leaving the is-a-file check to the caller", () => {
    assert.equal(containsPath(proj, join(proj, "assets")), true)
  })

  test("accepts a file whose name begins with dots", () => {
    // Guards the claim in the implementation comment that a bare
    // startsWith("..") would be wrong: `..data` is a leading `..` character run
    // but not a `..` SEGMENT.
    mkdirSync(join(proj, "..data"), { recursive: true })
    writeFileSync(join(proj, "..data", "ok.png"), "dots")
    assert.equal(containsPath(proj, join(proj, "..data", "ok.png")), true)
  })

  test("rejects a traversal that climbs out of the root", () => {
    assert.equal(containsPath(proj, join(proj, "..", "outside", "secret.png")), false)
  })

  test("rejects a traversal that climbs out and back to a sibling of the root", () => {
    assert.equal(containsPath(proj, join(proj, "..", "proj-evil", "x.png")), false)
  })

  // `C:\proj-evil` startsWith `C:\proj`, so this is the case a naive prefix
  // test accepts. The two roots must differ only after the segment boundary.
  test("rejects a sibling directory that shares the root's name as a prefix", () => {
    assert.equal(containsPath(proj, join(projEvil, "x.png")), false)
  })

  test("rejects the root's parent", () => {
    assert.equal(containsPath(proj, base), false)
  })

  test("accepts the root itself, and lets the is-a-file check reject it", () => {
    assert.equal(containsPath(proj, proj), true)
  })

  test("rejects a path on a UNC volume, which relative() cannot compare to a local root", () => {
    // Different VOLUME, not a different drive letter: `relative()` returns an
    // absolute path whenever the roots differ, which is the same branch a
    // second drive takes. Covered unconditionally so the branch is never
    // untested merely because the machine has one drive.
    assert.equal(containsPath(proj, "\\\\some-host\\share\\secret.png"), false)
  })
})

describe("containsPath -- across drives", () => {
  // A real second physical drive is required, so this may not be constructible
  // on every machine. It SKIPS with a reason rather than passing vacuously: the
  // UNC case above already covers the branch `relative()` takes.
  function otherDrive(): string | undefined {
    for (const letter of "DEFGHIJKLMNOPQRSTUVWXYZ") {
      const root = `${letter}:\\`
      try {
        realpathSync(root)
        return root
      } catch {
        /* not a readable volume */
      }
    }
    return undefined
  }

  test("rejects a file on another physical drive", (t) => {
    const drive = otherDrive()
    if (!drive) {
      t.skip("no second readable physical drive on this machine (UNC case covers the branch)")
      return
    }
    assert.equal(containsPath(proj, `${drive}nano-banana-containment\\x.png`), false)
  })
})

describe("containsPath -- through Windows junctions", () => {
  // These two are the finding. They are asserted as a PAIR and in opposite
  // directions, because a fix that resolved only the target would pass the
  // first and fail the second, and a fix that resolved neither would fail the
  // first and pass the second. Either single assertion is a weaker test than
  // the two together.
  function junctionSupport(): { root: boolean; escape: boolean } {
    const root = existsSync(projRootLink)
    const escape = existsSync(escapeLink)
    if (root) requireLink(projRootLink, proj)
    if (escape) requireLink(escapeLink, outside)
    return { root, escape }
  }

  test("rejects a file reached through a junction that points outside the project", (t) => {
    const { escape } = junctionSupport()
    if (!escape) {
      t.skip("this platform/filesystem would not create a directory junction")
      return
    }
    // The escape target must be readable through the link, or "rejected" would
    // be indistinguishable from "the path never existed".
    assert.equal(
      readFileSync(join(escapeLink, "secret.png"), "utf8"),
      SECRET,
      "the fixture is not reachable through the junction -- this case is vacuous"
    )
    assert.equal(containsPath(proj, join(escapeLink, "secret.png")), false)
  })

  test("accepts a file reached through a project tree that is itself a junction", (t) => {
    const { root } = junctionSupport()
    if (!root) {
      t.skip("this platform/filesystem would not create a directory junction")
      return
    }
    // Assert the resolution is actually load-bearing on this fixture. Without
    // this, a broken symlink that still left the path readable through the
    // link spelling would make the case pass for the wrong reason.
    assert.notEqual(
      realpathSync(projRootLink),
      projRootLink,
      "the project-root fixture is not a link, so nothing was resolved"
    )
    assert.equal(realpathSync(projRootLink), realpathSync(proj))
    assert.equal(
      containsPath(projRootLink, join(projRootLink, "assets", "legit.png")),
      true
    )
  })

  test("a junction inside the project pointing back inside it stays contained", (t) => {
    const { escape } = junctionSupport()
    if (!escape) {
      t.skip("this platform/filesystem would not create a directory junction")
      return
    }
    // The control for the escape case: the SAME mechanism, pointed somewhere
    // legal. If this were rejected too, the escape test would be passing
    // because junctions were refused outright rather than because the
    // comparison resolved.
    const inward = join(proj, "inward")
    symlinkSync(join(proj, "assets"), inward, "junction")
    try {
      assert.equal(containsPath(proj, join(inward, "legit.png")), true)
    } finally {
      unlinkSync(inward)
    }
  })
})

describe("containsPath -- paths that do not exist", () => {
  // The existence check runs immediately after this one in the tool, and the
  // not-found message must survive. A guard that refused every unresolvable
  // path would turn "that file is not there" into "that file is outside the
  // project", which is a different and wrong answer.
  test("a missing file inside the root is not reported as an escape", () => {
    const missing = join(proj, "assets", "never-written.png")
    assert.equal(existsSync(missing), false, "fixture assumption: the file must not exist")
    assert.equal(containsPath(proj, missing), true)
  })

  test("a missing file outside the root is not reported as inside", () => {
    assert.equal(containsPath(proj, join(outside, "never-written.png")), false)
  })

  test("a missing root does not throw", () => {
    assert.doesNotThrow(() => containsPath(join(base, "no-such-root"), legit))
  })
})

describe("fixture integrity", () => {
  // A presence assertion is not a uniqueness assertion, and a containment suite
  // measured against a fixture that silently failed to build is the emptiest
  // pass available. These assert the subject set is what the suite claims.
  test("every path the suite measures against exists, except the two by design", () => {
    const mustExist = [proj, projEvil, outside, legit, secret, join(projEvil, "x.png")]
    const missing = mustExist.filter((p) => !existsSync(p))
    assert.deepEqual(missing, [], `fixture paths missing: ${missing.join(", ")}`)
  })

  test("the fixture root is the temp directory this run created, and is a directory", () => {
    // Named for what it asserts. Nothing above depends on WHERE the fixture
    // lands, so this only records that a fixture was built at all -- a suite
    // that silently stopped creating fixtures would otherwise be
    // indistinguishable from one that created them somewhere unexpected.
    assert.ok(existsSync(base))
    assert.ok(lstatSync(base).isDirectory())
    assert.ok(parse(base).root.length > 0)
    assert.ok(
      base.startsWith(realpathSync(tmpdir())) || base.startsWith(tmpdir()),
      `fixture was created outside the temp directory: ${base}`
    )
  })
})