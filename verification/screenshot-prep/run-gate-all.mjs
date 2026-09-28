// gate:all runner — owns the dev server, so the chain is one invocation.
//
// WHY THIS EXISTS
//
// `next dev` and `next build` share `.next`. With the dev server running, the
// build worker dies on corrupted generated route types and exits 1 with a
// `Type error` inside `.next/dev/types/validator.ts` that has nothing to do with
// the code. With it stopped, the browser gates die on ERR_CONNECTION_REFUSED.
// So `gate:all` as a single `&&` chain could never be green - it had to be run
// by hand, in an order, and the order had to be remembered.
//
// A procedure that has to be remembered is the same failure this whole gate
// series has been removing, one level up: a control that exists in intent and
// not in enforcement. This script IS the enforcement. The order is now a
// property of the chain rather than a fact about the person running it.
//
// THE ORDER
//
//   1. start the dev server, detached
//   2. wait for the PORT, not for a log line - a server can print "ready"
//      before it accepts connections, and a log-line wait is the sleep this
//      file exists to replace
//   3. run everything that needs a browser, plus the checks that need nothing
//   4. kill the server, and its whole process tree
//   5. run the build alone
//
// Step 4 uses `taskkill /T` because `npm run dev` spawns node children that
// survive killing the parent on Windows, and a surviving dev server corrupts
// the build it is supposed to precede.

import { spawn, spawnSync } from "node:child_process";

const ORIGIN = "http://localhost:3000";
const READY_TIMEOUT_MS = 120000;

const isWindows = process.platform === "win32";
const npm = isWindows ? "npm.cmd" : "npm";

const say = (m) => console.log(`\n[gate:all] ${m}`);

/** Bounded poll on a real connection. A deadline, not a sleep. */
async function waitForPort(origin, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let attempt = 0;
  while (Date.now() < deadline) {
    attempt++;
    try {
      const res = await fetch(origin, { redirect: "manual" });
      // Any HTTP answer means something is listening. A 404 or a redirect is
      // fine - what matters is that the socket accepted and the app answered.
      if (res.status > 0) return attempt;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`dev server did not accept a connection on ${origin} within ${timeoutMs}ms`);
}

function killTree(pid) {
  if (isWindows) {
    spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      try { process.kill(pid, "SIGKILL"); } catch { /* already gone */ }
    }
  }
}

/** Run one gate, streaming output. Returns its exit code. */
function run(label, args) {
  process.stdout.write(`\n[gate:all] ---- ${label} ----\n`);
  const r = spawnSync(npm, args, { stdio: "inherit", shell: isWindows });
  const code = r.status === null ? 1 : r.status;
  if (code !== 0) console.log(`[gate:all] ${label} FAILED (${code})`);
  return code;
}

say("starting dev server");
const dev = spawn(npm, ["run", "dev"], { detached: true, stdio: "ignore", shell: isWindows });

let buildCode = 0;
try {
  const polls = await waitForPort(ORIGIN, READY_TIMEOUT_MS);
  say(`dev server accepting connections on ${ORIGIN} after ${polls} poll(s)`);

  // Everything that can run while the browser is available, plus the checks
  // that need no browser at all. rules and types are first so a violation costs
  // a second rather than the whole chain.
  const withServer = [
    ["gate:rules", ["run", "gate:rules"]],
    ["gate:types", ["run", "gate:types"]],
    ["test", ["test"]],
    ["gate:typography", ["run", "gate:typography"]],
    ["gate:nav", ["run", "gate:nav"]],
    // SOURCE check before the RENDERED brand checks: the point of a source
    // check is to reject a bad asset before a browser ever sees it. A
    // hardcoded fill renders identically in both schemes and would sail past
    // every rendered assertion.
    ["gate:logo-source", ["run", "gate:logo-source"]],
    ["gate:brand", ["run", "gate:brand"]],
    ["gate:brand:states", ["run", "gate:brand:states"]],
  ];
  for (const [label, args] of withServer) {
    const code = run(label, args);
    if (code !== 0) {
      say(`${label} failed - skipping the rest of the chain`);
      buildCode = code;
    }
  }
} catch (err) {
  console.error(`[gate:all] ${err.message}`);
  buildCode = 1;
} finally {
  say("stopping dev server (build must run without it - they share .next)");
  killTree(dev.pid);
  if (isWindows) {
    // Windows can take a moment to release the port and the .next lock.
    spawnSync("cmd", ["/c", "timeout", "/t", "2", "/nobreak"], { stdio: "ignore" });
  }
}

if (buildCode === 0) {
  buildCode = run("build", ["run", "build"]);
}

say(buildCode === 0 ? "chain PASS" : `chain FAIL (${buildCode})`);
process.exit(buildCode);
