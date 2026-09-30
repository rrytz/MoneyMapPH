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
  ["gate:select-items", ["run", "gate:select-items"]],
    // Sibling source check over src/, same rationale as gate:select-items: the
    // chain holds verifiers, not the components they verify, so neither this nor
    // that one can live inside gate-rules' derived scope.
    ["gate:card-padding", ["run", "gate:card-padding"]],
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
    // A DIFFERENT invariant, deliberately in the same chain. gate:brand asserts
    // a brand surface is theme-PROOF; a portal popover is a themed surface BY
    // DEFINITION, so gate:popover asserts AA legibility in both schemes instead
    // of scheme-independence. Merging them would ask each surface for the
    // other's property.
    ["gate:popover", ["run", "gate:popover"]],
  ];

  // The chain ASSERTS ITS OWN COMPLETENESS.
  //
  // A PowerShell edit once wrote this file EMPTY. `gate:all` then exited 0 in
  // 886ms having asserted nothing at all - the chain passed because it did not
  // run, which is the worst failure mode in this whole series. It was caught by
  // a human noticing that 886ms was impossible, and a human noticing is exactly
  // the review line we rejected six commits ago: a control that depends on
  // someone being alert.
  //
  // So completeness is asserted mechanically, against the named list below, in
  // order. Not "at least one gate ran" - that would pass on a truncated list.
  // Not a duration floor either - that fails on a fast machine and passes on a
  // silently broken one. The precise question is "did every gate I expect run,
  // in the order I expect", and that is answerable.
  const EXPECTED = [
    "gate:rules",
    "gate:types",
    "gate:select-items",
    "gate:card-padding",
    "test",
    "gate:typography",
    "gate:nav",
    "gate:logo-source",
    "gate:brand",
    "gate:brand:states",
    "gate:popover",
  ];

  const planned = withServer.map(([label]) => label);
  const missing = EXPECTED.filter((g) => !planned.includes(g));
  const unplanned = planned.filter((g) => !EXPECTED.includes(g));
  if (missing.length || unplanned.length) {
    console.error(
      `[gate:all] CHAIN INCOMPLETE - this is a failure, not a warning.`
    );
    if (missing.length) console.error(`[gate:all]   missing from the chain: ${missing.join(", ")}`);
    if (unplanned.length) console.error(`[gate:all]   in the chain but not expected: ${unplanned.join(", ")}`);
    console.error(`[gate:all]   a chain that does not run its gates must not report success.`);
    throw new Error("gate chain does not match the expected gate list");
  }

  const ran = [];
  for (const [label, args] of withServer) {
    const code = run(label, args);
    ran.push(label);
    if (code !== 0) {
      say(`${label} failed - skipping the rest of the chain`);
      buildCode = code;
    }
  }

  // Post-hoc: the gates that ACTUALLY executed must match, in order. A list
  // that was correct when read and wrong by the time it ran is still a lie.
  const executed = ran;
  const notRun = EXPECTED.filter((g) => !executed.includes(g));
  const outOfOrder = executed.join(",") !== EXPECTED.slice(0, executed.length).join(",");
  if (executed.length === 0) {
    throw new Error("no gate ran at all - the chain is structurally broken");
  }
  if (notRun.length) {
    throw new Error(`these gates did not run: ${notRun.join(", ")}`);
  }
  if (outOfOrder && buildCode === 0) {
    throw new Error(`gates ran out of order: ${executed.join(" -> ")}`);
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

// ---------------------------------------------------------------- teardown
//
// The chain ENDS with a dev server running, on purpose.
//
// The browser gates need the server up and the build needs it down, so the
// sequence is necessarily start -> gates -> stop -> build. STOPPING LAST is
// what made `localhost` look broken after every gate run - twice now, which is
// twice more than it should take. The complaint is not that the server stops; it
// is that nothing puts it back.
//
// So the chain puts it back, and says so. Cost is one extra `next dev` start.
// Skipped under CI, where there is no browser and nobody to serve.
//
// Same failure as the rest of this work, one level up: a procedure with a step
// that depends on the person remembering it. The step belongs in the tool.
if (!process.env.CI) {
  say("restarting the dev server so localhost survives the run");
  const again = spawn(npm, ["run", "dev"], { detached: true, stdio: "ignore", shell: isWindows });
  again.unref();
  try {
    const polls = await waitForPort(ORIGIN, 30000);
    say(`dev server back up on ${ORIGIN} (${polls} poll(s)) - left running`);
  } catch {
    say("WARNING: dev server did not come back up - check it manually");
  }
} else {
  say("CI detected - not starting a dev server");
}

say(buildCode === 0 ? "chain PASS" : `chain FAIL (${buildCode})`);
process.exit(buildCode);
