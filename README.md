# NIM Chat

A polished, responsive web client for **NVIDIA NIM** models. Pick a model, chat with it, keep
multiple conversations, and export them — all from a static site with no server, no account and no
telemetry.

Built with React 19, TypeScript (strict), Vite and Tailwind CSS 4, deployed to GitHub Pages by
GitHub Actions.

> **How your key is handled:** NIM Chat runs entirely in your browser. The API key you enter is
> stored in _your_ browser storage and sent _directly_ from your browser to the NVIDIA NIM endpoint.
> It is never committed to this repository, never bundled into the build, and never sent anywhere
> else. See [API key security](#api-key-security) for the full picture, including the limitations
> that come with a browser-only app.

---

## Features

**Chat**

- Conversation sidebar with search, create, rename (inline), delete and delete-all-with-confirm
- Titles generated from your first message; rename anything at any time
- Streaming responses with a live caret, **Stop** button, and **Regenerate** on the last answer
- Markdown rendering (GFM tables, lists, task lists) with syntax-highlighted code blocks
- Copy buttons for individual code blocks and whole messages
- `Enter` to send, `Shift + Enter` for a newline
- Auto-scroll that follows the answer and gets out of the way when you scroll up
- Per-conversation model and parameters, empty-state guidance for first-time users

**Models & API**

- Live model discovery from `GET /v1/models`, filtered to chat-capable endpoints
- Bundled fallback catalogue so the app stays usable when discovery fails
- Configurable endpoint, temperature, top-p, max tokens, system prompt and streaming toggle
- Connection status pill, with explicit handling of auth, rate-limit, timeout, network, CORS, parse
  and server errors
- Optional CORS proxy included for deployments where the browser cannot call NIM directly

**Data**

- Everything persisted to browser local storage; survives refreshes and browser restarts
- Corrupt or hostile storage contents are repaired or dropped, never crash the app
- Export conversations to JSON, import them back, or wipe every byte the app owns
- Light/dark/system themes with the preference remembered (and applied before first paint)

**Quality**

- TypeScript strict mode, `noUncheckedIndexedAccess`, ESLint (flat config, type-aware), Prettier
- 226 unit and integration tests covering storage, schema repair, model discovery fallback, the API
  client, SSE parsing, the proxy and key UI behaviour
- Error boundary, ARIA-labelled controls, focus-visible states, keyboard shortcuts

---

## Technology choices

| Area     | Choice                                               | Why                                                                                     |
| -------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------- |
| UI       | React 19 + TypeScript 5 (strict)                     | Type-safe components; strict mode catches the null/undefined bugs this kind of app has. |
| Build    | Vite 8                                               | Fast dev server, and its `base` option is all GitHub Pages needs.                       |
| Styling  | Tailwind CSS 4 + `@tailwindcss/typography`           | Theme tokens as CSS variables make light/dark switching a data attribute.               |
| Markdown | `react-markdown` + `remark-gfm` + `rehype-highlight` | Real parsing rather than regex, with highlighting that respects the active theme.       |
| State    | React context + hooks                                | Small enough not to need a store library; every piece is independently testable.        |
| Storage  | Hand-rolled `localStorage`/`sessionStorage` layer    | Explicit validation of untrusted input, with a memory fallback when storage is blocked. |
| API      | Plain `fetch` in one isolated service module         | Full control over streaming, timeouts, aborts and error mapping.                        |
| Tests    | Vitest + Testing Library + jsdom                     | Same toolchain as the build; component tests assert behaviour, not markup.              |
| Lint/Fmt | ESLint 10 (flat, type-aware) + Prettier              | React-hooks compiler rules included, so effect misuse fails the build.                  |
| Deploy   | GitHub Actions → GitHub Pages                        | No infrastructure to run for a static app.                                              |

---

## Local setup

Requires **Node.js ≥ 22.12** (see `.nvmrc`).

```bash
git clone https://github.com/ehub22/NIM.git
cd NIM
npm install

# Terminal 1 – the CORS proxy (needed for real API calls in dev)
npm run dev:proxy

# Terminal 2 – the app
npm run dev
```

Open the URL Vite prints (default `http://localhost:5173`), open **Settings**, paste an NVIDIA NIM
API key, and start chatting.

Get a key from <https://build.nvidia.com> → your account → **API Keys**. Keys look like `nvapi-…`.

### Scripts

| Command                | What it does                                             |
| ---------------------- | -------------------------------------------------------- |
| `npm run dev`          | Dev server with the `/nim-api` proxy and HMR             |
| `npm run dev:proxy`    | Standalone CORS proxy on `http://127.0.0.1:8787`         |
| `npm run build`        | Type-check, then production build into `dist/`           |
| `npm run preview`      | Serve the production build locally                       |
| `npm test`             | Run the test suite once                                  |
| `npm run test:watch`   | Watch mode                                               |
| `npm run typecheck`    | `tsc -b`                                                 |
| `npm run lint`         | ESLint                                                   |
| `npm run lint:fix`     | ESLint with autofix                                      |
| `npm run format`       | Prettier write                                           |
| `npm run format:check` | Prettier check (used by CI)                              |
| `npm run verify`       | Everything CI runs: format, lint, typecheck, test, build |

---

## Environment variables

All variables are **optional**. Copy `.env.example` to `.env.local` to override them.

| Variable                          | Default (build)                       | Default (`vite dev`) | Purpose                          |
| --------------------------------- | ------------------------------------- | -------------------- | -------------------------------- |
| `VITE_NIM_BASE_URL`               | `https://integrate.api.nvidia.com/v1` | `/nim-api/v1`        | OpenAI-compatible base URL       |
| `VITE_NIM_TIMEOUT_MS`             | `60000`                               | `60000`              | Deadline for non-streaming calls |
| `VITE_NIM_STREAM_IDLE_TIMEOUT_MS` | `120000`                              | `120000`             | Idle deadline while streaming    |
| `VITE_NIM_ENDPOINT_LABEL`         | `NVIDIA NIM hosted API`               | same                 | Label shown in Settings          |

> **Anything prefixed with `VITE_` is inlined into the public JavaScript bundle by Vite.** These
> files are for non-secret configuration only. There is deliberately no variable for an API key.

The endpoint can also be changed at runtime in **Settings → Connection**, which writes to browser
storage and overrides the build-time value.

---

## NVIDIA NIM API configuration

NIM exposes an OpenAI-compatible REST API:

```
POST https://integrate.api.nvidia.com/v1/chat/completions
GET  https://integrate.api.nvidia.com/v1/models
Authorization: Bearer nvapi-…
```

NIM Chat sends a standard chat-completions body:

```json
{
  "model": "meta/llama-3.3-70b-instruct",
  "messages": [{ "role": "user", "content": "Hello" }],
  "temperature": 0.7,
  "top_p": 0.95,
  "max_tokens": 1024,
  "stream": true,
  "stream_options": { "include_usage": true }
}
```

Model discovery uses `GET /v1/models`; the ids it returns are filtered to plausible chat models
(embedding, reranking, ASR, TTS, OCR, image/video and guardrail families are dropped). When
discovery is unavailable — no key yet, offline, or blocked by CORS — the bundled catalogue in
`src/services/nim/catalog.ts` is used and the UI labels it as a fallback. Sending still works for
any id your key can reach, because the model selector keeps the currently selected id even if it is
not in the list.

Point the app at a **self-hosted NIM** (for example a container on your own GPU) by setting
`VITE_NIM_BASE_URL=http://localhost:8000/v1` or by editing the base URL in Settings.

### CORS and the optional proxy

**NVIDIA's hosted endpoint does not advertise CORS support**, and reports from the NVIDIA developer
forums and the community indicate it returns no `Access-Control-Allow-Origin` header. A browser
therefore blocks a direct `fetch()` from a static site such as GitHub Pages, surfacing as a
`TypeError: Failed to fetch` with a CORS message in the console.

NIM Chat handles this three ways:

1. **In development**, `vite.config.ts` proxies `/nim-api/*` to `https://integrate.api.nvidia.com`.
   The request leaves from the dev server, so CORS never applies. This is the default dev base URL
   and needs no configuration.
2. **In production**, if a request fails at the network layer the error message tells you a proxy is
   needed, and the app keeps working against the fallback model list.
3. **An optional proxy is included** at `proxy/server.mjs` — zero dependencies, streaming
   pass-through, and it never reads or stores your `Authorization` header.

Run it locally:

```bash
PORT=8787 node proxy/server.mjs
# then set VITE_NIM_BASE_URL=http://127.0.0.1:8787/v1
```

To host it alongside the Pages site, deploy it anywhere that can run Node (Fly.io, Render, a
container, a Cloud Run service) and set `VITE_NIM_BASE_URL` to its `/v1` URL at build time. Set
`ALLOWED_ORIGIN` to your exact Pages origin rather than the default `*`.

---

## API key security

This is a **static, browser-only application**, which has consequences worth stating plainly:

- The key is entered by you and stored in your browser — `localStorage` by default, or
  `sessionStorage` if you turn off "Remember the key in this browser" (then it disappears when the
  tab closes).
- Requests go **from your browser to NVIDIA**. There is no backend in the request path, so nothing
  can intercept the key on the way — but anyone with access to the device or browser profile can
  read it out of storage or DevTools.
- The key is **never** written to the repository, the build output, logs, or error messages. Error
  text is passed through a redaction step that replaces the key with `[redacted]` before it can
  reach the UI or the console.
- The key is **not** part of the settings document, so it is never included in a conversation
  export.
- **No API key belongs in GitHub Actions secrets for this project.** A secret injected into a static
  build is downloaded by every visitor. The workflow contains no secrets at all.
- Use **Settings → Connection → Clear API key** to remove it, or **Settings → Data → Delete all
  local data** to remove everything.

Do not use this app on a shared or untrusted machine with a key you care about, and revoke keys at
<https://build.nvidia.com> if a device is lost.

---

## Deploying to GitHub Pages

The repository ships a complete workflow at `.github/workflows/deploy.yml`.

1. **Fork or clone** this repository.
2. In your repo, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push to `main`. The workflow runs automatically.

The workflow:

- triggers on pushes to `main` and on manual dispatch
- installs with `npm ci` using the Node version from `.nvmrc`
- runs `format:check`, `lint`, `typecheck` and the test suite — a failure blocks deployment
- builds with `GITHUB_REPOSITORY_NAME` set from `github.event.repository.name`, so asset URLs are
  prefixed with _your_ repository name automatically (no edits needed after a fork or rename)
- uploads `dist/` with `actions/upload-pages-artifact` and publishes with `actions/deploy-pages`
- declares the minimum permissions: `contents: read`, `pages: write`, `id-token: write`

The site is then live at `https://<your-user>.github.io/<repo>/`.

**Routing:** the app is a single view with modals — there are no client-side routes, so nothing
needs a server-side rewrite. GitHub Pages' lack of SPA rewrites is a non-issue here.

To use a **custom domain**, set `VITE_BASE=/` as a repository variable or in the workflow's build
step, and add your `CNAME`.

> Note: GitHub Pages serves static files only, so it cannot run `proxy/server.mjs`. On Pages the app
> calls NIM directly from the browser; if you hit the CORS limitation described above, host the
> proxy elsewhere and set `VITE_NIM_BASE_URL` to it before building.

---

## Adding a backend proxy later

The client is designed so a real backend can be introduced without touching a component.

Everything HTTP lives in `src/services/nim/client.ts` behind `NimClient`, constructed by
`createNimClient()` in `src/services/nim/index.ts`. Two seams are already in place:

- **`baseUrl`** — point it at your own service that implements the same OpenAI-compatible paths
  (`/models`, `/chat/completions`). Streaming is passed through unchanged.
- **`fetchImpl`** — inject any transport, so a client that adds auth headers, retries or telemetry
  can be swapped in without editing call sites.

A minimal secure design:

1. Add a server that exposes `/api/chat` and `/api/models`, holds `NVIDIA_API_KEY` in its own
   environment, and streams the response back (SSE pass-through).
2. Set `VITE_NIM_BASE_URL` to that server. Remove the key field from Settings, since the server now
   authenticates the user.
3. Keep `src/services/nim/*` as the only place that knows about the wire format.

`proxy/server.mjs` is a working example of the pass-through half; it forwards the browser's
`Authorization` header rather than injecting its own key, which keeps the trust model unchanged
while solving CORS. Injecting a server-held key instead is the one-line change that turns it into a
true backend.

---

## Project structure

```
.
├── .github/workflows/deploy.yml   # Lint, test, build, publish to GitHub Pages
├── proxy/server.mjs               # Optional zero-dependency CORS proxy
├── index.html                     # Pre-paint theme bootstrap
├── src/
│   ├── components/
│   │   ├── chat/                  # Transcript, bubbles, composer, code blocks
│   │   ├── layout/                # Sidebar, conversation items, header
│   │   ├── providers/             # Settings and conversations context providers
│   │   ├── settings/              # Settings dialog sections
│   │   ├── ui/                    # Buttons, modal, fields, toasts, icons
│   │   └── ErrorBoundary.tsx
│   ├── hooks/                     # useChatController, useConversationsController, useModels…
│   ├── pages/ChatPage.tsx         # The single view; wires hooks to components
│   ├── services/nim/              # The only code that talks to NVIDIA
│   │   ├── client.ts              # Requests, streaming, timeouts, aborts
│   │   ├── errors.ts              # Error kinds and redaction
│   │   ├── sse.ts                 # Server-sent-events parser
│   │   ├── catalog.ts             # Fallback model catalogue
│   │   └── config.ts              # Endpoint configuration
│   ├── storage/                   # Keys, safe read/write, schema repair, repositories
│   ├── styles/globals.css         # Theme tokens, markdown and syntax colours
│   ├── types/                     # Domain types
│   └── utils/                     # Titles, time, clipboard, download, markdown helpers
└── tests/                         # Mirrors src/: storage, services, hooks, components, proxy
```

---

## Known limitations

- **CORS on the hosted endpoint.** GitHub Pages cannot run the proxy, so a Pages deployment calls
  NIM directly from the browser and may be blocked. Run the included proxy, or use a dev server.
- **Key exposure.** A browser-only app cannot hide a key from the person using the browser. Use the
  backend proxy design above for anything multi-user.
- **Local storage limits.** Browsers typically allow ~5 MB per origin. Long conversations will
  eventually hit it; the app surfaces a warning in the sidebar and keeps working in memory. Export
  and delete old conversations when that happens.
- **Model list drift.** The fallback catalogue is a snapshot. Discovery refreshes it whenever a key
  is configured, but a stale id can still be selected manually and rejected by the API.
- **Token counting is approximate.** Usage figures come from the API's own `usage` field when the
  model reports it; there is no client-side tokenizer, so no prompt-length pre-flight check.
- **No multimodal input.** Text only; the request body uses string content parts.
- **No server-side auth or rate limiting.** Anything you deploy is open to whoever has the URL.

---

## License

MIT
