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

Base version: **9Router v0.5.112** (upstream commit `1fe586b`).

## Quick start (clone and run)

Requirements: Node.js 20.9+ and `git` on `PATH`.

```bash
git clone https://github.com/User-me-ex/9router-voice-omnirush.git
cd 9router-voice-omnirush

# Windows (cmd or PowerShell)
.\9rtmod

# macOS / Linux
./9rtmod
```

The first run is unattended and takes a few minutes: it clones upstream 9Router
`v0.5.112` into `.9rtmod/app` (gitignored), overlays the changed files from this
repository, installs dependencies, and produces a production build. Then it starts
the server on port `20128`:

- Dashboard: `http://localhost:20128/dashboard/live`
- Voice WebSocket: `ws://127.0.0.1:20128/v1/voice/<live-config>`

Later runs skip the download and build unless something changed.

```
9rtmod start      # default: install/build if needed, then run
9rtmod stop       # stop the server
9rtmod restart    # stop, then start
9rtmod status     # build and process state
9rtmod logs       # last server log
9rtmod build      # force rebuild, then restart
9rtmod update     # git pull this repo, re-apply changes, rebuild
9rtmod doctor     # check node, git, deps, native sqlite
9rtmod --port 3000
```

Notes:

- Builds run with a repo-local home directory (`.9rtmod/build-home`) because
  Next.js 16 build tracing on Windows can fail on protected `AppData` folders.
- Data, provider credentials, and the live WebSocket token stay in the normal
  9Router data directory (`%APPDATA%\9router` on Windows); nothing is stored in
  this repository.
- You still need to add provider connections in the dashboard before voice or
  OmniRush requests work.

## Keeping up to date

`npm i -g 9router@latest --prefer-online` updates the **stock** CLI only. This
modified build lives in its own checkout (`.9rtmod/app`), so that command cannot
overwrite or remove these changes, and it does not upgrade this build either.

To move the modified build to a newer upstream release while keeping every local
change:

```bash
./9rtmod update            # newest upstream release
./9rtmod update --to v0.5.112
```

The updater re-clones the requested upstream tag, re-applies the local change set,
reinstalls dependencies if needed, rebuilds, and restarts. If upstream has edited
one of the same files, it tries a 3-way merge first and only falls back to
overwriting the changed files (with a warning) when the merge conflicts.

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
                                 Complete 32-file patch against 1fe586b
voice-lab/                       Standalone test page and local helper server
docs/NOTES.md                    Architecture, protocol, verification, known issues
```

The files above are only the changed or added files. This repository is **not** a
complete 9Router distribution. Apply it to a clean v0.5.112 checkout.

Build artifacts (`node_modules/`, `.next/`) are intentionally not committed; a compiled
runtime is roughly 1 GB. Build from source with the steps below.

## Requirements

- Node.js 20.9 or newer for the 9Router build (follow upstream requirements).
- Node.js with `node:sqlite` support for the Voice Lab helper (Node 22.5+ with the
  experimental flag, or Node 24+).
- npm.
- A clean 9Router checkout at v0.5.112 (`1fe586b`).
- Provider credentials supported by 9Router for the adapter you want to test.

## Installation

### Option A: apply the patch (recommended)

```bash
git clone https://github.com/decolua/9router.git
cd 9router
git checkout 1fe586b
git apply --binary /path/to/9router-voice-omnirush/patch/9router-voice-omnirush.patch
```

### Option B: copy the changed files

Copy every path in this repository (except `patch/`, `docs/`, `voice-lab/`, `README.md`,
`LICENSE`, and `NOTICE`) over the same path in the v0.5.112 checkout.

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

The Voice Lab implements the client side: an `AudioWorklet` captures mono audio from the
user's microphone, converts floating-point samples to 16-bit integer PCM (`Int16Array`),
and streams raw binary frames to the server. Incoming binary frames from the assistant
are converted back to float samples and scheduled on an `AudioContext` for seamless,
gap-free playback.

### Direct WebSocket Code Example

Below is a complete, minimal JavaScript example demonstrating direct communication with
the real-time voice gateway:

```javascript
// Connect to the real-time voice endpoint (append ?token=... for non-loopback connections)
const ws = new WebSocket("ws://127.0.0.1:20128/v1/voice/live-gemini");
ws.binaryType = "arraybuffer";

// 1. Audio Output Context (24 kHz for assistant playback)
const outCtx = new AudioContext({ sampleRate: 24000 });
let playAt = outCtx.currentTime;

ws.onopen = () => {
  console.log("WebSocket connected. Waiting for 'ready' frame...");
};

ws.onmessage = (event) => {
  // Binary frame = raw PCM16 audio from the assistant
  if (event.data instanceof ArrayBuffer) {
    const pcm16 = new Int16Array(event.data);
    const float32 = Float32Array.from(pcm16, (v) => v / 32768);
    const audioBuffer = outCtx.createBuffer(1, float32.length, 24000);
    audioBuffer.copyToChannel(float32, 0);

    const source = outCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(outCtx.destination);

    playAt = Math.max(playAt, outCtx.currentTime + 0.03);
    source.start(playAt);
    playAt += audioBuffer.duration;
    return;
  }

  // JSON frame = status, transcripts, turn completions, or errors
  const msg = JSON.parse(event.data);
  switch (msg.type) {
    case "ready":
      console.log(`Live gateway ready (model: ${msg.model}, adapter: ${msg.adapter})`);
      // Optional: send an initial text prompt during the live session
      ws.send(JSON.stringify({ type: "text", text: "Say hello and introduce yourself briefly." }));
      break;
    case "text":
      console.log(`[${msg.role}]: ${msg.text}`);
      break;
    case "turnComplete":
      console.log("Assistant turn complete.");
      break;
    case "interrupted":
      console.log("Assistant speech was interrupted.");
      break;
    case "error":
      console.error("Live error:", msg.message);
      break;
  }
};

// 2. Microphone Input via AudioWorklet (16 kHz mono PCM16)
async function startMicrophone() {
  const inCtx = new AudioContext({ sampleRate: 16000 });
  const workletCode = `class PCMProcessor extends AudioWorkletProcessor {
    process(inputs) {
      const channel = inputs[0] && inputs[0][0];
      if (!channel) return true;
      const pcm16 = new Int16Array(channel.length);
      for (let i = 0; i < channel.length; i++) {
        pcm16[i] = Math.max(-1, Math.min(1, channel[i])) * 32767;
      }
      this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
      return true;
    }
  }
  registerProcessor("pcm-processor", PCMProcessor);`;

  await inCtx.audioWorklet.addModule(URL.createObjectURL(new Blob([workletCode], { type: "text/javascript" })));
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, sampleRate: 16000 } });
  const source = inCtx.createMediaStreamSource(stream);
  const pcmNode = new AudioWorkletNode(inCtx, "pcm-processor");

  pcmNode.port.onmessage = (e) => {
    // Stream raw PCM16 chunks directly over WebSocket
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(e.data);
    }
  };

  source.connect(pcmNode);
  console.log("Microphone streaming active.");
}

// 3. User barge-in / interruption
function interrupt() {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "interrupt" }));
  }
}
```

## Voice Lab (Interactive HTML/CSS/JS Test Harness)

The repository includes a dedicated, standalone browser test page in `voice-lab/index.html`
with its accompanying helper in `voice-lab/server.mjs`.

### Why use the Voice Lab?
- **No full dashboard build needed:** Test voice capabilities immediately without running
  Next.js webpack builds or logging into the dashboard.
- **Three-in-one testing:** Includes interactive tabs for **Text-to-Speech (TTS)**,
  **Speech-to-Text (STT)**, and **Live Duplex Voice Session**.
- **Real-time Diagnostics:** Visual indicator for WebSocket connection status, live audio
  waveform visualizer, event logging panel, and direct text injection while live.
- **Inspectable Source:** Clean, vanilla HTML/CSS and JavaScript with no external framework
  dependencies—ideal for learning how the duplex AudioWorklet and PCM streams are wired.

### How to run the Voice Lab

```bash
# 1. Start your 9Router instance (e.g. on port 20128)
node custom-server.js --port 20128

# 2. In another terminal, start the Voice Lab helper
node voice-lab/server.mjs
# open http://127.0.0.1:8788/
```

Environment variables for `voice-lab/server.mjs`:

| Variable | Default | Purpose |
|---|---|---|
| `NINEROUTER_URL` | `http://127.0.0.1:20128` | 9Router base URL |
| `VOICE_LAB_PORT` | `8788` | Local lab port (bound to 127.0.0.1) |
| `DATA_DIR` | `%APPDATA%\9router` (Windows) | 9Router data directory |

The helper reads the local 9Router SQLite database in read-only mode to discover configured
live adapters and the token (`live-ws-token`). It also proxies standard `/v1/*` audio
requests to 9Router. You can also open `voice-lab/index.html` directly as a static file in
any modern browser and enter your 9Router gateway URL and token manually.

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
