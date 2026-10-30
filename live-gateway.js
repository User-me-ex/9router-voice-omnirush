// 9Router Live Communication gateway.
//
// Bridges a local WebSocket at `/live` or `/v1/voice/:name` directly to a provider's
// native real-time duplex audio-to-audio WebSocket (Gemini Live BidiGenerateContent,
// OpenAI Realtime API, Qwen Omni) using credentials stored in 9router.
// Supports simultaneous voice and text streaming concurrently in parallel.
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { WebSocketServer, WebSocket } = require("ws");

const OPERATOR = Symbol("liveGateway");

const DEFAULT_GEMINI_LIVE_URL =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";
const DEFAULT_OPENAI_REALTIME_URL = "wss://api.openai.com/v1/realtime";
const DEFAULT_QWEN_REALTIME_URL = "wss://dashscope.aliyuncs.com/api-ws/v1/realtime";

const DEFAULTS = {
  inputSampleRate: 16000,
  outputSampleRate: 24000,
  inputMimeType: "audio/pcm;rate=16000",
  voice: "Kore",
  maxPayload: 8 * 1024 * 1024,
};

function dataDir() {
  const configured = process.env.DATA_DIR;
  if (configured) return configured;
  const appData = process.env.APPDATA || path.join(require("os").homedir(), "AppData", "Roaming");
  return path.join(appData, "9router");
}

function readSettings() {
  let sqlite;
  try {
    sqlite = require("node:sqlite");
  } catch {
    return {};
  }
  const dbPath = path.join(dataDir(), "db", "data.sqlite");
  if (!fs.existsSync(dbPath)) return {};
  let db;
  try {
    db = new sqlite.DatabaseSync(dbPath, { readOnly: true });
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

function readCombos() {
  let sqlite;
  try {
    sqlite = require("node:sqlite");
  } catch {
    return [];
  }
  const dbPath = path.join(dataDir(), "db", "data.sqlite");
  if (!fs.existsSync(dbPath)) return [];
  let db;
  try {
    db = new sqlite.DatabaseSync(dbPath, { readOnly: true });
    const rows = db.prepare("SELECT * FROM combos").all();
    return rows.map((r) => {
      let models = [];
      try {
        models = typeof r.models === "string" ? JSON.parse(r.models || "[]") : r.models || [];
      } catch {}
      return { ...r, models };
    });
  } catch {
    return [];
  } finally {
    try {
      if (db) db.close();
    } catch {}
  }
}

function readConnections(credentialRef) {
  let sqlite;
  try {
    sqlite = require("node:sqlite");
  } catch {
    return [];
  }
  const dbPath = path.join(dataDir(), "db", "data.sqlite");
  if (!fs.existsSync(dbPath)) return [];
  let db;
  try {
    db = new sqlite.DatabaseSync(dbPath, { readOnly: true });
    const allActive = db
      .prepare(
        "SELECT id, provider, name, email, isActive, data FROM providerConnections WHERE isActive = 1 ORDER BY priority ASC"
      )
      .all();
    const ref = String(credentialRef || "").toLowerCase();
    const isExact = (r) =>
      r.id === credentialRef ||
      r.provider === credentialRef ||
      (r.name && r.name.toLowerCase() === ref);
    const isFuzzy = (r) => {
      if (isExact(r)) return false;
      if ((ref === "gemini" || ref === "vertex") && (r.provider.includes("gemini") || r.provider.includes("vertex"))) return true;
      if ((ref === "openai" || ref === "openrouter") && (r.provider.includes("openai") || (r.name && r.name.toLowerCase().includes("openrouter")))) return true;
      if ((ref === "alibaba" || ref === "qwen") && (r.provider.includes("alibaba") || r.provider.includes("qwen"))) return true;
      return false;
    };
    const matched = [...allActive.filter(isExact), ...allActive.filter(isFuzzy)];
    return matched.map((r) => {
      let data = {};
      try {
        data = JSON.parse(r.data || "{}");
      } catch {}
      return { ...r, data };
    });
  } catch {
    return [];
  } finally {
    try {
      if (db) db.close();
    } catch {}
  }
}

function resolveCredential(credentialRef) {
  if (!credentialRef) return { kind: "none" };
  const conns = readConnections(credentialRef);
  if (!conns.length) return { kind: "none", provider: credentialRef, reason: "no active connection" };
  for (const conn of conns) {
    const apiKey = typeof conn.data.apiKey === "string" ? conn.data.apiKey.trim() : "";
    if (apiKey) return { kind: "api-key", provider: conn.provider, connectionId: conn.id, apiKey };
    const accessToken = typeof conn.data.accessToken === "string" ? conn.data.accessToken.trim() : "";
    if (accessToken) {
      const expiresAt = conn.data.expiresAt ? Date.parse(conn.data.expiresAt) : null;
      return {
        kind: "oauth",
        provider: conn.provider,
        connectionId: conn.id,
        accessToken,
        expiresAt,
        expired: !!(expiresAt && expiresAt <= Date.now()),
        scope: typeof conn.data.scope === "string" ? conn.data.scope : "",
      };
    }
  }
  return { kind: "none", provider: credentialRef, reason: "connection has no credentials" };
}

function normalizeBase(url) {
  return String(url || "").trim().replace(/\/+$/, "");
}

function joinUrl(base, pathname) {
  const b = normalizeBase(base);
  const p = String(pathname || "").replace(/^\/+/, "");
  if (!b) return p ? "/" + p : "";
  return p ? b + "/" + p : b;
}

function buildUpstreamUrl(config) {
  const adapter = config.adapter || "gemini-live";
  if (adapter === "gemini-live") {
    const base = normalizeBase(config.wsBaseUrl) || normalizeBase(config.apiBaseUrl) || DEFAULT_GEMINI_LIVE_URL;
    const target = base.includes("BidiGenerateContent")
      ? base
      : joinUrl(base, config.endpointPath || "");
    return sanitizeUrl(target);
  }
  if (adapter === "openai-realtime") {
    const base = normalizeBase(config.wsBaseUrl) || normalizeBase(config.apiBaseUrl) || DEFAULT_OPENAI_REALTIME_URL;
    if (base.includes("model=")) return sanitizeUrl(base);
    const model = config.model || "gpt-realtime-2.1";
    const sep = base.includes("?") ? "&" : "?";
    return sanitizeUrl(`${base}${sep}model=${encodeURIComponent(model)}`);
  }
  if (adapter === "qwen-realtime") {
    const base = normalizeBase(config.wsBaseUrl) || normalizeBase(config.apiBaseUrl) || DEFAULT_QWEN_REALTIME_URL;
    if (base.includes("model=")) return sanitizeUrl(base);
    const model = config.model || "qwen3.5-omni-flash-realtime";
    return sanitizeUrl(`${base}?model=${encodeURIComponent(model)}`);
  }
  const base = normalizeBase(config.wsBaseUrl) || normalizeBase(config.apiBaseUrl);
  let target = config.endpointPath ? joinUrl(base, config.endpointPath) : base;
  if (config.urlMode === "path-model" && config.model) {
    target = joinUrl(target, encodeURIComponent(config.model));
  }
  return sanitizeUrl(target);
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

function withApiKey(url, apiKey) {
  try {
    const u = new URL(url);
    u.searchParams.set("key", apiKey);
    return u.toString();
  } catch {
    return url;
  }
}

function geminiSetup(config, model) {
  const rawModel = String(model || "");
  const modelId = rawModel.startsWith("projects/")
    ? rawModel
    : "models/" + rawModel.replace(/^models\//, "").split("/").pop();
  const settings = config.settings || {};
  const setup = {
    model: modelId,
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: settings.voice || DEFAULTS.voice } },
      },
    },
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    sessionResumption: {},
    ...(settings.systemPrompt ? { systemInstruction: { parts: [{ text: settings.systemPrompt }] } } : {}),
  };
  if (settings.temperature != null) setup.generationConfig.temperature = Number(settings.temperature);
  if (settings.maxOutputTokens != null) setup.generationConfig.maxOutputTokens = Number(settings.maxOutputTokens);
  return { setup };
}

function openaiRealtimeSetup(config, model) {
  const settings = config.settings || {};
  return {
    type: "session.update",
    session: {
      type: "realtime",
      model,
      output_modalities: ["audio", "text"],
      audio: {
        input: {
          format: { type: "audio/pcm", rate: 24000 },
          turn_detection: { type: "server_vad" },
        },
        output: {
          format: { type: "audio/pcm", rate: 24000 },
          voice: settings.voice || "alloy",
        },
      },
      ...(settings.systemPrompt ? { instructions: settings.systemPrompt } : {}),
      ...(settings.temperature != null ? { temperature: Number(settings.temperature) } : {}),
      ...(settings.maxOutputTokens != null ? { max_response_output_tokens: Number(settings.maxOutputTokens) } : {}),
    },
  };
}

function qwenRealtimeSetup(config) {
  const settings = config.settings || {};
  const session = {
    modalities: ["text", "audio"],
    voice: settings.voice || "Cherry",
    input_audio_format: "pcm16",
    output_audio_format: "pcm16",
    turn_detection: { type: "server_vad" },
  };
  if (settings.systemPrompt) session.instructions = settings.systemPrompt;
  if (settings.temperature != null) session.temperature = Number(settings.temperature);
  if (settings.maxOutputTokens != null) session.max_response_output_tokens = Number(settings.maxOutputTokens);
  return { type: "session.update", session };
}

function sendJson(ws, obj) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}

function parseQuery(req) {
  try {
    return new URL(req.url, "http://localhost").searchParams;
  } catch {
    return new URLSearchParams();
  }
}

function isLoopback(req) {
  const addr = (req.socket && req.socket.remoteAddress) || "";
  return addr === "127.0.0.1" || addr === "::1" || addr === "::ffff:127.0.0.1";
}

function liveWsToken() {
  const file = path.join(dataDir(), "live-ws-token");
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

function parseCustomHeaders(input) {
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
        return parseCustomHeaders(JSON.parse(trimmed));
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

function resolveTargetConfig(req, query, live, combos) {
  const configs = Array.isArray(live.configs) ? live.configs : [];
  const pathname = (req.url || "").split("?")[0].replace(/\/+$/, "");

  // 1. Custom Testing mode (ad-hoc test)
  if (query.get("custom") === "1") {
    const adapter = query.get("adapter") || "gemini-live";
    return {
      config: {
        id: "custom-test",
        name: "custom-test",
        providerName: query.get("providerName") || "Custom Live Test",
        adapter,
        credentialRef: query.get("credentialRef") || "",
        apiBaseUrl: query.get("apiBaseUrl") || "",
        wsBaseUrl: query.get("wsBaseUrl") || "",
        endpointPath: query.get("endpointPath") || "",
        urlMode: query.get("urlMode") || "session-model",
        model: query.get("model") || "",
        headers: parseCustomHeaders(query.get("headers") || ""),
        settings: {
          voice: query.get("voice") || "Kore",
          systemPrompt: query.get("systemPrompt") || "",
          inputSampleRate: Number(query.get("inRate") || 16000),
          outputSampleRate: Number(query.get("outRate") || 24000),
          inputMimeType: query.get("inMime") || "audio/pcm;rate=16000",
          interruptionEnabled: query.get("interruption") !== "0",
          temperature: query.get("temp") ? Number(query.get("temp")) : null,
          maxOutputTokens: query.get("maxTokens") ? Number(query.get("maxTokens")) : null,
        },
      },
      isCombo: false,
    };
  }

  // 2. Identify target name from URL or query
  let target = query.get("name") || query.get("configId") || "";
  if (!target) {
    if (pathname.startsWith("/v1/voice/")) {
      target = decodeURIComponent(pathname.slice("/v1/voice/".length));
    } else if (pathname.startsWith("/live/") && pathname !== "/live") {
      target = decodeURIComponent(pathname.slice("/live/".length));
    }
  }

  if (target) {
    // A. Match direct configuration
    const foundConfig = configs.find((c) => c.name === target || c.id === target);
    if (foundConfig) return { config: foundConfig, isCombo: false };

    // B. Match Combo from Combo & Vision Adapter
    const foundCombo = combos.find((c) => c.name === target || c.id === target);
    if (foundCombo) {
      const comboModels = Array.isArray(foundCombo.models) ? foundCombo.models : [];
      for (const m of comboModels) {
        const cMatch = configs.find((c) => c.name === m || c.id === m);
        if (cMatch) return { config: cMatch, isCombo: true, comboName: foundCombo.name };
      }
      if (comboModels.length > 0) {
        const first = comboModels[0];
        const isGoogle = /gemini/i.test(first);
        return {
          config: {
            id: `combo-${foundCombo.name}`,
            name: foundCombo.name,
            providerName: `Combo: ${foundCombo.name}`,
            adapter: isGoogle ? "gemini-live" : "openai-realtime",
            credentialRef: isGoogle ? "gemini" : "openai",
            model: first,
            settings: {
              voice: isGoogle ? "Kore" : "alloy",
              inputSampleRate: isGoogle ? 16000 : 24000,
              outputSampleRate: 24000,
            },
          },
          isCombo: true,
          comboName: foundCombo.name,
        };
      }
    }
  }

  // 3. Fallback to default configuration
  const def = configs.find((c) => c.id === live.defaultId || c.name === live.defaultId) || configs[0] || null;
  return { config: def, isCombo: false };
}

function formatFailoverReport(errorLog, candidates) {
  const lines = [
    "🚨 Realtime Voice Failover Alert: All APIs Stopped Working",
    "═════════════════════════════════════════════════════════════════",
    `Attempted ${candidates.length} ranked API endpoint(s) across 2 full passes (cycled back to Rank #1 and retested). None was able to establish or maintain an active live session.`,
    "",
    "📋 Detailed Problem Diagnostics by Endpoint:",
  ];

  for (let i = 0; i < errorLog.length; i++) {
    const item = errorLog[i];
    lines.push(
      `-----------------------------------------------------------------`,
      `[Attempt #${i + 1}] Rank #${item.rank}: ${item.name}`,
      `  • Status/Code:  ${item.code}`,
      `  • Error Reason: ${item.error}`,
      `  • Model ID:     ${item.model || "default"}`,
      `  • Protocol:     ${item.adapter}`,
      `  • Base URL:     ${item.baseUrl}`,
      `  • Endpoint URL: ${item.endpoint}`,
      `  • Credential:   ${item.credential}`,
      `  • Timestamp:    ${item.time}`
    );
  }

  lines.push(
    `-----------------------------------------------------------------`,
    "",
    "🛠️ Recommended Actions:",
    "1. Check credentials & API keys under Providers tab.",
    "2. Check model names and WebSocket URLs under Model & Endpoint.",
    "3. Reorder your API ranking or test individual endpoints using 'Test WebSocket'."
  );
  return lines.join("\n");
}

function getCandidateChain(targetConfig, isCombo, comboName, combos, allConfigs) {
  if (isCombo) {
    const foundCombo = combos.find((c) => c.name === comboName || c.id === comboName);
    const comboModels = Array.isArray(foundCombo?.models) ? foundCombo.models : [];
    const list = [];
    let rank = 1;
    for (const m of comboModels) {
      const match = (allConfigs || []).find((c) => c.name === m || c.id === m);
      if (match) {
        list.push({ ...match, rank: rank++, name: match.name || m });
      } else {
        const isGoogle = /gemini/i.test(m);
        list.push({
          rank: rank++,
          id: `combo-${m}`,
          name: m,
          providerName: `Combo: ${comboName}`,
          adapter: isGoogle ? "gemini-live" : "openai-realtime",
          credentialRef: isGoogle ? "gemini" : "openai",
          model: m,
          wsBaseUrl: "",
          apiBaseUrl: "",
          headers: {},
          settings: {
            voice: isGoogle ? "Kore" : "alloy",
            inputSampleRate: isGoogle ? 16000 : 24000,
            outputSampleRate: 24000,
          },
        });
      }
    }
    if (list.length > 0) return list;
  }

  // Standard target config:
  const primary = {
    ...targetConfig,
    rank: 1,
    name: targetConfig.name || targetConfig.id || "Primary API",
  };
  const fallbacks = (Array.isArray(targetConfig.fallbacks) ? targetConfig.fallbacks : []).map((fb, idx) => ({
    ...fb,
    rank: idx + 2,
    name: fb.name || `Fallback #${idx + 2}`,
    settings: {
      ...(targetConfig.settings || {}),
      ...(fb.settings || {}),
    },
  }));
  return [primary, ...fallbacks];
}

const wss = new WebSocketServer({ noServer: true, maxPayload: DEFAULTS.maxPayload });

const flushPendingText = (client, upstream, isOpenAIWire) => {
  const pending = client.__live.pendingText || [];
  client.__live.pendingText = [];
  if (!pending.length || !upstream || upstream.readyState !== WebSocket.OPEN) return;
  for (const text of pending) {
    if (isOpenAIWire) {
      upstream.send(
        JSON.stringify({
          type: "conversation.item.create",
          item: { type: "message", role: "user", content: [{ type: "input_text", text }] },
        })
      );
      upstream.send(JSON.stringify({ type: "response.create" }));
    } else {
      upstream.send(
        JSON.stringify({ clientContent: { turns: [{ role: "user", parts: [{ text }] }], turnComplete: true } })
      );
    }
    sendJson(client, { type: "parallel_text_sent", text });
  }
};

wss.on("connection", (client, req) => {
  client.__live = { closed: false, pendingText: [] };
  const query = parseQuery(req);
  if (!isLoopback(req) && query.get("token") !== liveWsToken()) {
    sendJson(client, { type: "error", code: "unauthorized", message: "Missing or invalid live session token." });
    client.close(1008, "unauthorized");
    return;
  }

  const settings = readSettings();
  const live = (settings && settings.liveCommunication) || {};
  const combos = readCombos();
  const resolved = resolveTargetConfig(req, query, live, combos);
  let config = resolved.config;
  const modelOverride = query.get("model");

  if (!config) {
    sendJson(client, { type: "error", code: "config_missing", message: "No voice configuration found." });
    client.close(1008, "config missing");
    return;
  }
  if (modelOverride) config = { ...config, model: modelOverride };

  const candidates = getCandidateChain(config, resolved.isCombo, resolved.comboName, combos, live.configs || []);
  const errorLog = [];
  let candidateIndex = 0;
  let cycle = 0;
  let ready = false;
  let isFailingOver = false;
  let activeUpstream = null;
  let activeCandidate = null;
  let setupTimer = null;
  let assistantSpeaking = false;

  const setAssistantSpeaking = (value) => {
    if (assistantSpeaking === value) return;
    assistantSpeaking = value;
    const interruptionsAllowed = activeCandidate?.settings?.interruptionEnabled !== false;
    if (!interruptionsAllowed) sendJson(client, { type: "inputGate", muted: value });
  };

  const recordError = (candidate, code, reason, endpointUrl) => {
    errorLog.push({
      rank: candidate.rank || 1,
      name: candidate.providerName ? `${candidate.providerName} (${candidate.name})` : candidate.name,
      model: candidate.model,
      adapter: candidate.adapter || "gemini-live",
      baseUrl: candidate.apiBaseUrl || candidate.wsBaseUrl || "default",
      endpoint: (endpointUrl || candidate.wsBaseUrl || candidate.apiBaseUrl || "default").replace(/key=[^&]+/, "key=***"),
      credential: candidate.credentialRef || "(none)",
      code,
      error: reason,
      time: new Date().toLocaleTimeString(),
    });
  };

  function connectCandidate(idx, currentCycle) {
    if (client.__live.closed) return;

    if (idx >= candidates.length) {
      if (currentCycle === 0) {
        // All APIs stopped working! Cycle back to first API again
        sendJson(client, {
          type: "text",
          role: "system",
          text: `🔄 [Failover Cycle] All ${candidates.length} ranked API(s) failed on first pass. Cycling back to Rank #1 for one retry pass...`,
        });
        return connectCandidate(0, 1);
      }

      // None is working! Send detailed message with all problem's details
      const report = formatFailoverReport(errorLog, candidates);
      sendJson(client, { type: "text", role: "system", text: report });
      sendJson(client, {
        type: "error",
        code: "all_fallbacks_failed",
        message: "All fallback APIs failed after 2 full passes. Full problem details have been sent to the chat log.",
      });
      try { client.close(1011, "all fallbacks failed"); } catch {}
      return;
    }

    candidateIndex = idx;
    cycle = currentCycle;
    ready = false;
    isFailingOver = false;
    const candidate = candidates[idx];
    activeCandidate = candidate;
    const currentRank = candidate.rank || (idx + 1);

    const credential = resolveCredential(candidate.credentialRef);
    if (credential.kind === "none" && candidate.authMode !== "none") {
      const reason = credential.reason || `No usable credential for "${candidate.credentialRef}".`;
      recordError(candidate, "Credential Missing", reason);
      sendJson(client, {
        type: "text",
        role: "system",
        text: `⚠️ [Failover] Rank #${currentRank} (${candidate.name} · ${candidate.model}) skipped: ${reason}. Trying next API in ranking...`,
      });
      return connectCandidate(idx + 1, currentCycle);
    }
    if (credential.kind === "oauth" && credential.expired) {
      const reason = `OAuth token for ${credential.provider} is expired.`;
      recordError(candidate, "Credential Expired", reason);
      sendJson(client, {
        type: "text",
        role: "system",
        text: `⚠️ [Failover] Rank #${currentRank} (${candidate.name} · ${candidate.model}) skipped: ${reason}. Trying next API in ranking...`,
      });
      return connectCandidate(idx + 1, currentCycle);
    }

    const adapter = candidate.adapter || "gemini-live";
    const isGeminiWire = adapter === "gemini-live" || adapter.includes("gemini");
    const isOpenAIWire = !isGeminiWire;
    const upstreamBase = buildUpstreamUrl(candidate);
    let upstreamUrl = upstreamBase;
    const headers = { ...parseCustomHeaders(candidate.headers) };

    if (isGeminiWire) {
      upstreamUrl = credential.kind === "api-key" ? withApiKey(upstreamBase, credential.apiKey) : upstreamBase;
      if (credential.kind === "oauth") headers.authorization = "Bearer " + credential.accessToken;
    } else if (isOpenAIWire) {
      upstreamUrl = upstreamBase;
      const token = credential.apiKey || credential.accessToken;
      if (token) headers.authorization = "Bearer " + token;
      if (adapter === "qwen-realtime") headers["X-DashScope-DataInspection"] = "enable";
    } else {
      upstreamUrl = upstreamBase;
      const token = credential.apiKey || credential.accessToken;
      if (token) headers.authorization = "Bearer " + token;
    }

    sendJson(client, {
      type: "status",
      state: "connecting",
      detail: `Rank #${currentRank}: ${candidate.name} (${candidate.model})`,
    });

    let upstream;
    try {
      upstream = new WebSocket(upstreamUrl, { headers, maxPayload: DEFAULTS.maxPayload });
    } catch (err) {
      recordError(candidate, "Connection Error", String(err?.message || err), upstreamUrl);
      sendJson(client, {
        type: "text",
        role: "system",
        text: `⚠️ [Failover] Rank #${currentRank} (${candidate.name} · ${candidate.model}) connection error: ${String(err?.message || err)}. Trying next API in ranking...`,
      });
      return connectCandidate(idx + 1, currentCycle);
    }

    activeUpstream = upstream;
    client.__live.upstream = upstream;

    setupTimer = setTimeout(() => {
      if (ready || isFailingOver) return;
      isFailingOver = true;
      try {
        upstream.removeAllListeners();
        upstream.close();
      } catch {}
      recordError(candidate, "Setup Timeout", "Upstream did not confirm session within 25s.", upstreamUrl);
      sendJson(client, {
        type: "text",
        role: "system",
        text: `⚠️ [Failover] Rank #${currentRank} (${candidate.name} · ${candidate.model}) setup timed out. Failing over to next ranked API...`,
      });
      connectCandidate(idx + 1, currentCycle);
    }, 25000);

    const failoverToNext = (code, reason) => {
      if (isFailingOver || client.__live.closed) return;
      isFailingOver = true;
      clearTimeout(setupTimer);
      try {
        upstream.removeAllListeners();
        upstream.close();
      } catch {}
      recordError(candidate, code, reason, upstreamUrl);
      sendJson(client, {
        type: "text",
        role: "system",
        text: `⚠️ [Failover] Rank #${currentRank} (${candidate.name} · ${candidate.model}) failed (${code}): ${reason}. Failing over to next ranked API...`,
      });
      connectCandidate(idx + 1, currentCycle);
    };

    upstream.on("open", () => {
      const model = candidate.model;
      if (!model) {
        return failoverToNext("model_missing", "No model configured.");
      }
      if (isGeminiWire) {
        upstream.send(JSON.stringify(geminiSetup(candidate, model)));
      } else if (adapter === "qwen-realtime") {
        upstream.send(JSON.stringify(qwenRealtimeSetup(candidate)));
      } else {
        upstream.send(JSON.stringify(openaiRealtimeSetup(candidate, model)));
      }
    });

    upstream.on("message", (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (isOpenAIWire) {
        if (msg.type === "session.created" || msg.type === "session.updated") {
          ready = true;
          clearTimeout(setupTimer);
          sendJson(client, {
            type: "ready",
            model: candidate.model,
            name: candidate.name || candidate.id,
            adapter,
            rank: currentRank,
            parallelModality: true,
          });
          sendJson(client, {
            type: "status",
            state: "connected",
            detail: `Rank #${currentRank}: ${candidate.name} (${candidate.model})`,
            parallelModality: true,
          });
          if (currentRank > 1 || currentCycle > 0) {
            sendJson(client, {
              type: "text",
              role: "system",
              text: `✅ [Failover Succeeded] Switched to Rank #${currentRank}: ${candidate.name} (${candidate.model}) via ${candidate.adapter}.`,
            });
          }
          flushPendingText(client, upstream, true);
          return;
        }
        if ((msg.type === "response.output_audio.delta" || msg.type === "response.audio.delta") && msg.delta) {
          setAssistantSpeaking(true);
          const buf = Buffer.from(msg.delta, "base64");
          if (client.readyState === WebSocket.OPEN) client.send(buf, { binary: true });
          return;
        }
        if (
          (msg.type === "response.audio_transcript.delta" ||
            msg.type === "response.output_audio_transcript.delta" ||
            msg.type === "response.text.delta" ||
            msg.type === "response.output_text.delta") &&
          msg.delta
        ) {
          sendJson(client, { type: "text", role: "assistant", text: msg.delta });
          return;
        }
        if (msg.type === "conversation.item.input_audio_transcription.completed" && msg.transcript) {
          sendJson(client, { type: "text", role: "user", text: msg.transcript, modality: "voice" });
          return;
        }
        if (msg.type === "input_audio_buffer.speech_started") {
          setAssistantSpeaking(false);
          sendJson(client, { type: "interrupted" });
          return;
        }
        if (msg.type === "response.done") {
          setAssistantSpeaking(false);
          sendJson(client, { type: "turnComplete" });
          return;
        }
        if (msg.type === "error") {
          const errMsg = String(msg.error?.message || "OpenAI Realtime error").slice(0, 400);
          if (!ready) {
            failoverToNext("upstream_error", errMsg);
          } else {
            sendJson(client, {
              type: "error",
              code: msg.error?.code || "upstream_error",
              message: errMsg,
            });
          }
          return;
        }
        return;
      }

      if (msg.setupComplete) {
        ready = true;
        clearTimeout(setupTimer);
        sendJson(client, {
          type: "ready",
          model: candidate.model,
          name: candidate.name || candidate.id,
          adapter: candidate.adapter || "gemini-live",
          rank: currentRank,
          parallelModality: true,
        });
        sendJson(client, {
          type: "status",
          state: "connected",
          detail: `Rank #${currentRank}: ${candidate.name} (${candidate.model})`,
          parallelModality: true,
        });
        if (currentRank > 1 || currentCycle > 0) {
          sendJson(client, {
            type: "text",
            role: "system",
            text: `✅ [Failover Succeeded] Switched to Rank #${currentRank}: ${candidate.name} (${candidate.model}) via ${candidate.adapter}.`,
          });
        }
        flushPendingText(client, upstream, false);
        return;
      }
      if (msg.error) {
        const errMsg = String(msg.error.message || msg.error.status || "Upstream error").slice(0, 400);
        if (!ready) {
          failoverToNext("upstream_error", errMsg);
        } else {
          sendJson(client, {
            type: "error",
            code: "upstream_error",
            message: errMsg,
          });
        }
        return;
      }
      if (msg.sessionResumptionUpdate && msg.sessionResumptionUpdate.newHandle) {
        sendJson(client, { type: "resumption", handle: msg.sessionResumptionUpdate.newHandle });
      }
      if (msg.goAway) {
        sendJson(client, { type: "status", state: "reconnecting", reason: msg.goAway.timeLeft || "" });
        return;
      }
      const sc = msg.serverContent;
      if (!sc) return;
      if (sc.interrupted) {
        setAssistantSpeaking(false);
        sendJson(client, { type: "interrupted" });
      }
      if (sc.inputTranscription && sc.inputTranscription.text) {
        sendJson(client, { type: "text", role: "user", text: sc.inputTranscription.text, modality: "voice" });
      }
      if (sc.outputTranscription && sc.outputTranscription.text) {
        sendJson(client, { type: "text", role: "assistant", text: sc.outputTranscription.text });
      }
      if (sc.modelTurn && Array.isArray(sc.modelTurn.parts)) {
        for (const part of sc.modelTurn.parts) {
          if (part.inlineData && part.inlineData.data) {
            setAssistantSpeaking(true);
            const buf = Buffer.from(part.inlineData.data, "base64");
            if (client.readyState === WebSocket.OPEN) client.send(buf, { binary: true });
          } else if (part.text) {
            sendJson(client, { type: "text", role: "assistant", text: part.text });
          }
        }
      }
      if (sc.turnComplete) {
        setAssistantSpeaking(false);
        sendJson(client, { type: "turnComplete" });
      }
    });

    upstream.on("error", (err) => {
      const errMsg = String(err && err.message ? err.message : err).slice(0, 400);
      if (!ready) {
        failoverToNext("upstream_failed", errMsg);
      } else {
        sendJson(client, { type: "error", code: "upstream_failed", message: errMsg });
      }
    });

    upstream.on("close", (code, reason) => {
      clearTimeout(setupTimer);
      if (!client.__live.closed) {
        const detail = String(reason || "").slice(0, 200);
        if (!ready) {
          failoverToNext(`closed_${code}`, detail || `Socket closed with code ${code}`);
        } else if (candidates.length > 1) {
          // Mid-session disconnect: automatically fail over to next ranked API!
          sendJson(client, {
            type: "text",
            role: "system",
            text: `⚠️ Live connection on Rank #${currentRank} (${candidate.name}) disconnected (${code}: ${detail || "closed"}). Failing over to next ranked API...`,
          });
          connectCandidate((idx + 1) % candidates.length, 0);
        } else {
          sendJson(client, { type: "status", state: "disconnected", code, reason: detail });
          try { client.close(1000, "upstream closed"); } catch {}
        }
      }
    });
  }

  // Client messages: simultaneous audio streaming + text input concurrently in parallel
  client.on("message", (raw, isBinary) => {
    if (client.__live.closed || !activeUpstream) return;
    const currentAdapter = activeCandidate?.adapter || "gemini-live";
    const currentIsGeminiWire = currentAdapter === "gemini-live" || currentAdapter.includes("gemini");
    const currentIsOpenAIWire = !currentIsGeminiWire;
    const interruptionsAllowed = activeCandidate?.settings?.interruptionEnabled !== false;

    // 1. Binary frames: Microphone PCM audio chunk
    if (isBinary) {
      if (!ready || activeUpstream.readyState !== WebSocket.OPEN) return;
      if (!interruptionsAllowed && assistantSpeaking) return;
      const payload = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
      if (currentIsOpenAIWire) {
        activeUpstream.send(
          JSON.stringify({
            type: "input_audio_buffer.append",
            audio: payload.toString("base64"),
          })
        );
      } else {
        activeUpstream.send(
          JSON.stringify({
            realtimeInput: { audio: { mimeType: activeCandidate?.settings?.inputMimeType || DEFAULTS.inputMimeType, data: payload.toString("base64") } },
          })
        );
      }
      return;
    }

    // 2. JSON control messages: text input, ping, interrupt
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === "ping") return sendJson(client, { type: "pong", at: Date.now() });

    if (msg.type === "interrupt") {
      setAssistantSpeaking(false);
      sendJson(client, { type: "interrupted" });
      if (ready && activeUpstream.readyState === WebSocket.OPEN) {
        if (currentIsOpenAIWire) {
          activeUpstream.send(JSON.stringify({ type: "response.cancel" }));
        } else {
          activeUpstream.send(JSON.stringify({ realtimeInput: { activityStart: {} } }));
        }
      }
      return;
    }

    // 3. User sends text message concurrently while audio is active
    if (msg.type === "text" && typeof msg.text === "string" && msg.text.trim()) {
      const text = msg.text.slice(0, 8000);
      if (!ready || activeUpstream.readyState !== WebSocket.OPEN) {
        // Session still handshaking: keep the prompt and send it on ready.
        if ((client.__live.pendingText || []).length < 20) client.__live.pendingText.push(text);
        return;
      }
      if (currentIsOpenAIWire) {
        activeUpstream.send(
          JSON.stringify({
            type: "conversation.item.create",
            item: { type: "message", role: "user", content: [{ type: "input_text", text }] },
          })
        );
        activeUpstream.send(JSON.stringify({ type: "response.create" }));
      } else {
        activeUpstream.send(
          JSON.stringify({ clientContent: { turns: [{ role: "user", parts: [{ text }] }], turnComplete: true } })
        );
      }
      sendJson(client, { type: "parallel_text_sent", text });
    }
  });

  const cleanup = () => {
    if (client.__live.closed) return;
    client.__live.closed = true;
    clearTimeout(setupTimer);
    try {
      if (activeUpstream && (activeUpstream.readyState === WebSocket.OPEN || activeUpstream.readyState === WebSocket.CONNECTING)) {
        activeUpstream.close();
      }
    } catch {}
  };
  client.on("close", cleanup);
  client.on("error", cleanup);

  // Start with first candidate (Rank #1)
  connectCandidate(0, 0);
});

function handleUpgrade(req, socket, head) {
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
}

module.exports = {
  OPERATOR,
  handleUpgrade,
  buildUpstreamUrl,
  resolveCredential,
  geminiSetup,
  readSettings,
  readCombos,
  liveWsToken,
  DEFAULT_GEMINI_LIVE_URL,
};
