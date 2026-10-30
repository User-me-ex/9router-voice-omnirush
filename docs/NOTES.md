# 9Router — Real-time voice gateway + OmniRush provider

Contribution notes for the 9Router project (`decolua/9router`).
Base: **v0.5.109** (upstream commit `f39d8f07`), plus three local commits:

- `fe85d487` Local: OmniRush provider, voice gateway, overload hook, dataDir/tracing tweaks
- `b6646a31` deploy: v0.5.109-omni with Docker runtime fixes
- `7e108782` fix(docker): emit Next standalone output for container builds

Upstream check (done 2026-10-30): current `master` is **0.5.112**. Its tree has no
`live-gateway.js`, `voice-gateway.js`, `src/lib/live/`, `src/app/api/live/`,
`src/app/api/v1/voice/`, `dashboard/live`, or any `omnirush` provider/registry
entry. Open issues/PRs mention Gemini Live only for STT (e.g. #4006), not a
duplex voice session gateway. Both features therefore appear to be new.

Everything here is offered under the project's existing MIT license. No API
keys, OAuth tokens, cookies, databases, certificates, or personal data are
included in the patch/archive.

---

## 1. Real-time voice communication (WebSocket)

### What it adds

- A duplex WebSocket gateway at **`/v1/voice/<live-config>`** (also `/live`,
  `/live/*`), wired directly into `custom-server.js` before Next.js handles
  HTTP. The legacy `/voice` path is kept for the older Gemini gateway.
- A dashboard page at **`/dashboard/live`** to create, rank, verify, and test
  live configs (Gemini Live, OpenAI Realtime, Qwen Omni Realtime adapters).
- Server-side adapters with ranked fallback, session resumption, interruption,
  and per-config sample rates:
  - `gemini-live` — default model `gemini-3.8-live`, voice `Kore`, 16 kHz in /
    24 kHz out, input mime `audio/pcm;rate=16000`
  - `openai-realtime` — default `gpt-realtime-2.1`, 24 kHz in / 24 kHz out
  - `qwen-realtime` — default `qwen3.5-omni-flash-realtime`, 16 kHz in / 24 kHz out
- Config persistence in the existing settings row (`settings.liveCommunication`)
  with a `defaultId` and per-config `fallbacks` list.
- Access control: loopback connections bypass auth; any non-loopback connection
  must pass `?token=<live-ws-token>` (token file
  `%APPDATA%\9router\live-ws-token`, also returned by `GET /api/live/config`
  to an authenticated dashboard session).

### Wire protocol (implemented)

Client → server:

| Frame | Payload | Purpose |
|---|---|---|
| binary | Raw PCM16 mono LE at the config input rate (default 16 kHz) | microphone audio |
| JSON | `{"type":"text","text":"..."}` (≤ 8000 chars) | text prompt while live |
| JSON | `{"type":"interrupt"}` | barge-in / stop current answer |
| JSON | `{"type":"ping"}` | keepalive |

Server → client:

| Frame | Payload | Purpose |
|---|---|---|
| binary | Raw PCM16 mono LE at the config output rate (default 24 kHz) | assistant audio |
| JSON | `{"type":"ready","model":"...","adapter":"...","rank":1}` | upstream session accepted |
| JSON | `{"type":"status","state":"connecting\|connected\|reconnecting\|disconnected"}` | connection state |
| JSON | `{"type":"text","role":"user\|assistant\|system","text":"..."}` | transcripts / notices |
| JSON | `{"type":"turnComplete"}` | assistant finished speaking |
| JSON | `{"type":"interrupted"}` | current answer was cut off |
| JSON | `{"type":"inputGate","muted":true\|false}` | input gating proposal from server |
| JSON | `{"type":"error","code":"...","message":"..."}` | failure |
| JSON | `{"type":"pong"}` | keepalive reply |

### Server wiring (`custom-server.js`)

```js
const voiceGateway = require("./voice-gateway");
const liveGateway = require("./live-gateway");

if (event === "upgrade" && req.headers.upgrade === "websocket" &&
    String(req.url || "").split("?")[0] === "/voice") {
  voiceGateway.handleUpgrade(req, socket, head);
}

if (event === "upgrade" && req.headers.upgrade === "websocket" &&
    (String(req.url || "").split("?")[0] === "/live" ||
     String(req.url || "").startsWith("/live/") ||
     String(req.url || "").startsWith("/v1/voice/"))) {
  liveGateway.handleUpgrade(req, socket, head);
}
```

### Browser side (capture + playback, used by the test page)

```js
const ws = new WebSocket(`ws://127.0.0.1:20128/v1/voice/live-gemini?token=${TOKEN}`);
ws.binaryType = "arraybuffer";

const inCtx = new AudioContext({ sampleRate: 16000 });
const worklet = `class PCM extends AudioWorkletProcessor {
  process(i) {
    const c = i[0] && i[0][0]; if (!c) return true;
    const p = new Int16Array(c.length);
    for (let k = 0; k < c.length; k++) p[k] = Math.max(-1, Math.min(1, c[k])) * 32767;
    this.port.postMessage(p.buffer, [p.buffer]);
    return true;
  }
}`;
await inCtx.audioWorklet.addModule(URL.createObjectURL(new Blob([worklet], { type: "text/javascript" })));
const node = new AudioWorkletNode(inCtx, "pcm");
new MediaStreamAudioSourceNode(inCtx, { mediaStream: await navigator.mediaDevices.getUserMedia({ audio: true }) })
  .connect(node);
node.port.onmessage = (e) => ws.readyState === 1 && ws.send(e.data);

const outCtx = new AudioContext({ sampleRate: 24000 });
let playAt = outCtx.currentTime;
ws.onmessage = (ev) => {
  if (typeof ev.data !== "string") {              // PCM16 -> Float32 -> speakers
    const f32 = Float32Array.from(new Int16Array(ev.data), (v) => v / 32768);
    const buf = outCtx.createBuffer(1, f32.length, 24000);
    buf.copyToChannel(f32, 0);
    const src = outCtx.createBufferSource();
    src.buffer = buf; src.connect(outCtx.destination);
    playAt = Math.max(playAt, outCtx.currentTime + 0.03);
    src.start(playAt); playAt += buf.duration;
    return;
  }
  const msg = JSON.parse(ev.data);
  if (msg.type === "text") console.log(msg.role + ": " + msg.text);
  if (msg.type === "interrupt") console.log("barge-in");
};
ws.send(JSON.stringify({ type: "text", text: "Say exactly: live gateway ok" }));
```

The attached `9router-realtime-voice-lab.html` is a standalone test UI with
TTS, STT, and this live-session tab (config picker, live gateway base field,
mute, interrupt, text prompts, event log, audio playback).

---

## 2. OmniRush provider (device-code OAuth)

`OmniRush` is integrated as a first-class provider, alias **`omni`**:

- Device-code OAuth flow (`/omnirush/device/authorize`, `/token`, `/refresh`,
  `/me`) using the published CLI identity header `X-OmniRush-Client:
  cli/2.7.2` and matching `User-Agent` so the manager's version gate accepts us.
- Token storage in `providerConnections` with refresh support, email/display
  name from `/device/me`, and a gateway URL default.
- Requests go to OmniRush's Responses API
  (`https://omnirush.ai/omnirush/v1/responses`, `openai-responses`, forced
  streaming). Registry models: `gpt-6-astra`, `gpt-6.1-sol`, `gpt-6-sol`
  (text/image, 400k context).
- Dashboard: provider card with icon, device-code modal, and OAuth route
  handling (`src/app/api/oauth/[provider]/[action]`).

Key files: `src/lib/oauth/providers/omnirush.js`,
`open-sse/providers/registry/omnirush.js`, `open-sse/executors/omnirush.js`,
`open-sse/config/omnirush.js`, `open-sse/services/tokenRefresh/providers.js`.

```js
// device code request (abridged from src/lib/oauth/providers/omnirush.js)
const res = await fetch(config.deviceAuthorizeUrl, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "user-agent": omnirushUserAgent(CLIENT_VERSION),
    "x-omnirush-client": `cli/${CLIENT_VERSION}`,
  },
  body: JSON.stringify({ device_name: "9router", platform: process.platform }),
});
const { device_code, user_code, verification_uri } = await res.json();
// show user_code + verification_uri, then poll deviceTokenUrl until access_token
```

---

## 3. How to apply, build, run

```bash
# from a clean checkout at v0.5.109 (f39d8f07)
git apply --binary 9router-voice-omnirush.patch
# or unzip 9router-voice-omnirush-source.zip over the tree

npm install
npm run build        # Next standalone output (see Dockerfile)
node custom-server.js  # serves UI + /v1 + WebSocket gateways on :20128
```

Docker path is already covered by the included `Dockerfile` changes
(`ws` copied into the runtime image, `CMD ["node", "custom-server.js"]`).
Compose runtime build for this change is ~1 GB including `node_modules` and
`.next`; it exceeds typical email limits, which is why this mail carries the
source patch/archive instead of a binary build.

### Configure and test

1. Open `http://localhost:20128/dashboard/live`, add a live config
   (provider/model/voice), save and verify.
2. Connect with the test page or any WS client:
   `ws://127.0.0.1:20128/v1/voice/<config-id>` (append `?token=` off-loopback).
3. Send `{"type":"text","text":"..."}` and listen for PCM16 frames plus
   `turnComplete`.

---

## 4. Verification performed (2026-10-30)

- Text turn over `ws://127.0.0.1:20128/v1/voice/live-gemini`:
  `ready` → `status:connected` → assistant text `live gateway ok` →
  112,322 bytes of PCM16 audio → `turnComplete`.
- Same flow from Chrome (mic granted) on the attached test page:
  prompt "Say exactly: browser live ok" returned reply `browser live ok`.
- Non-loopback LAN client: `READY` with `?token=...`; `unauthorized` without.
- Cloudflare quick tunnel (the `tunnelUrl` 9Router creates): full text turn
  worked over `wss://…/v1/voice/live-gemini`.
- Known limitation found while testing 9Router's public tunnel alias
  (`https://r<id>.abc-tunnel.us`): HTTP proxying works, but WebSocket upgrades
  return **502** from that Cloudflare Worker, so live voice needs the direct
  `*.trycloudflare.com` tunnel URL. The dashboard's own live page hits the same
  502 through that alias.
- Security note: through the 9Router tunnel, cloudflared connects to the origin
  from loopback, so the WS token is not enforced on that path; the live
  endpoint is only as private as the tunnel URL.

---

## 5. Files changed (32)

`custom-server.js`, `live-gateway.js`, `voice-gateway.js`, `Dockerfile`,
`next.config.mjs`, `omni-overload-hook.cjs`,
`open-sse/config/omnirush.js`, `open-sse/executors/{index,omnirush}.js`,
`open-sse/providers/capabilities.js`,
`open-sse/providers/registry/{index,omnirush}.js`,
`open-sse/services/tokenRefresh.js`,
`open-sse/services/tokenRefresh/providers.js`,
`public/providers/omnirush.png`, `public/realtime-voice-test.html`,
`src/app/(dashboard)/dashboard/live/{page,IntegrationDocs}.js`,
`src/app/api/live/{config,models,probe,test}/route.js`,
`src/app/api/v1/voice/[...slug]/route.js`,
`src/lib/live/index.js`,
`src/lib/oauth/constants/oauth.js`,
`src/lib/oauth/providers/{index,omnirush}.js`,
`src/shared/components/{Header,OAuthModal,Sidebar}.js`,
`src/app/api/providers/[id]/test/testUtils.js`,
`src/app/api/oauth/[provider]/[action]/route.js`.

Happy to split this into two PRs (voice gateway / OmniRush provider) if that is
easier to review.
