"use client";

import { useState, useSyncExternalStore } from "react";
import { Button, Card } from "@/shared/components";

function CodeBlock({ code, label }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] uppercase tracking-wide text-text-muted">{label}</span>
        <Button variant="ghost" size="sm" icon={copied ? "check" : "content_copy"} onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="text-[12px] leading-relaxed overflow-x-auto p-4 rounded-[10px] bg-surface-2 border border-border-subtle font-mono text-text-main">
        <code>{code}</code>
      </pre>
    </div>
  );
}

const CLIENT_EVENTS = [
  {
    frame: "binary",
    payload: "Raw PCM16 mono, little-endian, at the configured input rate (default 16 kHz)",
    use: "Stream microphone audio",
  },
  { frame: '{"type":"text","text":"..."}', payload: "Up to 8000 chars", use: "Send a text prompt while audio is live" },
  { frame: '{"type":"interrupt"}', payload: "—", use: "Barge-in: stop the assistant's current answer" },
  { frame: '{"type":"ping"}', payload: "—", use: "Keep-alive (server replies pong)" },
];

const SERVER_EVENTS = [
  { frame: "binary", payload: "Raw PCM16 mono at the configured output rate (default 24 kHz)", use: "Play assistant audio" },
  { frame: '{"type":"ready","model":"...","adapter":"...","rank":1}', payload: "Session accepted upstream", use: "Know which ranked API serves you" },
  { frame: '{"type":"status","state":"connecting|connected|reconnecting|disconnected"}', payload: "detail", use: "Connection + failover progress" },
  { frame: '{"type":"text","role":"user|assistant|system","text":"..."}', payload: "modality on voice turns", use: "Transcripts, failover notices" },
  { frame: '{"type":"turnComplete"}', payload: "—", use: "Assistant finished speaking" },
  { frame: '{"type":"interrupted"}', payload: "—", use: "Assistant was cut off" },
  { frame: '{"type":"inputGate","muted":true}', payload: "Only when barge-in is disabled", use: "Tell the client to mute the mic" },
  { frame: '{"type":"error","code":"...","message":"..."}', payload: "unauthorized | config_missing | all_fallbacks_failed", use: "Fatal session errors" },
];

const BROWSER_SNIPPET = `// 1) Connect. The token is required from any non-loopback host:
//    GET /api/live/config -> wsToken
const TOKEN = "<live-ws-token>";
const ws = new WebSocket(\`ws://127.0.0.1:20128/v1/voice/my-gemini?token=\${TOKEN}\`);
ws.binaryType = "arraybuffer";

// 2) Microphone -> 16 kHz PCM16 chunks
const inCtx = new AudioContext({ sampleRate: 16000 });
const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
const src = inCtx.createMediaStreamSource(mic);
const worklet = 'class PCM extends AudioWorkletProcessor{process(i){const c=i[0]&&i[0][0];if(!c)return true;const p=new Int16Array(c.length);for(let k=0;k<c.length;k++)p[k]=Math.max(-1,Math.min(1,c[k]))*32767;this.port.postMessage(p.buffer,[p.buffer]);return true}}registerProcessor("pcm",PCM)';
await inCtx.audioWorklet.addModule(URL.createObjectURL(new Blob([worklet], { type: "text/javascript" })));
const node = new AudioWorkletNode(inCtx, "pcm");
src.connect(node);
node.port.onmessage = (e) => ws.readyState === 1 && ws.send(e.data);

// 3) Model audio (24 kHz PCM16) -> speakers
const outCtx = new AudioContext({ sampleRate: 24000 });
let playAt = 0;
function play(buffer) {
  const f32 = Float32Array.from(new Int16Array(buffer), (v) => v / 32768);
  const buf = outCtx.createBuffer(1, f32.length, 24000);
  buf.copyToChannel(f32, 0);
  const source = outCtx.createBufferSource();
  source.buffer = buf;
  source.connect(outCtx.destination);
  playAt = Math.max(playAt, outCtx.currentTime + 0.02);
  source.start(playAt);
  playAt += buf.duration;
}

// 4) Server events
ws.onmessage = (e) => {
  if (e.data instanceof ArrayBuffer) return play(e.data);
  const msg = JSON.parse(e.data);
  if (msg.type === "text") console.log(msg.role + ": " + msg.text);
  if (msg.type === "turnComplete") playAt = outCtx.currentTime;
  if (msg.type === "error") console.error(msg.code, msg.message);
};

// 5) Text prompt + barge-in
ws.send(JSON.stringify({ type: "text", text: "Summarise this call in one line." }));
ws.send(JSON.stringify({ type: "interrupt" }));`;

const NODE_SNIPPET = `import WebSocket from "ws";

const ws = new WebSocket(
  \`ws://127.0.0.1:20128/v1/voice/my-gemini?token=\${process.env.LIVE_TOKEN}\`
);

ws.on("open", () => {
  ws.send(JSON.stringify({ type: "text", text: "Hello from my backend" }));
});

ws.on("message", (data, isBinary) => {
  if (isBinary) return; // PCM16 @ 24 kHz audio frame
  const msg = JSON.parse(data.toString());
  if (msg.type === "text") console.log(\`[\${msg.role}] \${msg.text}\`);
  if (msg.type === "turnComplete") ws.close();
});`;

const EVENT_SNIPPET = `// client -> server
{"type":"text","text":"What is in the picture?"}
{"type":"interrupt"}
{"type":"ping"}

// server -> client
{"type":"status","state":"connecting","detail":"Rank #1: My Gemini (gemini-3.8-live)"}
{"type":"ready","model":"gemini-3.8-live","name":"My Gemini","adapter":"gemini-live","rank":1,"parallelModality":true}
{"type":"text","role":"user","text":"hello","modality":"voice"}
{"type":"text","role":"assistant","text":"Hi, how can I help?"}
{"type":"turnComplete"}
{"type":"error","code":"all_fallbacks_failed","message":"Full diagnostics were sent as a system message."}`;

export default function IntegrationDocs({ configs = [] }) {
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.host,
    () => "127.0.0.1:20128"
  );

  const exampleName = configs[0]?.name || configs[0]?.id || "my-gemini";
  const wsUrl = `ws://${origin}/v1/voice/${exampleName}`;

  return (
    <div className="flex flex-col gap-6">
      <Card title="Endpoint" icon="cable">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wide text-text-muted">WebSocket endpoint</span>
            <div className="flex flex-wrap items-center gap-2">
              <code className="font-mono text-sm text-brand-500 break-all">{wsUrl}</code>
              <Button variant="ghost" size="sm" icon="content_copy" onClick={() => navigator.clipboard?.writeText(wsUrl)}>
                Copy
              </Button>
            </div>
            <span className="text-xs text-text-muted">
              Plain HTTP is served on the same path, but the session itself is a WebSocket upgrade.
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="flex flex-col gap-2">
              <span className="font-medium text-text-main">Path</span>
              <code className="font-mono text-text-muted">/v1/voice/:nameOrId</code>
              <span className="text-text-muted">
                Use the configuration name or id. Without a path segment the default configuration is used. A Combo name
                resolves to its first live model.
              </span>
            </div>
            <div className="flex flex-col gap-2">
              <span className="font-medium text-text-main">Authentication</span>
              <code className="font-mono text-text-muted">?token=&lt;wsToken&gt;</code>
              <span className="text-text-muted">
                Required for non-loopback clients. Read it from <code className="font-mono">GET /api/live/config</code>{" "}
                (<code className="font-mono">wsToken</code>) or from the dashboard. Requests from 127.0.0.1 skip the check.
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-text-muted">
                <tr>
                  <th className="py-1.5 pr-4 font-medium">Query param</th>
                  <th className="py-1.5 pr-4 font-medium">Effect</th>
                </tr>
              </thead>
              <tbody className="text-text-main">
                <tr className="border-t border-border-subtle">
                  <td className="py-1.5 pr-4 font-mono">model</td>
                  <td className="py-1.5">Override the model of the selected configuration for this session.</td>
                </tr>
                <tr className="border-t border-border-subtle">
                  <td className="py-1.5 pr-4 font-mono">token</td>
                  <td className="py-1.5">Shared live session token.</td>
                </tr>
                <tr className="border-t border-border-subtle">
                  <td className="py-1.5 pr-4 font-mono">custom=1</td>
                  <td className="py-1.5">
                    Ad-hoc session with <code className="font-mono">adapter</code>, <code className="font-mono">model</code>,{" "}
                    <code className="font-mono">wsBaseUrl</code>, <code className="font-mono">credentialRef</code>,{" "}
                    <code className="font-mono">voice</code>, <code className="font-mono">systemPrompt</code>,{" "}
                    <code className="font-mono">inRate</code>, <code className="font-mono">outRate</code>,{" "}
                    <code className="font-mono">headers</code>.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      <Card title="Wire protocol" icon="swap_horiz">
        <div className="flex flex-col gap-5">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-text-muted">
                <tr>
                  <th className="py-1.5 pr-4 font-medium">Client → server</th>
                  <th className="py-1.5 pr-4 font-medium">Payload</th>
                  <th className="py-1.5 font-medium">Purpose</th>
                </tr>
              </thead>
              <tbody className="text-text-main">
                {CLIENT_EVENTS.map((row) => (
                  <tr key={row.frame} className="border-t border-border-subtle align-top">
                    <td className="py-1.5 pr-4 font-mono">{row.frame}</td>
                    <td className="py-1.5 pr-4 text-text-muted">{row.payload}</td>
                    <td className="py-1.5">{row.use}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-text-muted">
                <tr>
                  <th className="py-1.5 pr-4 font-medium">Server → client</th>
                  <th className="py-1.5 pr-4 font-medium">Payload</th>
                  <th className="py-1.5 font-medium">Purpose</th>
                </tr>
              </thead>
              <tbody className="text-text-main">
                {SERVER_EVENTS.map((row) => (
                  <tr key={row.frame} className="border-t border-border-subtle align-top">
                    <td className="py-1.5 pr-4 font-mono">{row.frame}</td>
                    <td className="py-1.5 pr-4 text-text-muted">{row.payload}</td>
                    <td className="py-1.5">{row.use}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-text-muted">
            Send audio and text at the same time: binary frames carry speech while JSON frames carry prompts. The gateway
            abstracts Gemini Live, OpenAI Realtime, Qwen Omni and Vertex behind one protocol, so clients never deal with
            provider-specific payloads.
          </p>
        </div>
      </Card>

      <Card title="Browser client (JavaScript)" icon="code">
        <CodeBlock label="Microphone → model → speakers" code={BROWSER_SNIPPET} />
      </Card>

      <Card title="Server client (Node.js)" icon="dns">
        <CodeBlock label="Text-only session with the ws package" code={NODE_SNIPPET} />
      </Card>

      <Card title="Event reference" icon="data_object">
        <CodeBlock label="JSON frames" code={EVENT_SNIPPET} />
      </Card>

      <Card title="REST helpers" icon="api">
        <div className="flex flex-col gap-2 text-xs text-text-main">
          <div className="flex flex-wrap items-center gap-2">
            <code className="font-mono text-brand-500">http://{origin}/api/live/config</code>
            <Button
              variant="ghost"
              size="sm"
              icon="content_copy"
              onClick={() => navigator.clipboard?.writeText(`http://${origin}/api/live/config`)}
            >
              Copy
            </Button>
          </div>
          <p className="text-text-muted">
            Dashboard endpoints (cookie auth) to bootstrap a client: <code className="font-mono">GET /api/live/config</code>{" "}
            returns the saved configurations and the <code className="font-mono">wsToken</code>;{" "}
            <code className="font-mono">GET /api/live/models</code> lists live-capable models and credentials;{" "}
            <code className="font-mono">POST /api/live/test</code> verifies one configuration. Server code should keep the
            token out of the browser and open the WebSocket from your backend instead.
          </p>
        </div>
      </Card>
    </div>
  );
}
