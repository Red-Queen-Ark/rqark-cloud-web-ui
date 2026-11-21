# rqark-cloud-web-ui

The console for the RQArk Ecology System: chat, agents, tasks, todos, workspace and the management pages in one Vue app, which also builds as a desktop client.

## Why rqark-cloud-web-ui

`rqark-core` runs one conversation and `rqark-app` keeps it, but neither has a screen. This is that screen: a single page app that talks to two services over one origin, and a Wails shell that wraps the same bundle when a browser is not wanted.

- **One origin, two backends** — the REST API and the chat socket are reached through paths this app owns, so neither backend needs a CORS rule and the socket upgrades to `wss` by itself behind TLS.
- **Same code on the web and on the desktop** — the desktop build serves the identical bundle from a custom protocol and proxies `/api` and `/agent-api` to whatever hosts the settings name.
- **Generated, never hand-written, API calls** — the REST client comes from the backend's own Swagger document.

## The ecosystem

| Repository                                  | What it is                                                                                               | Used here for                                                    |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| [`rqark-core`](../rqark-core)               | Stateless agent engine for Python, with tools, prompts and one streaming interface.                      | Nothing directly; it runs behind the agent cloud.                |
| [`rqark-app`](../rqark-app)                 | Sessions, providers and agents on top of `rqark-core`, with a data cloud for memory, todos and settings. | Nothing directly; it runs behind the agent cloud.                |
| [`rqark-agent-cloud`](../rqark-agent-cloud) | The HTTP and WebSocket service over `rqark-app`: chats, ASR, voice.                                      | `/agent-api` — the chat socket, `/api/asr`, `/api/voice/ws`.     |
| [`rqark-data-cloud`](../rqark-data-cloud)   | Accounts, groups, API keys and the stored data, in Go and Postgres.                                      | `/api` — auth, sessions, agents, tasks, todos, workspace, usage. |
| `rqark-cloud-web-ui`                        | This repository.                                                                                         | —                                                                |

## Architecture

```
src/
├── api/               generated OpenAPI client (wiped on every regeneration)
├── api-client/        hand-written glue: base URL, token refresh, ASR, voice socket
├── components/        components grouped by feature (Chat, Session, Workspace, …)
├── composables/       chat socket, recorder, voice stream, sticky scroll, …
├── config/            runtime configuration and domain constants
├── i18n/              en, zh-CN and zh-TW message catalogues
├── layouts/           page frames
├── pages/             route-level screens, including pages/manage for the console
├── routes/            vue-router routes and the navigation guard
├── stores/            Pinia stores
├── types/             shared ambient types
└── utils/             formatting, markdown, auth session, …
e2e/                   Playwright specs against a mocked backend
main.go, apiproxy.go, settings.go   the Wails desktop shell
```

- **UI** — Vue 3 with `<script setup>` and TypeScript, Tailwind CSS and DaisyUI, semantic classes before raw utilities.
- **Routing** — every route carries the language (`/en/…`, `/zh-tw/…`). The guard sends a signed-out visitor to login and closes superuser pages before they render. The desktop build uses hash history, because a custom protocol has no server to rewrite a deep link.
- **State** — Pinia. Auth tokens are shared across tabs through storage events; a token rotation in one tab is adopted by the others instead of racing them.
- **API** — `src/api` is generated from `VITE_API_SPEC_URL` by `@hey-api/openapi-ts` and must not be edited. `src/api-client` holds everything the generator cannot express: the base URL (relative, never pinned to a host), the `Authorization` header, the single-flight refresh, the ASR calls and the voice WebSocket.
- **Chat** — `useChatSocket` opens `WS /agent-api/chat/ws/{session uuid}`, merges the replayed history with the streaming turn, and keeps the draft of a turn that has not landed yet.
- **PWA** — a service worker precaches the shell. It is disabled in the desktop build, where a service worker cannot register.
- **Desktop** — Wails 3 wraps the bundle and embeds it. `main.go` serves the assets, `apiproxy.go` proxies the two paths, and `settings.go` keeps the backend addresses in a JSON file under the user config directory (`rqark-cloud-desktop/server.json`). A fresh install defaults to `http://localhost:7302/api` and `http://localhost:8000/api`.

## Requirements

- [Bun](https://bun.sh) — package manager and script runner. Every script in `package.json` uses `bunx`, so `npm`, `pnpm` and `yarn` are not supported.
- Go 1.26+ and the Wails 3 CLI (`go install github.com/wailsapp/wails/v3/cmd/wails3@latest`) — desktop builds only.

## Getting started

```bash
bun install
bun run dev
```

Vite serves on <http://localhost:5173> and proxies the two backend prefixes:

| Prefix       | Default target          | Service                         |
| ------------ | ----------------------- | ------------------------------- |
| `/api`       | `http://localhost:7302` | data cloud, REST                |
| `/agent-api` | `http://localhost:8000` | agent cloud, REST and WebSocket |

Start those services first — the app boots to the login page and cannot list a session until they answer. Both targets are configurable, see below.

## Environment

`.env` is committed and holds the values a local checkout needs. Vite inlines `VITE_*` at build time, so changing one needs a rebuild, not just a restart.

| Variable                      | Default                                                         | Purpose                                                                                                                |
| ----------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `VITE_APP_NAME`               | `RqArk Cloud`                                                   | Tab title, PWA manifest name, Apple web app title. The image fixes its own copy; see Docker.                           |
| `VITE_APP_DESCRIPTION`        | `Console for RQArk Cloud: chats, agents, tasks and workspaces.` | PWA manifest and `<meta name="description">`.                                                                          |
| `VITE_API_BASE_URL`           | `/api`                                                          | Prefix the generated REST client uses. Keep it relative.                                                               |
| `VITE_API_PROXY_TARGET`       | `http://localhost:7302`                                         | Dev-only target of the `/api` proxy.                                                                                   |
| `VITE_AGENT_API_BASE_URL`     | `/agent-api`                                                    | Prefix for the chat socket and the other agent cloud routes.                                                           |
| `VITE_AGENT_API_PROXY_TARGET` | `http://localhost:8000`                                         | Dev-only target of the `/agent-api` proxy.                                                                             |
| `VITE_API_SPEC_URL`           | `http://localhost:7302/api/swagger.json`                        | Swagger document `bun run api-client` reads.                                                                           |
| `DESKTOP_BUILD`               | —                                                               | `true` makes the build relative-based, drops the service worker, and marks it as the Wails build. Set by the Taskfile. |

The two `*_BASE_URL` values stay relative on purpose: the web build is proxied by the server serving it, and the desktop build by the Go side. That is also why the generated client is configured with `baseUrl: false` — the address is applied at runtime from `src/config/runtime.ts`, so no build pins a host.

## Scripts

| Command                     | Action                                                |
| --------------------------- | ----------------------------------------------------- |
| `bun run dev`               | Dev server with HMR and both proxies.                 |
| `bun run build`             | Type-check with `vue-tsc`, then build to `dist/`.     |
| `bun run preview`           | Serve the built bundle.                               |
| `bun run test`              | Vitest, jsdom. Add `--run` for a single pass.         |
| `bun run test:e2e`          | Playwright specs in `e2e/`, against a mocked backend. |
| `bun run lint` / `lint:fix` | ESLint.                                               |
| `bun run format`            | Prettier.                                             |
| `bun run api-client`        | Regenerate `src/api` from `VITE_API_SPEC_URL`.        |
| `bun run generate-assets`   | Regenerate the PWA icons and the iOS splash screens.  |

## Docker

Both compose files build the image from `docker/dockerfile*` and bake the app in; nginx then serves `dist/` and proxies the two prefixes.

The two upstream addresses are not baked into the image. Each dockerfile copies an `*.conf.template` into `/etc/nginx/templates`, and the nginx entrypoint renders it into `/etc/nginx/conf.d/default.conf` at container start. Set `DATA_CLOUD_URL` and `AGENT_CLOUD_URL` and the proxies follow; no rebuild is needed. When they are unset the dockerfile's `ENV` defaults apply — `host.docker.internal` for the development image, `server:7302` and `agent-cloud:8000` for the production one.

**Development** — `docker compose up -d`, image built from `docker/dockerfile` and `nginx.conf.template`. Its defaults point at `host.docker.internal`, which only exists on Docker Desktop and only makes sense when the backends run on the host outside Docker. It is a development target, not a deployment one.

**Production** — `docker compose -f docker-compose.production.yml up -d`, image built from `docker/dockerfile.production` and `nginx.production.conf.template`. Its defaults resolve the backends by their compose service names on the shared network `rqark-project`. Both containers must be on that network; the network must already exist (`docker network create rqark-project`) and the agent cloud container must join it. A deployment where the backends answer to other names sets the two variables instead of editing the template.

Vite inlines `VITE_*` at build time, so a change needs a rebuild, not a restart. The image fixes `VITE_APP_NAME`, `VITE_APP_DESCRIPTION` and the two base paths itself, in `docker/dockerfile` and `docker/dockerfile.production`; the compose files pass no build arguments. Rename the app in both files and in `.env`, or a local build and the image will disagree.

## Desktop

```bash
bun run desktop:dev                      # Wails dev server
bun run desktop:build                    # build for the host
bun run desktop:build:windows            # cross-build for windows/amd64
```

The Wails task builds the frontend with `DESKTOP_BUILD=true` and then the Go binary, so the two never drift. Windows builds embed the icon resource; regenerate it with `bun run desktop:icons`.

The desktop app has no fixed backend: the addresses are editable in the app's settings, saved to the config file described above, and picked up by the proxy on the next request. Its chats live on the agent cloud, so both addresses are needed.

## Contributing

Issues, commits, pull requests, versions and releases follow [`CONTRIBUTING.md`](./CONTRIBUTING.md). Before opening a pull request, run `bun run lint:fix`, `bun run format`, `bun run test` and `bun run build`.
