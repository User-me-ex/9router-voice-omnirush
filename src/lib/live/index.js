import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import WebSocket from "ws";
import { getProviderConnections } from "@/lib/localDb";
import { getDataDir } from "@/lib/dataDir";

export const GEMINI_LIVE_WSS =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";
export const GOOGLE_API_BASE = "https://generativelanguage.googleapis.com";

export const VERTEX_LIVE_WSS =
  "wss://us-central1-aiplatform.googleapis.com/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent";
export const VERTEX_API_BASE = "https://us-central1-aiplatform.googleapis.com";

export const OPENAI_REALTIME_WSS = "wss://api.openai.com/v1/realtime";
export const OPENAI_API_BASE = "https://api.openai.com/v1";

export const QWEN_REALTIME_WSS = "wss://dashscope.aliyuncs.com/api-ws/v1/realtime";
export const QWEN_API_BASE = "https://dashscope.aliyuncs.com/api/v1";

export const ADAPTERS = [
  {
    id: "gemini-live",
    label: "Google Gemini Live (BidiGenerateContent)",
    family: "google",
    transport: "websocket",
    defaultWsUrl: GEMINI_LIVE_WSS,
    defaultApiUrl: GOOGLE_API_BASE,
    inputSampleRate: 16000,
    outputSampleRate: 24000,
    inputMimeType: "audio/pcm;rate=16000",
    outputMimeType: "audio/pcm;rate=24000",
    voices: ["Kore", "Puck", "Fenrir", "Aoede", "Charon", "Leda", "Orus", "Zephyr"],
    defaultVoice: "Kore",
    defaultModel: "gemini-2.5-flash-native-audio-preview-12-2025",
  },
  {
    id: "openai-realtime",
    label: "OpenAI / ChatGPT Realtime (WebSocket)",
    family: "openai",
    transport: "websocket",
    defaultWsUrl: OPENAI_REALTIME_WSS,
    defaultApiUrl: OPENAI_API_BASE,
    inputSampleRate: 24000,
    outputSampleRate: 24000,
    inputMimeType: "audio/pcm;rate=24000",
    outputMimeType: "audio/pcm;rate=24000",
    voices: ["alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse", "marin", "cedar"],
    defaultVoice: "alloy",
    defaultModel: "gpt-realtime-2.1",
  },
  {
    id: "qwen-realtime",
    label: "Qwen Omni Realtime (DashScope WebSocket)",
    family: "alibaba",
    transport: "websocket",
    defaultWsUrl: QWEN_REALTIME_WSS,
    defaultApiUrl: QWEN_API_BASE,
    inputSampleRate: 16000,
    outputSampleRate: 24000,
    inputMimeType: "audio/pcm;rate=16000",
    outputMimeType: "audio/pcm;rate=24000",
    voices: ["Cherry", "Serena", "Ethan", "Chelsie", "Tina"],
    defaultVoice: "Cherry",
    defaultModel: "qwen3.5-omni-flash-realtime",
  },
];

export const CURATED_LIVE_MODELS = {
  google: [
    { id: "gemini-3.8-live", label: "Gemini 3.8 Live (Recommended)", adapter: "gemini-live", family: "google", defaultVoice: "Kore", inputSampleRate: 16000, outputSampleRate: 24000 },
    { id: "gemini-3.8-live-extended-thinking", label: "Gemini 3.8 Live Extended Thinking", adapter: "gemini-live", family: "google", defaultVoice: "Kore", inputSampleRate: 16000, outputSampleRate: 24000 },
    { id: "gemini-2.5-flash-native-audio-preview-12-2025", label: "Gemini 2.5 Flash Native Audio (12-2025)", adapter: "gemini-live", family: "google", defaultVoice: "Kore", inputSampleRate: 16000, outputSampleRate: 24000 },
    { id: "gemini-2.5-flash-native-audio-preview-09-2025", label: "Gemini 2.5 Flash Native Audio (09-2025)", adapter: "gemini-live", family: "google", defaultVoice: "Kore", inputSampleRate: 16000, outputSampleRate: 24000 },
    { id: "gemini-3.5-live-translate-preview", label: "Gemini 3.5 Live Translate", adapter: "gemini-live", family: "google", defaultVoice: "Kore", inputSampleRate: 16000, outputSampleRate: 24000 },
    { id: "gemini-3.1-flash-live-preview", label: "Gemini 3.1 Flash Live (Legacy)", adapter: "gemini-live", family: "google", defaultVoice: "Kore", inputSampleRate: 16000, outputSampleRate: 24000 },
    { id: "gemini-live-2.5-flash-native-audio", label: "Gemini Live 2.5 Flash Native Audio (Vertex)", adapter: "gemini-live", family: "google", defaultVoice: "Kore", inputSampleRate: 16000, outputSampleRate: 24000 },
  ],
  openai: [
    { id: "gpt-realtime-2.1", label: "GPT Realtime 2.1 (Recommended)", adapter: "openai-realtime", family: "openai", defaultVoice: "alloy", inputSampleRate: 24000, outputSampleRate: 24000 },
    { id: "gpt-realtime-2", label: "GPT Realtime 2.0", adapter: "openai-realtime", family: "openai", defaultVoice: "alloy", inputSampleRate: 24000, outputSampleRate: 24000 },
    { id: "gpt-realtime-1.5", label: "GPT Realtime 1.5", adapter: "openai-realtime", family: "openai", defaultVoice: "alloy", inputSampleRate: 24000, outputSampleRate: 24000 },
    { id: "gpt-realtime-mini", label: "GPT Realtime Mini", adapter: "openai-realtime", family: "openai", defaultVoice: "alloy", inputSampleRate: 24000, outputSampleRate: 24000 },
    { id: "gpt-audio", label: "GPT Audio", adapter: "openai-realtime", family: "openai", defaultVoice: "alloy", inputSampleRate: 24000, outputSampleRate: 24000 },
    { id: "gpt-audio-mini", label: "GPT Audio Mini", adapter: "openai-realtime", family: "openai", defaultVoice: "alloy", inputSampleRate: 24000, outputSampleRate: 24000 },
    { id: "gpt-4o-realtime-preview", label: "GPT-4o Realtime (Legacy)", adapter: "openai-realtime", family: "openai", defaultVoice: "alloy", inputSampleRate: 24000, outputSampleRate: 24000 },
    { id: "gpt-4o-mini-realtime-preview", label: "GPT-4o Mini Realtime (Legacy)", adapter: "openai-realtime", family: "openai", defaultVoice: "alloy", inputSampleRate: 24000, outputSampleRate: 24000 },
  ],
  alibaba: [
    { id: "qwen3.5-omni-flash-realtime", label: "Qwen3.5 Omni Flash Realtime (Recommended)", adapter: "qwen-realtime", family: "alibaba", defaultVoice: "Cherry", inputSampleRate: 16000, outputSampleRate: 24000 },
    { id: "qwen3.5-omni-plus-realtime", label: "Qwen3.5 Omni Plus Realtime", adapter: "qwen-realtime", family: "alibaba", defaultVoice: "Cherry", inputSampleRate: 16000, outputSampleRate: 24000 },
    { id: "qwen3.8-omni-flash-realtime", label: "Qwen3.8 Omni Flash Realtime (Workspace endpoint)", adapter: "qwen-realtime", family: "alibaba", defaultVoice: "Tina", inputSampleRate: 16000, outputSampleRate: 24000 },
    { id: "qwen3-omni-flash-realtime", label: "Qwen3 Omni Flash Realtime", adapter: "qwen-realtime", family: "alibaba", defaultVoice: "Cherry", inputSampleRate: 16000, outputSampleRate: 24000 },
    { id: "qwen3-omni-flash-realtime-2025-09-15", label: "Qwen3 Omni Flash Realtime (2025-09-15)", adapter: "qwen-realtime", family: "alibaba", defaultVoice: "Cherry", inputSampleRate: 16000, outputSampleRate: 24000 },
  ],
};

// Check if a provider in 9Router supports native duplex audio WebSockets
export function isWebSocketLiveProvider(providerId, providerName = "") {
  const p = String(providerId || "").toLowerCase();
  const n = String(providerName || "").toLowerCase();

  // 1. Google Gemini / Vertex
  if (p.includes("gemini") || p.includes("vertex") || p.includes("antigravity")) {
    return { supported: true, family: "google", adapter: "gemini-live" };
  }
  // 2. OpenAI / Azure Realtime
  if (p === "openai" || p === "azure") {
    return { supported: true, family: "openai", adapter: "openai-realtime" };
  }
  // 3. Alibaba Qwen DashScope
  if (p.includes("alibaba") || p.includes("qwen") || p.includes("alicode")) {
    return { supported: true, family: "alibaba", adapter: "qwen-realtime" };
  }

  return { supported: false };
}

export function parseHeaders(input) {
  if (!input) return {};
  if (typeof input === "object" && !Array.isArray(input)) {
    const res = {};
    for (const [k, v] of Object.entries(input)) {
      if (k && typeof k === "string" && v != null) res[k.trim()] = String(v).trim();
    }
    return res;
  }
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) return {};
    if (trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed);
        return parseHeaders(parsed);
      } catch {}
    }
    const res = {};
    for (const line of trimmed.split(/\r?\n/)) {
      const idx = line.indexOf(":");
      if (idx > 0) {
        const k = line.slice(0, idx).trim();
        const v = line.slice(idx + 1).trim();
        if (k) res[k] = v;
      }
    }
    return res;
  }
  return {};
}

export function normalizeFallback(fb = {}, idx = 0) {
  const rawAdapter = String(fb.adapter || "").trim() || "openai-realtime";
  const adapter = ADAPTERS.find((a) => a.id === rawAdapter) || ADAPTERS[1];
  const settings = fb.settings && typeof fb.settings === "object" ? fb.settings : {};
  return {
    id: String(fb.id || "").trim() || `fb-${idx + 1}-${Math.random().toString(36).slice(2, 7)}`,
    name: String(fb.name || `Fallback API #${idx + 2}`).trim(),
    providerName: String(fb.providerName || "").trim(),
    adapter: rawAdapter,
    credentialRef: String(fb.credentialRef || "").trim(),
    authMode: ["nine-router", "api-key", "none"].includes(fb.authMode) ? fb.authMode : "nine-router",
    apiBaseUrl: String(fb.apiBaseUrl || adapter.defaultApiUrl || "").trim().replace(/\/+$/, ""),
    wsBaseUrl: String(fb.wsBaseUrl || adapter.defaultWsUrl || "").trim().replace(/\/+$/, ""),
    endpointPath: String(fb.endpointPath || "").trim(),
    urlMode: fb.urlMode === "path-model" ? "path-model" : "session-model",
    model: String(fb.model || adapter.defaultModel || "").trim(),
    headers: parseHeaders(fb.headers || settings.headers),
    settings: {
      voice: String(settings.voice || adapter.defaultVoice || "").trim(),
      systemPrompt: typeof settings.systemPrompt === "string" ? settings.systemPrompt : "",
      inputSampleRate: Number(settings.inputSampleRate || adapter.inputSampleRate),
      outputSampleRate: Number(settings.outputSampleRate || adapter.outputSampleRate),
      inputMimeType: String(settings.inputMimeType || adapter.inputMimeType),
      interruptionEnabled: settings.interruptionEnabled !== false,
      temperature: settings.temperature === "" || settings.temperature == null ? null : Number(settings.temperature),
      maxOutputTokens: settings.maxOutputTokens === "" || settings.maxOutputTokens == null ? null : Number(settings.maxOutputTokens),
    },
  };
}

export function normalizeConfig(input = {}) {
  const rawAdapter = String(input.adapter || "").trim() || "gemini-live";
  const adapter = ADAPTERS.find((a) => a.id === rawAdapter) || ADAPTERS[0];
  const settings = input.settings && typeof input.settings === "object" ? input.settings : {};
  const rawName = String(input.name || input.id || "testing").trim();
  const sanitizedName = rawName.toLowerCase().replace(/[^a-z0-9_-]/g, "-") || "testing";

  return {
    id: String(input.id || "").trim() || "live-" + Math.random().toString(36).slice(2, 10),
    name: sanitizedName,
    providerName: String(input.providerName || "Voice Assistant").trim(),
    adapter: rawAdapter,
    credentialRef: String(input.credentialRef || "").trim(),
    authMode: ["nine-router", "api-key", "none"].includes(input.authMode) ? input.authMode : "nine-router",
    apiBaseUrl: String(input.apiBaseUrl || adapter.defaultApiUrl).trim().replace(/\/+$/, ""),
    wsBaseUrl: String(input.wsBaseUrl || adapter.defaultWsUrl).trim().replace(/\/+$/, ""),
    endpointPath: String(input.endpointPath || "").trim(),
    urlMode: input.urlMode === "path-model" ? "path-model" : "session-model",
    model: String(input.model || adapter.defaultModel).trim(),
    manual: !!input.manual,
    verified: !!input.verified,
    checkedAt: input.checkedAt || null,
    checks: Array.isArray(input.checks) ? input.checks : [],
    headers: parseHeaders(input.headers || settings.headers),
    fallbacks: Array.isArray(input.fallbacks)
      ? input.fallbacks.map((fb, idx) => normalizeFallback(fb, idx))
      : [],
    settings: {
      voice: String(settings.voice || adapter.defaultVoice || "").trim(),
      systemPrompt: typeof settings.systemPrompt === "string" ? settings.systemPrompt : "",
      inputSampleRate: Number(settings.inputSampleRate || adapter.inputSampleRate),
      outputSampleRate: Number(settings.outputSampleRate || adapter.outputSampleRate),
      inputMimeType: String(settings.inputMimeType || adapter.inputMimeType),
      interruptionEnabled: settings.interruptionEnabled !== false,
      temperature: settings.temperature === "" || settings.temperature == null ? null : Number(settings.temperature),
      maxOutputTokens: settings.maxOutputTokens === "" || settings.maxOutputTokens == null ? null : Number(settings.maxOutputTokens),
    },
  };
}

export function validateConfig(input) {
  const config = normalizeConfig(input);
  const errors = [];
  if (!config.adapter) errors.push("Adapter / Protocol is required.");
  else if (!/^[A-Za-z0-9._-]+$/.test(config.adapter)) errors.push("Adapter contains unsupported characters.");
  if (!config.model) errors.push("Model is required.");
  if (config.authMode === "nine-router" && !config.credentialRef) errors.push("Credential provider is required.");
  if (!config.wsBaseUrl && !config.apiBaseUrl) errors.push("A WebSocket or API base URL is required.");
  const checkUrl = (value, label, protocols) => {
    if (!value) return;
    try {
      const u = new URL(value);
      if (protocols && !protocols.includes(u.protocol)) errors.push(`${label} must use ${protocols.join(" or ")}.`);
    } catch {
      errors.push(`${label} is not a valid URL.`);
    }
  };
  checkUrl(config.apiBaseUrl, "API base URL", ["https:", "http:"]);
  checkUrl(config.wsBaseUrl, "WebSocket base URL", ["wss:", "ws:"]);
  const modelOk = /^[A-Za-z0-9._:/-]+$/.test(config.model || "");
  if (config.model && !modelOk) errors.push("Model contains unsupported characters.");
  return { config, errors };
}

function sanitizeUrl(url) {
  if (!url) return "";
  try {
    const u = new URL(url);
    u.pathname = u.pathname.replace(/\/{2,}/g, "/");
    return u.toString();
  } catch {
    return url;
  }
}

export function buildUpstreamUrl(input) {
  const config = normalizeConfig(input);
  const adapter = ADAPTERS.find((a) => a.id === config.adapter) || ADAPTERS[0];
  if (adapter.id === "gemini-live") {
    const raw = config.wsBaseUrl || config.apiBaseUrl || GEMINI_LIVE_WSS;
    if (raw.includes("BidiGenerateContent")) return sanitizeUrl(raw);
    const base = raw.replace(/\/+$/, "");
    const suffix = config.endpointPath.replace(/^\/+/, "");
    return sanitizeUrl(suffix ? `${base}/${suffix}` : base);
  }
  if (adapter.id === "openai-realtime") {
    const base = (config.wsBaseUrl || config.apiBaseUrl || OPENAI_REALTIME_WSS).replace(/\/+$/, "");
    if (base.includes("model=")) return sanitizeUrl(base);
    const model = config.model || "gpt-4o-realtime-preview";
    const sep = base.includes("?") ? "&" : "?";
    return sanitizeUrl(`${base}${sep}model=${encodeURIComponent(model)}`);
  }
  if (adapter.id === "qwen-realtime") {
    const base = (config.wsBaseUrl || config.apiBaseUrl || QWEN_REALTIME_WSS).replace(/\/+$/, "");
    if (base.includes("model=")) return sanitizeUrl(base);
    return sanitizeUrl(`${base}?model=${encodeURIComponent(config.model || "qwen3.5-omni-flash-realtime")}`);
  }
  const base = (config.wsBaseUrl || config.apiBaseUrl).replace(/\/+$/, "");
  let target = config.endpointPath ? `${base}/${config.endpointPath.replace(/^\/+/, "")}` : base;
  if (config.urlMode === "path-model" && config.model) target = `${target.replace(/\/+$/, "")}/${encodeURIComponent(config.model)}`;
  return sanitizeUrl(target);
}

export async function credentialSummary(providerId) {
  const secret = await credentialSecrets(providerId);
  if (!secret) {
    if (!providerId) return { available: false, kind: "none", reason: "No credential provider selected." };
    let hasConnection = false;
    try {
      const conns = await getProviderConnections({ isActive: true });
      const ref = String(providerId).toLowerCase();
      hasConnection = (conns || []).some((c) => c.id === providerId || c.provider === providerId || (c.name && c.name.toLowerCase() === ref));
    } catch {}
    return {
      available: false,
      kind: "none",
      reason: hasConnection
        ? `"${providerId}" connection has no API key or access token.`
        : `No active "${providerId}" connection in 9router.`,
    };
  }
  const { apiKey, accessToken, ...summary } = secret;
  return { available: true, ...summary };
}

// Server-only: returns the raw secret. Never send this to a client.
export async function credentialSecrets(credentialRef) {
  if (!credentialRef) return null;
  let connections = [];
  try {
    connections = await getProviderConnections({ isActive: true });
  } catch {
    connections = [];
  }
  const ref = String(credentialRef).toLowerCase();
  const isExact = (c) =>
    c.id === credentialRef ||
    c.provider === credentialRef ||
    (c.name && c.name.toLowerCase() === ref);
  const isFuzzy = (c) => {
    if (isExact(c)) return false;
    if ((ref === "gemini" || ref === "vertex") && (c.provider.includes("gemini") || c.provider.includes("vertex"))) return true;
    if (ref === "openai" && c.provider.includes("openai")) return true;
    if ((ref === "alibaba" || ref === "qwen") && (c.provider.includes("alibaba") || c.provider.includes("qwen"))) return true;
    return false;
  };
  const pool = (connections || []).filter((c) => c.isActive !== false);
  const active = [
    ...pool.filter(isExact),
    ...pool.filter(isFuzzy),
  ];
  for (const conn of active) {
    const apiKey = typeof conn.apiKey === "string" ? conn.apiKey.trim() : "";
    if (apiKey) {
      return { kind: "api-key", provider: conn.provider, connectionId: conn.id, name: conn.name, email: conn.email || "", apiKey };
    }
    const accessToken = typeof conn.accessToken === "string" ? conn.accessToken.trim() : "";
    if (accessToken) {
      const expiresAt = conn.expiresAt ? Date.parse(conn.expiresAt) : null;
      return {
        kind: "oauth",
        provider: conn.provider,
        connectionId: conn.id,
        name: conn.name,
        email: conn.email || "",
        expiresAt: conn.expiresAt || null,
        expired: !!(expiresAt && expiresAt <= Date.now()),
        scope: typeof conn.scope === "string" ? conn.scope : "",
        accessToken,
      };
    }
  }
  return null;
}

// Show ALL active providers from 9Router in Credential source!
export async function availableCredentialProviders() {
  const out = [];
  try {
    const conns = await getProviderConnections({ isActive: true });
    for (const c of conns || []) {
      const check = isWebSocketLiveProvider(c.provider, c.name);
      const kind = c.apiKey ? "api-key" : c.accessToken ? "oauth" : "none";
      out.push({
        id: c.id,
        provider: c.provider,
        name: c.name || c.email || c.provider,
        email: c.email || "",
        kind,
        family: check.family || "other",
        adapter: check.adapter || "gemini-live",
        wsSupported: check.supported,
        authType: c.authType || (c.apiKey ? "apikey" : "oauth"),
        expiresAt: c.expiresAt || null,
      });
    }
  } catch (err) {
    console.error("Failed to load provider connections:", err);
  }
  return out;
}

// Return live models according to credential source
export function filterWebSocketLiveModels(credentialRef, connections = []) {
  const conn = connections.find(
    (c) => c.id === credentialRef || c.provider === credentialRef || (c.name && c.name.toLowerCase() === String(credentialRef).toLowerCase())
  );
  const pKey = (conn ? conn.provider : credentialRef || "").toLowerCase();
  const pName = (conn ? conn.name : "").toLowerCase();

  // 1. Google Gemini Live
  if (pKey.includes("gemini") || pKey.includes("vertex") || pKey.includes("antigravity")) {
    return CURATED_LIVE_MODELS.google;
  }

  // 2. OpenAI / Azure direct Realtime
  if (pKey === "openai" || pKey === "azure" || pKey.includes("openai") || pName.includes("openai") || pName.includes("openrouter") || pKey.includes("openrouter")) {
    return CURATED_LIVE_MODELS.openai;
  }

  // 3. Alibaba / Qwen DashScope
  if (pKey.includes("alibaba") || pKey.includes("qwen") || pKey.includes("alicode")) {
    return CURATED_LIVE_MODELS.alibaba;
  }

  return [];
}

// Report which active providers support native duplex live WebSockets.
export async function probeAllProviderConnections(providerId) {
  const conns = await availableCredentialProviders();
  const targets = providerId
    ? conns.filter(
        (c) =>
          c.id === providerId ||
          c.provider === providerId ||
          (c.name && c.name.toLowerCase() === String(providerId).toLowerCase())
      )
    : conns;

  return targets.map((c) => {
    const models = filterWebSocketLiveModels(c.id, conns);
    return {
      id: c.id,
      provider: c.provider,
      name: c.name,
      email: c.email,
      kind: c.kind,
      family: c.family,
      adapter: c.adapter,
      wsSupported: !!c.wsSupported,
      modelCount: models.length,
      models: models.map((m) => m.id),
      status: c.wsSupported ? "supported" : "unsupported",
    };
  });
}

export async function discoverLiveModels({ family, providerId } = {}) {
  const conns = await availableCredentialProviders();
  const allCurated = [
    ...CURATED_LIVE_MODELS.google,
    ...CURATED_LIVE_MODELS.openai,
    ...CURATED_LIVE_MODELS.alibaba,
  ];

  let list = allCurated.map((m) => {
    const hasConnection = conns.some((c) => c.family === m.family);
    return {
      ...m,
      source: "curated",
      capability: "websocket-live-audio",
      hasConnection,
    };
  });

  if (family && family !== "all") {
    list = list.filter((m) => m.family === family);
  }
  if (providerId) {
    const targetConn = conns.find((c) => c.id === providerId || c.provider === providerId);
    if (targetConn) {
      list = list.filter((m) => m.family === targetConn.family);
    }
  }
  return list;
}

export function liveWsToken() {
  const file = path.join(getDataDir(), "live-ws-token");
  try {
    const existing = fs.readFileSync(file, "utf8").trim();
    if (existing) return existing;
  } catch {}
  const token = crypto.randomBytes(16).toString("hex");
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, token, { mode: 0o600 });
  } catch {}
  return token;
}

function geminiSetupBody(config) {
  const rawModel = String(config.model || "");
  const model = rawModel.startsWith("projects/")
    ? rawModel
    : "models/" + rawModel.replace(/^models\//, "").split("/").pop();
  const body = {
    model,
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: config.settings.voice || "Kore" } } },
    },
    inputAudioTranscription: {},
    outputAudioTranscription: {},
  };
  if (config.settings.temperature != null) body.generationConfig.temperature = config.settings.temperature;
  if (config.settings.maxOutputTokens != null) body.generationConfig.maxOutputTokens = config.settings.maxOutputTokens;
  if (config.settings.systemPrompt) body.systemInstruction = { parts: [{ text: config.settings.systemPrompt }] };
  return { setup: body };
}

function wsProbeGemini(url, headers, config, timeoutMs = 20000) {
  return new Promise((resolve) => {
    const result = { handshake: false, sessionInit: false, audioInput: false, audioOutput: false, protocolVersion: "", error: "" };
    let firstAudioBytes = 0;
    let textSent = false;
    let settled = false;
    const started = Date.now();
    let ws;
    const finish = () => {
      if (settled) return;
      settled = true;
      try {
        ws && ws.close();
      } catch {}
      result.audioInput = result.sessionInit;
      result.ms = Date.now() - started;
      resolve(result);
    };
    const timer = setTimeout(() => {
      result.error = result.error || "Timed out waiting for Gemini Live session.";
      finish();
    }, timeoutMs);
    try {
      ws = new WebSocket(url, { headers, handshakeTimeout: 8000 });
    } catch (e) {
      clearTimeout(timer);
      result.error = String(e && e.message ? e.message : e);
      return resolve(result);
    }
    ws.on("open", () => {
      result.handshake = true;
      try {
        ws.send(JSON.stringify(geminiSetupBody(config)));
      } catch (e) {
        result.error = String(e && e.message ? e.message : e);
        finish();
      }
    });
    ws.on("message", (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (msg.setupComplete) {
        result.sessionInit = true;
        result.protocolVersion = msg.setupComplete.protocolVersion || "v1beta";
        if (!textSent) {
          textSent = true;
          ws.send(JSON.stringify({ clientContent: { turns: [{ role: "user", parts: [{ text: "Reply with the single word OK." }] }], turnComplete: true } }));
        }
        return;
      }
      if (msg.error) {
        result.error = String(msg.error.message || msg.error.status || "upstream error").slice(0, 300);
        finish();
        return;
      }
      const sc = msg.serverContent;
      if (!sc) return;
      if (sc.modelTurn && Array.isArray(sc.modelTurn.parts)) {
        for (const p of sc.modelTurn.parts) if (p.inlineData && p.inlineData.data) firstAudioBytes += p.inlineData.data.length;
      }
      if (firstAudioBytes > 0) result.audioOutput = true;
      if (result.audioOutput && (sc.turnComplete || Date.now() - started > 12000)) {
        clearTimeout(timer);
        finish();
      }
    });
    ws.on("error", (e) => {
      result.error = String(e && e.message ? e.message : e).slice(0, 300);
      clearTimeout(timer);
      finish();
    });
    ws.on("close", (code, reason) => {
      if (settled) return;
      result.error = result.error || ("closed " + code + (reason && reason.length ? ": " + String(reason) : ""));
      clearTimeout(timer);
      finish();
    });
    ws.on("unexpected-response", (_req, res) => {
      result.error = "HTTP " + res.statusCode;
      try {
        res.resume();
      } catch {}
      clearTimeout(timer);
      finish();
    });
  });
}

function wsProbeOpenAI(url, headers, config, timeoutMs = 20000, legacy = false) {
  return new Promise((resolve) => {
    const result = { handshake: false, sessionInit: false, audioInput: false, audioOutput: false, protocolVersion: "v1", error: "" };
    let firstAudioBytes = 0;
    let textSent = false;
    let settled = false;
    const started = Date.now();
    let ws;
    const finish = () => {
      if (settled) return;
      settled = true;
      try {
        ws && ws.close();
      } catch {}
      result.audioInput = result.sessionInit;
      result.ms = Date.now() - started;
      resolve(result);
    };
    const timer = setTimeout(() => {
      result.error = result.error || "Timed out waiting for OpenAI Realtime session.";
      finish();
    }, timeoutMs);
    try {
      ws = new WebSocket(url, { headers, handshakeTimeout: 8000 });
    } catch (e) {
      clearTimeout(timer);
      result.error = String(e && e.message ? e.message : e);
      return resolve(result);
    }
    ws.on("open", () => {
      result.handshake = true;
      try {
        ws.send(
          JSON.stringify({
            type: "session.update",
            session: legacy
              ? {
                  modalities: ["text", "audio"],
                  voice: config.settings?.voice || "Cherry",
                  input_audio_format: "pcm16",
                  output_audio_format: "pcm16",
                  turn_detection: { type: "server_vad" },
                }
              : {
                  type: "realtime",
                  model: config.model,
                  output_modalities: ["audio", "text"],
                  audio: {
                    input: {
                      format: { type: "audio/pcm", rate: 24000 },
                      turn_detection: { type: "server_vad" },
                    },
                    output: {
                      format: { type: "audio/pcm", rate: 24000 },
                      voice: config.settings?.voice || "alloy",
                    },
                  },
                  ...(config.settings?.systemPrompt ? { instructions: config.settings.systemPrompt } : {}),
                },
          })
        );
      } catch (e) {
        result.error = String(e && e.message ? e.message : e);
        finish();
      }
    });
    ws.on("message", (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (msg.type === "session.created" || msg.type === "session.updated") {
        result.sessionInit = true;
        if (!textSent) {
          textSent = true;
          ws.send(
            JSON.stringify({
              type: "conversation.item.create",
              item: { type: "message", role: "user", content: [{ type: "input_text", text: "Say OK" }] },
            })
          );
          ws.send(JSON.stringify({ type: "response.create" }));
        }
        return;
      }
      if ((msg.type === "response.output_audio.delta" || msg.type === "response.audio.delta") && msg.delta) {
        firstAudioBytes += msg.delta.length;
        result.audioOutput = true;
      }
      if (msg.type === "response.done" || (result.audioOutput && Date.now() - started > 12000)) {
        clearTimeout(timer);
        finish();
        return;
      }
      if (msg.type === "error") {
        result.error = String(msg.error?.message || "OpenAI error").slice(0, 300);
        finish();
      }
    });
    ws.on("error", (e) => {
      result.error = String(e && e.message ? e.message : e).slice(0, 300);
      clearTimeout(timer);
      finish();
    });
    ws.on("close", (code, reason) => {
      if (settled) return;
      result.error = result.error || ("closed " + code + (reason && reason.length ? ": " + String(reason) : ""));
      clearTimeout(timer);
      finish();
    });
    ws.on("unexpected-response", (_req, res) => {
      result.error = "HTTP " + res.statusCode;
      try {
        res.resume();
      } catch {}
      clearTimeout(timer);
      finish();
    });
  });
}

export async function testLiveConfiguration(input) {
  const { config, errors } = validateConfig(input);
  const checks = [];
  const add = (id, label, state, detail) => checks.push({ id, label, state, detail: detail || "" });
  add("config", "Configuration", errors.length ? "failed" : "passed", errors.join(" "));

  const cred = await credentialSummary(config.credentialRef);
  const secret = cred.available ? await credentialSecrets(config.credentialRef) : null;
  if (!cred.available) add("auth", "Credential", "failed", cred.reason || "No credential.");
  else if (cred.kind === "oauth" && cred.expired) add("auth", "Credential", "failed", "OAuth token expired.");
  else add("auth", "Credential", "passed", `${cred.kind} via ${cred.provider}${cred.email ? " (" + cred.email + ")" : ""}`);

  if (errors.length || !cred.available || !secret || (cred.kind === "oauth" && cred.expired)) {
    return { config, checks, verified: false, status: "failed", reason: errors.join(" ") || cred.reason };
  }

  const upstream = buildUpstreamUrl(config);
  add("endpoint", "Endpoint", "passed", upstream.replace(/key=[^&]+/, "key=***"));

  let restOk = false;
  if (config.adapter === "gemini-live") {
    try {
      const apiBase = (config.apiBaseUrl || GOOGLE_API_BASE).replace(/\/+$/, "");
      const url = new URL(apiBase + "/v1beta/models");
      const headers = {};
      if (secret.kind === "api-key") url.searchParams.set("key", secret.apiKey);
      else headers.authorization = "Bearer " + secret.accessToken;
      const res = await fetch(url, { headers });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        restOk = true;
        add("reachability", "Model list", "passed", `${(body.models || []).length} models`);
      } else {
        const msg = (body.error && body.error.message) || "HTTP " + res.status;
        add("reachability", "Model list", "failed", msg.slice(0, 240));
      }
    } catch (e) {
      add("reachability", "Model list", "failed", String(e && e.message ? e.message : e).slice(0, 240));
    }

    const wsUrl = new URL(upstream);
    const headers = { ...(config.headers || {}) };
    if (secret.kind === "api-key") wsUrl.searchParams.set("key", secret.apiKey);
    else headers.authorization = "Bearer " + secret.accessToken;

    const probe = await wsProbeGemini(wsUrl.toString(), headers, config);
    add("handshake", "WebSocket handshake", probe.handshake ? "passed" : "failed", probe.handshake ? "" : probe.error);
    add("session", "Session initialization", probe.sessionInit ? "passed" : "failed", probe.sessionInit ? probe.protocolVersion : probe.error);
    add("audioInput", "Native audio input", probe.audioInput ? "passed" : "failed", probe.audioInput ? config.settings.inputMimeType : "Not confirmed by a ready session.");
    add("audioOutput", "Native audio output", probe.audioOutput ? "passed" : "failed", probe.audioOutput ? "Received PCM audio from Gemini Live." : "No native audio returned.");
    const verified = probe.handshake && probe.sessionInit && probe.audioOutput;
    return {
      config,
      checks,
      verified,
      status: verified ? "verified" : "failed",
      latencyMs: probe.ms,
      reachability: restOk,
      reason: probe.error || "",
      protocol: "BidiGenerateContent / v1beta",
    };
  }

  if (config.adapter === "openai-realtime") {
    try {
      const apiBase = (config.apiBaseUrl || OPENAI_API_BASE).replace(/\/+$/, "");
      const url = new URL(apiBase + "/models");
      const headers = { authorization: "Bearer " + (secret.apiKey || secret.accessToken) };
      const res = await fetch(url, { headers });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        restOk = true;
        add("reachability", "Model list", "passed", `${(body.data || body.models || []).length} models`);
      } else {
        const msg = (body.error && body.error.message) || "HTTP " + res.status;
        add("reachability", "Model list", "failed", msg.slice(0, 240));
      }
    } catch (e) {
      add("reachability", "Model list", "failed", String(e && e.message ? e.message : e).slice(0, 240));
    }

    const wsUrl = new URL(upstream);
    const wsHeaders = {
      authorization: "Bearer " + (secret.apiKey || secret.accessToken),
      ...(config.headers || {}),
    };
    const probe = await wsProbeOpenAI(wsUrl.toString(), wsHeaders, config);
    add("handshake", "WebSocket handshake", probe.handshake ? "passed" : "failed", probe.handshake ? "" : probe.error);
    add("session", "Session initialization", probe.sessionInit ? "passed" : "failed", probe.sessionInit ? probe.protocolVersion : probe.error);
    add("audioInput", "Native audio input", probe.audioInput ? "passed" : "failed", probe.audioInput ? config.settings.inputMimeType : "Not confirmed by a ready session.");
    add("audioOutput", "Native audio output", probe.audioOutput ? "passed" : "failed", probe.audioOutput ? "Received PCM audio from OpenAI Realtime." : "No native audio returned.");
    const verified = probe.handshake && probe.sessionInit && probe.audioOutput;
    return {
      config,
      checks,
      verified,
      status: verified ? "verified" : "failed",
      latencyMs: probe.ms,
      reachability: restOk,
      reason: probe.error || "",
      protocol: "OpenAI Realtime / v1",
    };
  }

  if (config.adapter === "qwen-realtime") {
    const wsUrl = new URL(upstream);
    const wsHeaders = {
      authorization: "Bearer " + (secret.apiKey || secret.accessToken),
      "X-DashScope-DataInspection": "enable",
      ...(config.headers || {}),
    };
    const probe = await wsProbeOpenAI(wsUrl.toString(), wsHeaders, config, 20000, true);
    add("handshake", "WebSocket handshake", probe.handshake ? "passed" : "failed", probe.handshake ? "" : probe.error);
    add("session", "Session initialization", probe.sessionInit ? "passed" : "failed", probe.sessionInit ? probe.protocolVersion : probe.error);
    add("audioInput", "Native audio input", probe.audioInput ? "passed" : "failed", probe.audioInput ? config.settings.inputMimeType : "Not confirmed by a ready session.");
    add("audioOutput", "Native audio output", probe.audioOutput ? "passed" : "failed", probe.audioOutput ? "Received PCM audio from Qwen Omni Realtime." : "No native audio returned.");
    const verified = probe.handshake && probe.sessionInit && probe.audioOutput;
    return {
      config,
      checks,
      verified,
      status: verified ? "verified" : "failed",
      latencyMs: probe.ms,
      reachability: false,
      reason: probe.error || "",
      protocol: "DashScope Realtime / v1",
    };
  }

  // Custom or third-party adapter / protocol: default to universal OpenAI Realtime wire probe
  const wsUrl = new URL(upstream);
  const wsHeaders = {
    ...(secret ? { authorization: "Bearer " + (secret.apiKey || secret.accessToken) } : {}),
    ...(config.headers || {}),
  };
  const probe = await wsProbeOpenAI(wsUrl.toString(), wsHeaders, config);
  add("handshake", "WebSocket handshake", probe.handshake ? "passed" : "failed", probe.handshake ? "" : probe.error);
  add("session", "Session initialization", probe.sessionInit ? "passed" : "failed", probe.sessionInit ? probe.protocolVersion : probe.error);
  add("audioInput", "Native audio input", probe.audioInput ? "passed" : "failed", probe.audioInput ? config.settings.inputMimeType : "Not confirmed by a ready session.");
  add("audioOutput", "Native audio output", probe.audioOutput ? "passed" : "failed", probe.audioOutput ? "Received PCM audio." : "No native audio returned.");
  const verified = probe.handshake && probe.sessionInit && probe.audioOutput;
  return {
    config,
    checks,
    verified,
    status: verified ? "verified" : "failed",
    latencyMs: probe.ms,
    reachability: restOk,
    reason: probe.error || "",
    protocol: `${config.adapter} / custom`,
  };
}
