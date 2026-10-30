import http from "node:http";
import https from "node:https";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import os from "node:os";

const here = path.dirname(fileURLToPath(import.meta.url));
const PAGE = path.join(here, "index.html");
const UPSTREAM_URL = new URL(process.env.NINEROUTER_URL || "http://127.0.0.1:20128");
const UPSTREAM = {
  hostname: UPSTREAM_URL.hostname,
  port: Number(UPSTREAM_URL.port || (UPSTREAM_URL.protocol === "https:" ? 443 : 80)),
  protocol: UPSTREAM_URL.protocol
};
const httpClient = UPSTREAM.protocol === "https:" ? https : http;
const LISTEN = { host: "127.0.0.1", port: Number(process.env.VOICE_LAB_PORT || 8788) };

const APP_DATA = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
const DATA_DIR = process.env.DATA_DIR || path.join(APP_DATA, "9router");
const DB_PATH = path.join(DATA_DIR, "db", "data.sqlite");

function wsBase() {
  const url = new URL(UPSTREAM_URL.toString());
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.origin;
}

function readLiveSettings() {
  if (!DB_PATH || !path.isAbsolute(DB_PATH)) return {};
  let db;
  try {
    db = new DatabaseSync(DB_PATH, { readOnly: true });
    const row = db.prepare("SELECT data FROM settings WHERE id = 1").get();
    return row && row.data ? JSON.parse(row.data) : {};
  } catch {
    return {};
  } finally {
    try {
      if (db) db.close();
    } catch {}
  }
}

function liveWsToken() {
  try {
    return readFileSync(path.join(DATA_DIR, "live-ws-token"), "utf8").trim();
  } catch {
    return "";
  }
}

function liveConfigsPayload() {
  const settings = readLiveSettings();
  const live = (settings && settings.liveCommunication) || {};
  const configs = (Array.isArray(live.configs) ? live.configs : []).map((c) => ({
    id: c.id,
    name: c.name,
    providerName: c.providerName || "",
    adapter: c.adapter || "gemini-live",
    model: c.model || "",
    verified: !!c.verified,
    settings: {
      voice: (c.settings && c.settings.voice) || "",
      systemPrompt: (c.settings && c.settings.systemPrompt) || "",
      inputSampleRate: Number((c.settings && c.settings.inputSampleRate) || 16000),
      outputSampleRate: Number((c.settings && c.settings.outputSampleRate) || 24000),
      inputMimeType: (c.settings && c.settings.inputMimeType) || "audio/pcm;rate=16000",
      interruptionEnabled: !(c.settings && c.settings.interruptionEnabled === false)
    },
    fallbacks: (Array.isArray(c.fallbacks) ? c.fallbacks : []).map((f) => ({
      name: f.name || "",
      adapter: f.adapter || "",
      model: f.model || ""
    }))
  }));
  return {
    defaultId: live.defaultId || (configs[0] ? configs[0].id : ""),
    wsBase: wsBase(),
    wsToken: liveWsToken(),
    tunnelUrl: (settings && settings.tunnelUrl) || "",
    configs
  };
}

function proxy(req, res) {
  const headers = { ...req.headers };
  delete headers.host;
  const upstream = httpClient.request(
    { ...UPSTREAM, method: req.method, path: req.url, headers },
    (up) => {
      const out = { ...up.headers };
      delete out["content-encoding"];
      delete out["content-length"];
      res.writeHead(up.statusCode || 502, out);
      up.pipe(res);
    }
  );
  upstream.on("error", (err) => {
    if (!res.headersSent) res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: { message: "Upstream 9router unreachable: " + err.message } }));
  });
  req.pipe(upstream);
}

const server = http.createServer(async (req, res) => {
  const url = req.url.split("?")[0];
  if (url === "/" || url === "/voice-test.html") {
    try {
      const html = await readFile(PAGE);
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      res.end(html);
    } catch (err) {
      res.writeHead(500, { "content-type": "text/plain" });
      res.end("index.html missing: " + err.message);
    }
    return;
  }
  if (url === "/api/live-configs") {
    try {
      const body = JSON.stringify(liveConfigsPayload());
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(body);
    } catch (err) {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: { message: err.message } }));
    }
    return;
  }
  proxy(req, res);
});

server.listen(LISTEN.port, LISTEN.host, () => {
  console.log("Voice Lab: http://" + LISTEN.host + ":" + LISTEN.port + "/  (9Router: " + UPSTREAM_URL.origin + ")");
});
