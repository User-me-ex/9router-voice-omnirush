# 9Router: Real-time Voice Gateway + OmniRush Provider

> **Experimental, AI-assisted code. Not production-ready.**
>
> This repository was produced with substantial AI assistance and has not been
> reviewed or endorsed by the upstream 9Router maintainers. It may contain bugs,
> incomplete error handling, security weaknesses, or provider-specific breakage.
> Review the code and test it in an isolated environment before exposing it to
> untrusted networks. Use at your own risk.
>
> This project is not affiliated with or endorsed by the 9Router project.

A source-level change set for [9Router](https://github.com/decolua/9router) that adds a
duplex real-time voice gateway, a dashboard for live configurations, a standalone browser
test lab, and an OmniRush device-code OAuth provider.

Base version: **9Router v0.5.109** (upstream commit `f39d8f07`).

## Highlights

- **Real-time voice WebSocket gateway** at `/v1/voice/<config>` (plus `/live` and
  `/live/*`), wired into `custom-server.js` ahead of Next.js.
- **Three adapters** with ranked fallback: Google Gemini Live, OpenAI Realtime, and
  Qwen Omni Realtime.
- **Duplex PCM16 audio**, live text prompts, barge-in/interrupt, keepalive, transcripts,
  turn completion events, and per-config sample rates.
- **Dashboard page** at `/dashboard/live` to create, rank, verify, and test live configs.
- **Token authentication** for non-loopback clients.
- **OmniRush provider** with device-code OAuth, token refresh, Responses API transport,
  and dashboard sign-in.
- **Standalone Voice Lab** (`voice-lab/`) for testing TTS, STT, and the live gateway
  without the dashboard.

## Repository layout

```
custom-server.js                 WebSocket upgrade routing for /voice, /live, /v1/voice
live-gateway.js                  Real-time voice gateway (adapters, fallback, auth)
voice-gateway.js                 Legacy Gemini voice gateway (kept for /voice)
omni-overload-hook.cjs           Runtime hook used by custom-server.js
Dockerfile                       Runtime image changes (ws, standalone output)
next.config.mjs                  Next.js configuration changes
open-sse/                        OmniRush provider, executor, registry, token refresh
src/app/(dashboard)/dashboard/live/
                                 Live configuration UI and protocol docs
src/app/api/live/                Live config/models/probe/test API routes
src/app/api/v1/voice/            HTTP companion route for the voice gateway
src/lib/live/                    Adapter definitions and config normalization
src/lib/oauth/providers/         OmniRush OAuth provider
src/shared/components/           Sidebar/header/OAuth modal integration
public/realtime-voice-test.html  Test page shipped with the app
patch/9router-voice-omnirush.patch
                                 Complete 32-file patch against f39d8f07
voice-lab/                       Standalone test page and local helper server
docs/NOTES.md                    Architecture, protocol, verification, known issues
```

The files above are only the changed or added files. This repository is **not** a
complete 9Router distribution. Apply it to a clean v0.5.109 checkout.

Build artifacts (`node_modules/`, `.next/`) are intentionally not committed; a compiled
runtime is roughly 1 GB. Build from source with the steps below.

## Requirements

- Node.js 20.9 or newer for the 9Router build (follow upstream requirements).
- Node.js with `node:sqlite` support for the Voice Lab helper (Node 22.5+ with the
  experimental flag, or Node 24+).
- npm.
- A clean 9Router checkout at v0.5.109 (`f39d8f07`).
- Provider credentials supported by 9Router for the adapter you want to test.

## Installation

### Option A: apply the patch (recommended)

```bash
git clone https://github.com/decolua/9router.git
cd 9router
git checkout f39d8f07
git apply --binary /path/to/9router-voice-omnirush/patch/9router-voice-omnirush.patch
```

### Option B: copy the changed files

Copy every path in this repository (except `patch/`, `docs/`, `voice-lab/`, `README.md`,
`LICENSE`, and `NOTICE`) over the same path in the v0.5.109 checkout.

## Build and run

```bash
npm install
npm run build
node custom-server.js --port 20128
```

Open `http://localhost:20128/dashboard/live`.

`npm start` also works and defaults to port 20127. Pass `--port` to `custom-server.js`
when you need a specific port. The Voice Lab examples below assume port 20128; change
them if you use another port.

The included `Dockerfile` changes copy the optional `ws` dependency into the runtime
image and start `custom-server.js`.

## Configure real-time voice

1. Open **Dashboard -> Live**.
2. Create a live configuration: adapter, provider/model, voice, system prompt, input and
   output sample rates, and optional fallbacks.
3. Verify the configuration from the dashboard, then connect a WebSocket client to:

   ```
   ws://127.0.0.1:20128/v1/voice/<config-id>
   ```

4. Append `?token=<token>` for non-loopback clients. The token is stored in
   `<DATA_DIR>/live-ws-token` and is also available to an authenticated dashboard session
   through the live config API.

`DATA_DIR` defaults to `%APPDATA%\9router` on Windows. Set `DATA_DIR` to override it.

Loopback connections bypass the token check. This also means that if a reverse tunnel
connects to 9Router from loopback, the token is **not** enforced on that path; the
endpoint is only as private as the tunnel URL.

## Wire protocol

Audio is raw **PCM16 mono little-endian** at the configuration's input/output sample
rates. Binary frames may contain arbitrary chunk sizes.

Client to server:

| Frame | Payload | Purpose |
|---|---|---|
| binary | PCM16 mono LE | Microphone audio |
| JSON | `{"type":"text","text":"..."}` | Text prompt during a live session |
| JSON | `{"type":"interrupt"}` | Stop the current answer (barge-in) |
| JSON | `{"type":"ping"}` | Keepalive |

Server to client:

| Frame | Payload | Purpose |
|---|---|---|
| binary | PCM16 mono LE | Assistant audio |
| JSON | `{"type":"ready","model":"...","adapter":"...","rank":1}` | Upstream session accepted |
| JSON | `{"type":"status","state":"connecting\|connected\|reconnecting\|disconnected"}` | Connection state |
| JSON | `{"type":"text","role":"user\|assistant\|system","text":"..."}` | Transcript or notice |
| JSON | `{"type":"turnComplete"}` | Assistant finished speaking |
| JSON | `{"type":"interrupted"}` | Current answer was cut off |
| JSON | `{"type":"inputGate","muted":true\|false"}` | Server input-gating hint |
| JSON | `{"type":"error","code":"...","message":"..."}` | Failure |
| JSON | `{"type":"pong"}` | Keepalive reply |

### Browser capture and playback

The Voice Lab implements the browser side: an `AudioWorklet` captures mono audio,
converts float samples to `Int16Array`, and sends the buffer as a binary frame. Incoming
binary frames are converted back to float samples and scheduled on an `AudioContext` for
gap-free playback. See `voice-lab/index.html` and `docs/NOTES.md` for the full code.

## Voice Lab

The standalone test page does not require the dashboard.

```bash
node voice-lab/server.mjs
# open http://127.0.0.1:8788/
```

Environment variables:

| Variable | Default | Purpose |
|---|---|---|
| `NINEROUTER_URL` | `http://127.0.0.1:20128` | 9Router base URL |
| `VOICE_LAB_PORT` | `8788` | Local lab port (bound to 127.0.0.1) |
| `DATA_DIR` | `%APPDATA%\9router` (Windows) | 9Router data directory |

The helper reads the local 9Router SQLite database in read-only mode to list live
configurations and read the WS token. It also proxies `/v1/*` requests to 9Router for the
TTS/STT tabs. Do not expose the helper to a network; it binds to loopback by default.

## OmniRush provider

OmniRush is registered as a first-class provider with the alias `omni`.

- Device-code OAuth flow (`/omnirush/device/authorize`, `/token`, `/refresh`, `/me`).
- CLI identity headers (`X-OmniRush-Client: cli/<version>` and a matching `User-Agent`)
  required by the upstream version gate.
- Token storage in `providerConnections`, refresh support, and profile lookup.
- Requests use OmniRush's Responses API with forced streaming.
- Registry models: `gpt-6-astra`, `gpt-6.1-sol`, `gpt-6-sol` (text/image, 400k context).

No OmniRush credentials are included in this repository.

## Verification performed

The change set was tested against a local build on 2026-10-30:

- Text turn over `ws://127.0.0.1:20128/v1/voice/live-gemini`:
  `ready` -> `status:connected` -> assistant text `live gateway ok` -> **112,322 bytes**
  of PCM16 audio -> `turnComplete`.
- Microphone turn from Chrome using the Voice Lab: prompt "Say exactly: browser live ok"
  returned the reply `browser live ok`.
- Non-loopback LAN client: `READY` with a valid `?token=`; `unauthorized` without it.
- Cloudflare quick tunnel (`tunnelUrl` created by 9Router): a full text turn worked over
  `wss://.../v1/voice/live-gemini`.

These results are specific to the test environment and are not a guarantee that every
provider, model, or deployment will work.

## Known limitations

- The public tunnel alias (`https://r<id>.abc-tunnel.us`) returns **502** for WebSocket
  upgrades; the direct `*.trycloudflare.com` tunnel URL works. The dashboard live page is
  affected the same way through that alias.
- Through the built-in tunnel, cloudflared connects from loopback, so the WS token is not
  enforced (see the security note above).
- Adapter behavior depends on provider APIs that may change without notice.
- Error handling and reconnection paths are best-effort and not exhaustively tested.
- The AI-assisted implementation has not been reviewed by upstream maintainers.

## What is not included

- `node_modules/`, `.next/`, build output, Docker images.
- Databases, settings, provider connections, cookies, certificates.
- API keys, OAuth tokens, `.env` files, `live-ws-token`.
- User-specific maintenance scripts, logs, and local test clients.

## Security

- No credentials are committed. If you find a secret in this repository, please open an
  issue or contact the repository owner so it can be removed and rotated.
- Treat the gateway as an experimental service. Put it behind authentication and a
  reverse proxy, restrict origins, and do not expose it directly to the public internet.
- The Voice Lab helper exposes the local WS token to local processes that can reach
  `127.0.0.1:8788`. Keep it bound to loopback.

## AI disclosure

The implementation, documentation, and test tooling in this repository were produced with
heavy AI assistance. Output was manually exercised against a running 9Router instance,
but the code has not had a formal security review or upstream maintainer review.
Treat the repository as a starting point for review and contribution, not as trusted
production software.

## License and attribution

This repository is distributed under the MIT License. See `LICENSE` and `NOTICE`.

9Router is Copyright (c) 2024-2026 decolua and contributors and is licensed under the MIT
License: https://github.com/decolua/9router

## Contributing

Issues and pull requests are welcome. If you plan to upstream this work, please coordinate
with the 9Router maintainers and expect to split the change into smaller, reviewable
commits (voice gateway, OmniRush provider, dashboard, and test tooling).
