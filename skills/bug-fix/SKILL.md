---
name: bug-fix
description: Reproduce a defect on the surface a user hits, prove the cause with runtime evidence, fix it, and show the repro passing. Use for any reported bug, including a flaky test.
---

# Bug fix

The failure to avoid is a plausible fix that nobody watched work. Every step below
ends in something observed, not something believed.

## Steps

1. **Reproduce on the matching surface.** Run the failing path the way a user or a
   caller reaches it: `bun run dev` and drive the page, or the failing
   `bunx playwright test` case, or `bun run test --run` for a unit-level defect.
   A repro you cannot make fail is not a repro; keep narrowing until it fails or
   the report is wrong.

2. **Record the failing output before touching the code.** Paste it into the pull
   request later, verbatim. Unit tests show branch behaviour, not bug absence, so
   prefer the level that exercises the real path.

3. **Find the first place the system went wrong.** Form candidate causes and rule
   them out one by one until one survives. Confirm the surviving mechanism with
   runtime evidence: a log line, a trace, the actual value, the actual request.
   A guard is a fix only when the state it handles is legitimate.

4. **Fix it at that place, not downstream.** If the fix crosses a component or
   function boundary, settle the prop, event or type shape first. Small, ordered
   commits beat one large one.

5. **Verify on the same surface.** The original repro now passes. Re-run the
   neighbouring tests. Inconclusive is not a pass, and a different surface is not
   a pass.

6. **Stage the commits so the failing repro lands before the fix** when a test
   carries the proof, so history shows the defect existed.

7. **Open the pull request** with the failing and passing output under `## Verify`.

## Rules

- Do not fix a flaky test by widening a timeout or adding a retry. Find what made
  it lose the race, or say in the pull request that the cause was not found.
- Do not leave a "maybe this helps" change in. It is a hypothesis, not a fix.
- Deleting or weakening an assertion to get green is a defect, not a fix. State
  why the old expectation was wrong when it genuinely was.
