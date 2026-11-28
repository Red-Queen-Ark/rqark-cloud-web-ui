---
name: verify-web-ui
description: Drive the real console in a browser and capture evidence, so a claim about behaviour is backed by an observed run instead of a passing unit test. Use before opening a pull request that changes behaviour.
---

# Verify web UI

## Launch

```bash
bun run dev
```

The dev server is up when `http://localhost:5173/` answers 200. The agent cloud at
`localhost:8000` is not required: the e2e suite answers `/api` and `/agent-api`
from `e2e/support/mock-backend.ts`, and a spec that bypasses the mock is a spec
that cannot run on a laptop.

## Doctor

Before trusting a run, check the three things that silently break it:

- `curl -s -o /dev/null -w '%{http_code}' http://localhost:5173/` returns 200.
- `bun run build` passes, which means `vue-tsc` accepted the types.
- Only one Playwright run at a time. Two runs share the dev server and the
  browser binaries, and both fail with connection refused. On a two-core machine
  use `--workers=1`.

## Drive

Reach the state the way a user does: click the row, fill the field, send the
turn. A spec that calls a store action or a test-only endpoint directly proves the
store, not the page.

For a screenshot-and-inspect run:

```bash
bunx playwright test --project=chromium --workers=1 e2e/<spec>.spec.ts
```

`playwright-report/index.html` holds the trace, the DOM snapshot at each step and
the screenshot. Read the snapshot before reading the code: it shows what the page
actually rendered.

## Evidence

A claim needs one of:

- The failing-then-passing output of a named spec, pasted verbatim.
- The request the page actually sent, from `backend.writes` in the mock.
- A measured value from the live DOM: a `boundingBox()`, a computed style, a
  `scrollTop`. Say what was measured and what the number was.

Not evidence: "the test passes" without the test name, a screenshot with no claim
attached, a cached report from an earlier commit.

## Cleanup

```bash
rm -rf test-results playwright-report
```

Both are gitignored. Leave the dev server running only if you are still working;
otherwise stop it so the next run does not fight for port 5173.

## Features

Each entry names how to reach a surface and how to drive it, so a later agent does
not rediscover it. Add to this list when you verify something new.

### Chat turn

- **Sub-features:** streaming a turn, the worked-for line that folds over a turn,
  the plan dock above the history, the sticky composer.
- **How to get to it (user POV):** sign in, open a session from the sidebar, type
  in the composer and press send.
- **Driving it:** `e2e/chat.spec.ts`, `e2e/chat-turn-header.spec.ts`,
  `e2e/chat-scroll.spec.ts`. Seed a session with `mockBackend({ sessions: [...] })`
  and answer the socket with `page.routeWebSocket`.
- **Gotchas:** `#chat-history` carries the plan dock's height as `padding-top`,
  so a sticky child holds at `main.top + planDock.offsetHeight`, not at
  `main.top`. The loading state drops that padding on purpose, to centre the
  spinner in the page.

### Start page composer

- **Sub-features:** the draft the new-session composer keeps.
- **How to get to it (user POV):** sidebar → New Session (`sidebar-chat-new`).
- **Driving it:** `e2e/home.spec.ts`, the "keeps the draft on the start page"
  case. Type on `/en`, open a chat, click New Session, then reload.
- **Gotchas:** the start page has no session id, so its draft is stored under
  `NEW_SESSION_DRAFT_KEY` in the same `sessionDrafts` map the chats use.

### Workspace browser

- **Sub-features:** the file list, the row actions menu, preview, upload, grid
  view, the breadcrumb.
- **How to get to it (user POV):** sidebar → Workspace.
- **Driving it:** `e2e/workspace.spec.ts` with `mockWorkspaceApi(page)`. The mock
  is a path→node map, so a new file is a new entry in `options.files`.
- **Gotchas:** the file-tree sidebar was removed in `adf867d` and `FileTree.vue`
  is no longer mounted. Navigation is the row and the breadcrumb.

### Task list

- **Sub-features:** create cron or every tasks, edit, pause, delete, run history.
- **How to get to it (user POV):** sidebar → Tasks.
- **Driving it:** `e2e/tasks.spec.ts` with `mockBackend({ tasks, taskRuns })`.
  `openRowActions` from `e2e/support/row-actions.ts` opens a row menu that is
  teleported to the body.
- **Gotchas:** the task fixtures are copied per run because the PUT handler
  renames the row in place; share one object across tests and the second test
  reads the first test's name.

### Usage

- **Sub-features:** the range presets, the custom range, the API key, source,
  model and user filters, the daily chart, the cache hit rate.
- **How to get to it (user POV):** sidebar → Usage, superuser or not.
- **Driving it:** `e2e/manage/usage.spec.ts`. Every filter change posts `/usage`
  on its own, so assert on the request bodies rather than on a request count.
- **Gotchas:** `usage-range-error` is a computed flag, so it is visible as soon as
  the two dates disagree; no request needs to fail for it to show.
