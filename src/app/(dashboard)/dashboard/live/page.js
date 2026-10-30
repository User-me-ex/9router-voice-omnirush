"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Card, Button, Input, Select, Toggle } from "@/shared/components";
import IntegrationDocs from "./IntegrationDocs";

const DEFAULT_PRESETS = {
  "gemini-live": {
    name: "testing",
    providerName: "Google Gemini Live",
    adapter: "gemini-live",
    credentialRef: "gemini",
    authMode: "nine-router",
    apiBaseUrl: "https://generativelanguage.googleapis.com",
    wsBaseUrl:
      "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent",
    endpointPath: "",
    urlMode: "session-model",
    model: "gemini-2.5-flash-native-audio-preview-12-2025",
    settings: {
      voice: "Kore",
      systemPrompt: "",
      inputSampleRate: 16000,
      outputSampleRate: 24000,
      inputMimeType: "audio/pcm;rate=16000",
      interruptionEnabled: true,
      temperature: null,
      maxOutputTokens: null,
    },
    headers: {},
    fallbacks: [],
  },
  "openai-realtime": {
    name: "openai-realtime",
    providerName: "OpenAI Realtime",
    adapter: "openai-realtime",
    credentialRef: "openai",
    authMode: "nine-router",
    apiBaseUrl: "https://api.openai.com/v1",
    wsBaseUrl: "wss://api.openai.com/v1/realtime",
    endpointPath: "",
    urlMode: "session-model",
    model: "gpt-realtime-2.1",
    settings: {
      voice: "alloy",
      systemPrompt: "",
      inputSampleRate: 24000,
      outputSampleRate: 24000,
      inputMimeType: "audio/pcm;rate=24000",
      interruptionEnabled: true,
      temperature: null,
      maxOutputTokens: null,
    },
    headers: {},
    fallbacks: [],
  },
  "vertex-live": {
    name: "vertex-live",
    providerName: "Vertex AI Gemini Live",
    adapter: "gemini-live",
    credentialRef: "vertex",
    authMode: "nine-router",
    apiBaseUrl: "https://us-central1-aiplatform.googleapis.com",
    wsBaseUrl:
      "wss://us-central1-aiplatform.googleapis.com/ws/google.cloud.aiplatform.v1.LlmBidiService/BidiGenerateContent",
    endpointPath: "",
    urlMode: "session-model",
    model: "gemini-live-2.5-flash-native-audio",
    settings: {
      voice: "Kore",
      systemPrompt: "",
      inputSampleRate: 16000,
      outputSampleRate: 24000,
      inputMimeType: "audio/pcm;rate=16000",
      interruptionEnabled: true,
      temperature: null,
      maxOutputTokens: null,
    },
    headers: {},
    fallbacks: [],
  },
  "qwen-realtime": {
    name: "qwen-omni",
    providerName: "Qwen Omni Realtime",
    adapter: "qwen-realtime",
    credentialRef: "alibaba",
    authMode: "nine-router",
    apiBaseUrl: "https://dashscope.aliyuncs.com/api/v1",
    wsBaseUrl: "wss://dashscope.aliyuncs.com/api-ws/v1/realtime",
    endpointPath: "",
    urlMode: "session-model",
    model: "qwen3.5-omni-flash-realtime",
    settings: {
      voice: "Cherry",
      systemPrompt: "",
      inputSampleRate: 16000,
      outputSampleRate: 24000,
      inputMimeType: "audio/pcm;rate=16000",
      interruptionEnabled: true,
      temperature: null,
      maxOutputTokens: null,
    },
    headers: {},
    fallbacks: [],
  },
  "custom-live": {
    name: "custom-voice",
    providerName: "Custom WebSocket Endpoint",
    adapter: "openai-realtime",
    credentialRef: "",
    authMode: "none",
    apiBaseUrl: "http://127.0.0.1:8000/v1",
    wsBaseUrl: "ws://127.0.0.1:8000/v1/realtime",
    endpointPath: "",
    urlMode: "session-model",
    model: "custom-voice-model",
    settings: {
      voice: "alloy",
      systemPrompt: "",
      inputSampleRate: 24000,
      outputSampleRate: 24000,
      inputMimeType: "audio/pcm;rate=24000",
      interruptionEnabled: true,
      temperature: null,
      maxOutputTokens: null,
    },
    headers: {},
    fallbacks: [],
  },
};

const CURATED_LIVE_BY_FAMILY = {
  google: [
    { id: "gemini-3.8-live", label: "Gemini 3.8 Live (Recommended)", adapter: "gemini-live", voice: "Kore", inRate: 16000, outRate: 24000 },
    { id: "gemini-3.8-live-extended-thinking", label: "Gemini 3.8 Live Extended Thinking", adapter: "gemini-live", voice: "Kore", inRate: 16000, outRate: 24000 },
    { id: "gemini-2.5-flash-native-audio-preview-12-2025", label: "Gemini 2.5 Flash Native Audio (12-2025)", adapter: "gemini-live", voice: "Kore", inRate: 16000, outRate: 24000 },
    { id: "gemini-2.5-flash-native-audio-preview-09-2025", label: "Gemini 2.5 Flash Native Audio (09-2025)", adapter: "gemini-live", voice: "Kore", inRate: 16000, outRate: 24000 },
    { id: "gemini-3.5-live-translate-preview", label: "Gemini 3.5 Live Translate", adapter: "gemini-live", voice: "Kore", inRate: 16000, outRate: 24000 },
    { id: "gemini-3.1-flash-live-preview", label: "Gemini 3.1 Flash Live (Legacy)", adapter: "gemini-live", voice: "Kore", inRate: 16000, outRate: 24000 },
    { id: "gemini-live-2.5-flash-native-audio", label: "Gemini Live 2.5 Flash Native Audio (Vertex)", adapter: "gemini-live", voice: "Kore", inRate: 16000, outRate: 24000 },
  ],
  openai: [
    { id: "gpt-realtime-2.1", label: "GPT Realtime 2.1 (Recommended)", adapter: "openai-realtime", voice: "alloy", inRate: 24000, outRate: 24000 },
    { id: "gpt-realtime-2", label: "GPT Realtime 2.0", adapter: "openai-realtime", voice: "alloy", inRate: 24000, outRate: 24000 },
    { id: "gpt-realtime-1.5", label: "GPT Realtime 1.5", adapter: "openai-realtime", voice: "alloy", inRate: 24000, outRate: 24000 },
    { id: "gpt-realtime-mini", label: "GPT Realtime Mini", adapter: "openai-realtime", voice: "alloy", inRate: 24000, outRate: 24000 },
    { id: "gpt-audio", label: "GPT Audio", adapter: "openai-realtime", voice: "alloy", inRate: 24000, outRate: 24000 },
    { id: "gpt-audio-mini", label: "GPT Audio Mini", adapter: "openai-realtime", voice: "alloy", inRate: 24000, outRate: 24000 },
    { id: "gpt-4o-realtime-preview", label: "GPT-4o Realtime (Legacy)", adapter: "openai-realtime", voice: "alloy", inRate: 24000, outRate: 24000 },
    { id: "gpt-4o-mini-realtime-preview", label: "GPT-4o Mini Realtime (Legacy)", adapter: "openai-realtime", voice: "alloy", inRate: 24000, outRate: 24000 },
  ],
  alibaba: [
    { id: "qwen3.5-omni-flash-realtime", label: "Qwen3.5 Omni Flash Realtime (Recommended)", adapter: "qwen-realtime", voice: "Cherry", inRate: 16000, outRate: 24000 },
    { id: "qwen3.5-omni-plus-realtime", label: "Qwen3.5 Omni Plus Realtime", adapter: "qwen-realtime", voice: "Cherry", inRate: 16000, outRate: 24000 },
    { id: "qwen3.8-omni-flash-realtime", label: "Qwen3.8 Omni Flash Realtime (Workspace endpoint)", adapter: "qwen-realtime", voice: "Tina", inRate: 16000, outRate: 24000 },
    { id: "qwen3-omni-flash-realtime", label: "Qwen3 Omni Flash Realtime", adapter: "qwen-realtime", voice: "Cherry", inRate: 16000, outRate: 24000 },
    { id: "qwen3-omni-flash-realtime-2025-09-15", label: "Qwen3 Omni Flash Realtime (2025-09-15)", adapter: "qwen-realtime", voice: "Cherry", inRate: 16000, outRate: 24000 },
  ],
};

function getLiveModelsForCredential(credentialRef, providers = []) {
  const conn = (providers || []).find(
    (p) => p.id === credentialRef || p.provider === credentialRef || (p.name && p.name.toLowerCase() === String(credentialRef).toLowerCase())
  );
  const pKey = (conn ? conn.provider : credentialRef || "").toLowerCase();
  const pName = (conn ? conn.name : "").toLowerCase();

  if (pKey.includes("gemini") || pKey.includes("vertex") || pKey.includes("antigravity")) {
    return CURATED_LIVE_BY_FAMILY.google;
  }
  if (pKey === "openai" || pKey === "azure" || pKey.includes("openai") || pName.includes("openai") || pName.includes("openrouter") || pKey.includes("openrouter")) {
    return CURATED_LIVE_BY_FAMILY.openai;
  }
  if (pKey.includes("alibaba") || pKey.includes("qwen") || pKey.includes("alicode")) {
    return CURATED_LIVE_BY_FAMILY.alibaba;
  }
  return [];
}

const STANDARD_ADAPTERS = [
  { id: "gemini-live", label: "Google Gemini Live (BidiGenerateContent)" },
  { id: "openai-realtime", label: "OpenAI / ChatGPT Realtime (WebSocket)" },
  { id: "qwen-realtime", label: "Qwen Omni Realtime (DashScope WebSocket)" },
];

const SAMPLE_RATE_CHOICES = [8000, 16000, 24000, 48000];

function sampleRateDefaults(adapter) {
  const preset = DEFAULT_PRESETS[adapter] || DEFAULT_PRESETS["gemini-live"];
  return {
    input: preset.settings.inputSampleRate,
    output: preset.settings.outputSampleRate,
  };
}

function getCredentialOptions(providers, currentRef) {
  // Shows ALL active provider connections in 9Router!
  const active = (providers || []).map((p) => {
    const isDiff = p.name && p.name !== p.provider;
    return {
      value: p.id || p.provider,
      label: `[Active] ${p.name || p.provider}${isDiff ? ` (${p.provider})` : ""}`,
    };
  });

  const presets = [
    { value: "gemini", label: "[Preset] Google Gemini (Official API Key)" },
    { value: "openai", label: "[Preset] OpenAI Official (API Key)" },
    { value: "vertex", label: "[Preset] Google Vertex AI Live" },
    { value: "alibaba", label: "[Preset] Alibaba / Qwen DashScope" },
  ];

  const seen = new Set([...active.map((a) => a.value), ...presets.map((u) => u.value)]);
  const extra = [];
  if (currentRef && !seen.has(currentRef)) {
    extra.push({ value: currentRef, label: currentRef });
  }

  return [...active, ...presets, ...extra];
}

const STATE_TONE = {
  passed: "text-green-500",
  failed: "text-red-500",
  skipped: "text-text-muted",
};

function newId() {
  return "live-" + Math.random().toString(36).slice(2, 10);
}

function downsample(buffer, inRate, outRate) {
  if (outRate === inRate) return buffer;
  const ratio = inRate / outRate;
  const length = Math.round(buffer.length / ratio);
  const out = new Float32Array(length);
  let offset = 0;
  for (let i = 0; i < length; i++) {
    const next = Math.round((i + 1) * ratio);
    let sum = 0;
    let count = 0;
    for (let j = offset; j < next && j < buffer.length; j++) {
      sum += buffer[j];
      count++;
    }
    out[i] = count ? sum / count : 0;
    offset = next;
  }
  return out;
}

function toInt16(float32) {
  const out = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

function int16ToFloat32(int16) {
  const out = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) out[i] = int16[i] / 0x8000;
  return out;
}

export default function LiveCommunicationPage() {
  // Main Tab: "testing" (Testing Connection) or "endpoint" (Model & Endpoint)
  const [tab, setTab] = useState("testing");

  // Sub-mode in Testing Connection: "config" (Saved Configurations & Combos) or "custom" (Custom Testing)
  const [testMode, setTestMode] = useState("config");

  const [configs, setConfigs] = useState([]);
  const [combos, setCombos] = useState([]);
  const [defaultId, setDefaultId] = useState("");
  const [adapters, setAdapters] = useState([]);
  const [models, setModels] = useState([]);
  const [providers, setProviders] = useState([]);
  const [wsToken, setWsToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [errorBanner, setErrorBanner] = useState("");
  const [copiedKey, setCopiedKey] = useState("");

  // Testing session selection
  const [selectedTarget, setSelectedTarget] = useState(""); // config name or combo name
  const [status, setStatus] = useState("idle");
  const [statusDetail, setStatusDetail] = useState("");
  const [turns, setTurns] = useState([]);
  const [level, setLevel] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [inputMuted, setInputMuted] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [testing, setTesting] = useState({});

  // Custom Testing parameters (Ad-hoc)
  const [customCred, setCustomCred] = useState("gemini-cli");
  const [customModel, setCustomModel] = useState("gemini-2.5-flash-native-audio-preview-12-2025");
  const [customWsUrl, setCustomWsUrl] = useState(DEFAULT_PRESETS["gemini-live"].wsBaseUrl);
  const [customAdapter, setCustomAdapter] = useState("gemini-live");
  const [customVoice, setCustomVoice] = useState("Kore");
  const [customPrompt, setCustomPrompt] = useState("");
  const [customInRate, setCustomInRate] = useState("");
  const [customOutRate, setCustomOutRate] = useState("");
  const [customHeaders, setCustomHeaders] = useState("");
  const [customModelMode, setCustomModelMode] = useState(false);
  const [customAdapterMode, setCustomAdapterMode] = useState(false);
  const [customModelActive, setCustomModelActive] = useState({});
  const [customAdapterActive, setCustomAdapterActive] = useState({});

  const wsRef = useRef(null);
  const playCtxRef = useRef(null);
  const micCtxRef = useRef(null);
  const micStreamRef = useRef(null);
  const processorRef = useRef(null);
  const gainRef = useRef(null);
  const analyserRef = useRef(null);
  const sourcesRef = useRef([]);
  const nextTimeRef = useRef(0);
  const levelTimerRef = useRef(null);
  const elapsedTimerRef = useRef(null);

  const active = status === "connected" || status === "connecting";

  // Find active configuration or combo
  const currentConfig = configs.find((c) => c.name === selectedTarget || c.id === selectedTarget) || configs[0] || null;
  const currentCombo = combos.find((c) => c.name === selectedTarget);

  // Custom Testing: live models for the selected credential
  const customLiveModels = getLiveModelsForCredential(customCred, providers);
  const isCustomCustomModel = customModelMode || !customLiveModels.some((m) => m.id === customModel);
  const isCustomCustomAdapter = customAdapterMode || !STANDARD_ADAPTERS.some((a) => a.id === customAdapter);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const configRes = await fetch("/api/live/config");
      const configData = await configRes.json();
      setConfigs(Array.isArray(configData.configs) ? configData.configs : []);
      setCombos(Array.isArray(configData.combos) ? configData.combos : []);
      setDefaultId(configData.defaultId || "");
      setAdapters(Array.isArray(configData.adapters) ? configData.adapters : []);
      setProviders(Array.isArray(configData.credentials) ? configData.credentials : []);
      setModels(Array.isArray(configData.models) ? configData.models : []);
      setWsToken(configData.wsToken || "");

      const initialTarget = (configData.configs && configData.configs[0] && (configData.configs[0].name || configData.configs[0].id)) || "";
      setSelectedTarget((prev) => prev || initialTarget);
    } catch (error) {
      setNotice(String(error && error.message ? error.message : error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
    return () => {
      teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function copyToClipboard(text, key) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(""), 2000);
  }

  function patchConfig(id, patch) {
    setConfigs((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const updated = { ...c, ...patch };
        if (patch.name !== undefined) {
          updated.name = String(patch.name).toLowerCase().replace(/[^a-z0-9_-]/g, "-");
        }
        if (patch.settings) {
          updated.settings = { ...c.settings, ...patch.settings };
        }
        return updated;
      })
    );
  }

  function addPresetConfig(presetKey = "gemini-live") {
    const preset = DEFAULT_PRESETS[presetKey] || DEFAULT_PRESETS["gemini-live"];
    let bestCred = preset.credentialRef;
    if (presetKey === "openai-realtime") {
      const match = providers.find((p) => p.provider.includes("openai"));
      if (match) bestCred = match.id || match.provider;
    } else if (presetKey === "gemini-live" || presetKey === "vertex-live") {
      const match = providers.find((p) => ["gemini", "vertex", "gemini-cli", "antigravity"].includes(p.provider));
      if (match) bestCred = match.id || match.provider;
    }

    const uniqueName = "voice-" + Math.random().toString(36).slice(2, 6);
    const config = {
      ...preset,
      id: newId(),
      name: uniqueName,
      credentialRef: bestCred,
      settings: { ...preset.settings },
    };
    setConfigs((prev) => [...prev, config]);
    setSelectedTarget(config.name);
  }

  function removeConfig(id) {
    setConfigs((prev) => prev.filter((c) => c.id !== id));
  }

  function addFallback(configId, presetKey = "openai-realtime") {
    const preset = DEFAULT_PRESETS[presetKey] || DEFAULT_PRESETS["openai-realtime"];
    let bestCred = preset.credentialRef;
    if (presetKey === "openai-realtime") {
      const match = providers.find((p) => p.provider.includes("openai"));
      if (match) bestCred = match.id || match.provider;
    } else if (presetKey === "gemini-live" || presetKey === "vertex-live") {
      const match = providers.find((p) => ["gemini", "vertex", "gemini-cli", "antigravity"].includes(p.provider));
      if (match) bestCred = match.id || match.provider;
    } else if (presetKey === "qwen-realtime") {
      const match = providers.find((p) => p.provider.includes("alibaba") || p.provider.includes("qwen"));
      if (match) bestCred = match.id || match.provider;
    }

    setConfigs((prev) =>
      prev.map((c) => {
        if (c.id !== configId) return c;
        const currentFallbacks = Array.isArray(c.fallbacks) ? c.fallbacks : [];
        const nextRank = currentFallbacks.length + 2;
        const newFb = {
          id: `fb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: `Fallback #${nextRank} (${preset.providerName || preset.name})`,
          providerName: preset.providerName || "Fallback API",
          adapter: preset.adapter,
          credentialRef: bestCred,
          authMode: preset.authMode || "nine-router",
          apiBaseUrl: preset.apiBaseUrl,
          wsBaseUrl: preset.wsBaseUrl,
          endpointPath: preset.endpointPath,
          urlMode: preset.urlMode,
          model: preset.model,
          headers: {},
          settings: {
            voice: preset.settings?.voice || "alloy",
            inputSampleRate: preset.settings?.inputSampleRate || 24000,
            outputSampleRate: preset.settings?.outputSampleRate || 24000,
            inputMimeType: preset.settings?.inputMimeType || "audio/pcm;rate=24000",
            interruptionEnabled: true,
            temperature: null,
            maxOutputTokens: null,
          },
        };
        return { ...c, fallbacks: [...currentFallbacks, newFb] };
      })
    );
  }

  function patchFallback(configId, fallbackId, patch) {
    setConfigs((prev) =>
      prev.map((c) => {
        if (c.id !== configId) return c;
        const currentFallbacks = Array.isArray(c.fallbacks) ? c.fallbacks : [];
        return {
          ...c,
          fallbacks: currentFallbacks.map((fb) => (fb.id === fallbackId ? { ...fb, ...patch } : fb)),
        };
      })
    );
  }

  function removeFallback(configId, fallbackId) {
    setConfigs((prev) =>
      prev.map((c) => {
        if (c.id !== configId) return c;
        const currentFallbacks = Array.isArray(c.fallbacks) ? c.fallbacks : [];
        return {
          ...c,
          fallbacks: currentFallbacks.filter((fb) => fb.id !== fallbackId),
        };
      })
    );
  }

  function moveFallbackUp(configId, index) {
    setConfigs((prev) =>
      prev.map((c) => {
        if (c.id !== configId) return c;
        const currentFallbacks = Array.isArray(c.fallbacks) ? [...c.fallbacks] : [];
        if (index === 0) {
          // Swap with Rank 1 (Primary Config)
          const target = currentFallbacks[0];
          const oldPrimary = {
            id: `fb-${Date.now()}`,
            name: c.providerName ? `${c.providerName} (Rank #2)` : `Fallback #2`,
            providerName: c.providerName,
            adapter: c.adapter,
            credentialRef: c.credentialRef,
            authMode: c.authMode,
            apiBaseUrl: c.apiBaseUrl,
            wsBaseUrl: c.wsBaseUrl,
            endpointPath: c.endpointPath,
            urlMode: c.urlMode,
            model: c.model,
            headers: c.headers,
            settings: c.settings,
          };
          currentFallbacks[0] = oldPrimary;
          return {
            ...c,
            providerName: target.providerName,
            adapter: target.adapter,
            credentialRef: target.credentialRef,
            authMode: target.authMode,
            apiBaseUrl: target.apiBaseUrl,
            wsBaseUrl: target.wsBaseUrl,
            endpointPath: target.endpointPath,
            urlMode: target.urlMode,
            model: target.model,
            headers: target.headers,
            settings: target.settings,
            fallbacks: currentFallbacks,
          };
        }
        if (index > 0 && index < currentFallbacks.length) {
          const temp = currentFallbacks[index - 1];
          currentFallbacks[index - 1] = currentFallbacks[index];
          currentFallbacks[index] = temp;
          return { ...c, fallbacks: currentFallbacks };
        }
        return c;
      })
    );
  }

  function moveFallbackDown(configId, index) {
    setConfigs((prev) =>
      prev.map((c) => {
        if (c.id !== configId) return c;
        const currentFallbacks = Array.isArray(c.fallbacks) ? [...c.fallbacks] : [];
        if (index >= 0 && index < currentFallbacks.length - 1) {
          const temp = currentFallbacks[index + 1];
          currentFallbacks[index + 1] = currentFallbacks[index];
          currentFallbacks[index] = temp;
          return { ...c, fallbacks: currentFallbacks };
        }
        return c;
      })
    );
  }

  // Save All Configurations with WebSocket Verification Enforcement
  async function saveConfigs() {
    setSaving(true);
    setNotice("");
    setErrorBanner("");

    // Verify WebSocket connection on each configuration before saving
    const verifiedConfigs = [];
    for (const cfg of configs) {
      if (cfg.authMode !== "none") {
        setTesting((prev) => ({ ...prev, [cfg.id]: { running: true, checks: [] } }));
        try {
          const testRes = await fetch("/api/live/test", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ config: cfg }),
          });
          const testData = await testRes.json();
          setTesting((prev) => ({ ...prev, [cfg.id]: { running: false, ...testData } }));

          if (!testData.verified) {
            setSaving(false);
            const reason = testData.reason || (testData.checks?.find((c) => c.state === "failed")?.detail) || "WebSocket handshake failed";
            setErrorBanner(
              `Cannot create configuration "${cfg.name || cfg.id}": The WebSocket connection to "${cfg.credentialRef}" / "${cfg.model}" failed verification (${reason}). Please check your provider API key or select a working WebSocket provider.`
            );
            return;
          }
          verifiedConfigs.push({
            ...cfg,
            verified: true,
            checkedAt: new Date().toISOString(),
            checks: testData.checks || [],
          });
        } catch (err) {
          setSaving(false);
          setErrorBanner(`Verification test request error for "${cfg.name}": ${String(err?.message || err)}`);
          return;
        }
      } else {
        verifiedConfigs.push(cfg);
      }
    }

    try {
      const res = await fetch("/api/live/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configs: verifiedConfigs, defaultId: defaultId || (verifiedConfigs[0] && verifiedConfigs[0].id) || "" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setConfigs(data.configs || []);
      setDefaultId(data.defaultId || "");
      setNotice("Configurations verified and saved successfully!");
    } catch (error) {
      setErrorBanner(String(error && error.message ? error.message : error));
    } finally {
      setSaving(false);
    }
  }

  async function testConfig(config) {
    if (!config) return;
    setTesting((prev) => ({ ...prev, [config.id]: { running: true, checks: [] } }));
    try {
      const res = await fetch("/api/live/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      const data = await res.json();
      setTesting((prev) => ({ ...prev, [config.id]: { running: false, ...data } }));
      if (data.verified) {
        setConfigs((prev) => prev.map((c) => (c.id === config.id ? { ...c, verified: true, checkedAt: new Date().toISOString(), checks: data.checks } : c)));
      }
    } catch (error) {
      setTesting((prev) => ({
        ...prev,
        [config.id]: { running: false, verified: false, checks: [{ id: "client", label: "Request", state: "failed", detail: String(error && error.message ? error.message : error) }] },
      }));
    }
  }

  function appendTurn(role, text, modality = "text") {
    if (!text) return;
    setTurns((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === role && last.modality === modality) {
        return [...prev.slice(0, -1), { role, text: last.text + text, modality }];
      }
      return [...prev, { role, text, modality }];
    });
  }

  function teardownPlayback() {
    sourcesRef.current.forEach((s) => {
      try {
        s.stop();
      } catch {}
    });
    sourcesRef.current = [];
    nextTimeRef.current = 0;
  }

  function playChunk(arrayBuffer) {
    const ctx = playCtxRef.current;
    if (!ctx) return;
    const int16 = new Int16Array(arrayBuffer);
    if (!int16.length) return;
    const float32 = int16ToFloat32(int16);
    const inputRate = testMode === "custom"
      ? (Number(customOutRate) || sampleRateDefaults(customAdapter).output)
      : (currentConfig?.settings?.outputSampleRate || sampleRateDefaults(currentConfig?.adapter).output);
    const frames = Math.max(1, Math.round((float32.length * ctx.sampleRate) / inputRate));
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const channel = buffer.getChannelData(0);
    const step = inputRate / ctx.sampleRate;
    for (let i = 0; i < frames; i++) {
      const pos = i * step;
      const idx = Math.floor(pos);
      const frac = pos - idx;
      const a = float32[idx] || 0;
      const b = float32[idx + 1] || a;
      channel[i] = a + (b - a) * frac;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(gainRef.current || ctx.destination);
    const startAt = Math.max(ctx.currentTime + 0.02, nextTimeRef.current);
    src.start(startAt);
    nextTimeRef.current = startAt + buffer.duration;
    sourcesRef.current.push(src);
    src.onended = () => {
      sourcesRef.current = sourcesRef.current.filter((s) => s !== src);
    };
  }

  async function startMic() {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (micStreamRef.current) return;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    micStreamRef.current = stream;
    const ctx = playCtxRef.current || new AudioContext();
    playCtxRef.current = ctx;
    await ctx.resume();
    const source = ctx.createMediaStreamSource(stream);
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    const silent = ctx.createGain();
    silent.gain.value = 0;
    const inputRate = ctx.sampleRate;
    const targetRate = testMode === "custom"
      ? (Number(customInRate) || sampleRateDefaults(customAdapter).input)
      : (currentConfig?.settings?.inputSampleRate || sampleRateDefaults(currentConfig?.adapter).input);
    processor.onaudioprocess = (event) => {
      const socket = wsRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      const channel = event.inputBuffer.getChannelData(0);
      const resampled = downsample(channel, inputRate, targetRate);
      socket.send(toInt16(resampled).buffer);
    };
    source.connect(processor);
    processor.connect(silent);
    silent.connect(ctx.destination);
    micCtxRef.current = ctx;
    processorRef.current = processor;
  }

  function stopMic() {
    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch {}
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
  }

  function teardown() {
    teardownPlayback();
    stopMic();
    if (levelTimerRef.current) clearInterval(levelTimerRef.current);
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    levelTimerRef.current = null;
    elapsedTimerRef.current = null;
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }
    if (playCtxRef.current) {
      try {
        playCtxRef.current.close();
      } catch {}
      playCtxRef.current = null;
    }
    setLevel(0);
    setElapsed(0);
    setInputMuted(false);
  }

  // Connect to live WebSocket session (either from Saved Config or Custom Testing)
  async function connect() {
    teardown();
    setTurns([]);
    setStatus("connecting");
    setStatusDetail("");
    setElapsed(0);

    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    let url = "";

    if (testMode === "custom") {
      const rateDefaults = sampleRateDefaults(customAdapter);
      const inRate = Number(customInRate) || rateDefaults.input;
      const outRate = Number(customOutRate) || rateDefaults.output;
      url = `${proto}://${window.location.host}/live?custom=1&adapter=${encodeURIComponent(customAdapter)}&model=${encodeURIComponent(customModel)}&wsBaseUrl=${encodeURIComponent(customWsUrl)}&credentialRef=${encodeURIComponent(customCred)}&voice=${encodeURIComponent(customVoice)}&systemPrompt=${encodeURIComponent(customPrompt)}&inRate=${inRate}&outRate=${outRate}&inMime=${encodeURIComponent(`audio/pcm;rate=${inRate}`)}&token=${encodeURIComponent(wsToken)}`;
      if (customHeaders.trim()) {
        url += `&headers=${encodeURIComponent(customHeaders.trim())}`;
      }
    } else {
      if (!selectedTarget && !currentConfig) {
        setStatus("error");
        setStatusDetail("Select a configuration or create one under Model & Endpoint.");
        return;
      }
      const targetName = currentCombo ? currentCombo.name : (currentConfig?.name || currentConfig?.id);
      url = `${proto}://${window.location.host}/v1/voice/${encodeURIComponent(targetName)}?token=${encodeURIComponent(wsToken)}`;
    }

    let ws;
    try {
      ws = new WebSocket(url);
    } catch (error) {
      setStatus("error");
      setStatusDetail(String(error && error.message ? error.message : error));
      return;
    }
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    const ctx = new AudioContext();
    playCtxRef.current = ctx;
    const gain = ctx.createGain();
    gain.gain.value = 1;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    gain.connect(analyser);
    analyser.connect(ctx.destination);
    gainRef.current = gain;
    analyserRef.current = analyser;
    const data = new Uint8Array(analyser.fftSize);

    levelTimerRef.current = setInterval(() => {
      const a = analyserRef.current;
      if (!a) return;
      a.getByteTimeDomainData(data);
      let peak = 0;
      for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i] - 128) / 128);
      setLevel(Math.round(peak * 100));
    }, 100);

    ws.onmessage = async (event) => {
      if (typeof event.data === "string") {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }
        if (msg.type === "status") {
          if (msg.state === "connected") {
            setStatus("connected");
            setStatusDetail("Live audio & text active");
            if (!elapsedTimerRef.current) {
              const started = Date.now();
              elapsedTimerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 500);
            }
            try {
              await startMic();
            } catch (error) {
              setStatusDetail("Microphone unavailable: " + String(error && error.message ? error.message : error));
            }
          } else if (msg.state === "disconnected") {
            setStatus("closed");
            setStatusDetail(msg.reason || "");
          } else {
            setStatus(msg.state);
          }
        } else if (msg.type === "ready") {
          setStatusDetail(`${msg.model} · ${msg.adapter}`);
        } else if (msg.type === "text") {
          appendTurn(
            msg.role === "user" ? "user" : msg.role === "system" ? "system" : "assistant",
            msg.text,
            msg.modality || (msg.role === "system" ? "system" : "voice")
          );
        } else if (msg.type === "interrupted") {
          teardownPlayback();
        } else if (msg.type === "inputGate") {
          setInputMuted(!!msg.muted);
        } else if (msg.type === "error") {
          setStatus("error");
          setStatusDetail(msg.message || msg.code || "Session error");
          appendTurn("system", msg.message || msg.code || "Session error", "system");
        }
      } else {
        playChunk(event.data);
      }
    };

    ws.onerror = () => {
      setStatus("error");
      setStatusDetail((prev) => prev || "WebSocket connection error");
    };
    ws.onclose = (event) => {
      stopMic();
      setStatus((prev) => (prev === "error" ? prev : "closed"));
      if (event.reason) setStatusDetail(String(event.reason));
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    };
  }

  function disconnect() {
    teardown();
    setStatus("idle");
    setStatusDetail("");
  }

  function interrupt() {
    teardownPlayback();
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "interrupt" }));
  }

  // Send text message while talking - works concurrently in parallel!
  function sendParallelText() {
    const ws = wsRef.current;
    const text = textInput.trim();
    if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "text", text }));
    appendTurn("user", text, "text");
    setTextInput("");
  }

  // Model & Endpoint tab: Credential change handler
  function handleConfigCredentialChange(configId, newCredentialRef) {
    const targetModels = getLiveModelsForCredential(newCredentialRef, providers);
    const firstModel = targetModels[0];
    if (firstModel) {
      const targetAdapter = firstModel.adapter || "gemini-live";
      const matchingPreset = DEFAULT_PRESETS[targetAdapter] || DEFAULT_PRESETS["gemini-live"];
      patchConfig(configId, {
        credentialRef: newCredentialRef,
        model: firstModel.id,
        adapter: targetAdapter,
        apiBaseUrl: matchingPreset.apiBaseUrl,
        wsBaseUrl: matchingPreset.wsBaseUrl,
        settings: {
          voice: firstModel.voice || matchingPreset.settings.voice,
          inputSampleRate: firstModel.inRate || matchingPreset.settings.inputSampleRate,
          outputSampleRate: firstModel.outRate || matchingPreset.settings.outputSampleRate,
          inputMimeType: `audio/pcm;rate=${firstModel.inRate || matchingPreset.settings.inputSampleRate}`,
        },
      });
    } else {
      patchConfig(configId, { credentialRef: newCredentialRef });
    }
  }

  // Model ID select handler in Model & Endpoint tab
  function handleConfigModelSelect(configId, selectedModelId, availableModels) {
    const chosen = availableModels.find((m) => m.id === selectedModelId);
    if (chosen) {
      const targetAdapter = chosen.adapter || "gemini-live";
      const matchingPreset = DEFAULT_PRESETS[targetAdapter] || DEFAULT_PRESETS["gemini-live"];
      patchConfig(configId, {
        model: chosen.id,
        adapter: targetAdapter,
        apiBaseUrl: matchingPreset.apiBaseUrl,
        wsBaseUrl: matchingPreset.wsBaseUrl,
        settings: {
          voice: chosen.voice || matchingPreset.settings.voice,
          inputSampleRate: chosen.inRate || matchingPreset.settings.inputSampleRate,
          outputSampleRate: chosen.outRate || matchingPreset.settings.outputSampleRate,
          inputMimeType: `audio/pcm;rate=${chosen.inRate || matchingPreset.settings.inputSampleRate}`,
        },
      });
    } else {
      patchConfig(configId, { model: selectedModelId });
    }
  }

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text-main">
            {tab === "testing" ? "Testing Connection" : tab === "docs" ? "API & Integration" : "Model & Endpoint"}
          </h1>
          <p className="text-sm text-text-muted">
            {tab === "testing"
              ? "Test live model WebSocket connections and verify voice + text simultaneously while talking with AI."
              : tab === "docs"
                ? "Connect your own app to the realtime voice gateway: endpoint, auth, wire protocol and code snippets."
                : "Create and manage dedicated live voice endpoints (/v1/voice/:name). Combine them in Combo & Vision Adapter."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant={tab === "testing" ? "primary" : "ghost"} size="sm" onClick={() => setTab("testing")}>
            Testing Connection
          </Button>
          <Button variant={tab === "endpoint" ? "primary" : "ghost"} size="sm" onClick={() => setTab("endpoint")}>
            Model &amp; Endpoint
          </Button>
          <Button variant={tab === "docs" ? "primary" : "ghost"} size="sm" onClick={() => setTab("docs")}>
            API &amp; Docs
          </Button>
        </div>
      </div>

      {notice && (
        <div className="text-sm px-4 py-3 rounded-[10px] bg-surface-2 border border-border-subtle text-text-main flex items-center justify-between gap-3">
          <span>{notice}</span>
          <button className="text-text-muted hover:text-text-main text-xs" onClick={() => setNotice("")}>
            dismiss
          </button>
        </div>
      )}

      {errorBanner && (
        <div className="text-sm px-4 py-3 rounded-[10px] bg-red-500/10 border border-red-500/30 text-red-500 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{errorBanner}</span>
          </div>
          <button className="text-red-400 hover:text-red-300 text-xs shrink-0" onClick={() => setErrorBanner("")}>
            dismiss
          </button>
        </div>
      )}

      {tab === "testing" ? (
        <div className="flex flex-col gap-5">
          {/* Sub-mode switcher inside Testing Connection */}
          <div className="flex items-center gap-2 p-1 rounded-[10px] bg-surface-2 border border-border-subtle w-fit">
            <button
              onClick={() => {
                disconnect();
                setTestMode("config");
              }}
              className={`px-3 py-1.5 text-xs rounded-[8px] font-medium transition-all ${
                testMode === "config" ? "bg-brand-500 text-white shadow-sm" : "text-text-muted hover:text-text-main"
              }`}
            >
              Configurations &amp; Combos Testing
            </button>
            <button
              onClick={() => {
                disconnect();
                setTestMode("custom");
              }}
              className={`px-3 py-1.5 text-xs rounded-[8px] font-medium transition-all ${
                testMode === "custom" ? "bg-brand-500 text-white shadow-sm" : "text-text-muted hover:text-text-main"
              }`}
            >
              Custom Testing (Talk Directly)
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-6">
            <div className="flex flex-col gap-6">
              <Card title={testMode === "config" ? "Configuration & Live Test" : "Custom Live Testing"} icon="settings_voice">
                <div className="flex flex-col gap-4">
                  {testMode === "config" ? (
                    <>
                      {/* Configuration or Combo selection */}
                      <Select
                        label="Select Configuration or Combo"
                        value={selectedTarget}
                        placeholder={configs.length === 0 ? "No configurations found" : "Select target"}
                        options={[
                          ...configs.map((c) => ({
                            value: c.name || c.id,
                            label: `[Config] ${c.name || c.id} (${c.model}) · ${c.adapter}`,
                          })),
                          ...combos.map((cb) => ({
                            value: cb.name,
                            label: `[Combo] 🔀 ${cb.name} (${cb.models?.length || 0} models)`,
                          })),
                        ]}
                        onChange={(e) => setSelectedTarget(e.target.value)}
                        disabled={active}
                      />

                      {/* Display dedicated URL with Copy button */}
                      {currentConfig && (
                        <div className="flex flex-col gap-1.5 p-3 rounded-[10px] bg-surface-2 border border-border-subtle">
                          <div className="flex items-center justify-between text-xs text-text-muted">
                            <span className="font-medium text-text-main">Dedicated Endpoint URL</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(`http://127.0.0.1:20128/v1/voice/${currentConfig.name || currentConfig.id}`, "target-url")}
                              className="text-brand-500 hover:text-brand-600 font-medium flex items-center gap-1 text-[11px]"
                            >
                              <span className="material-symbols-outlined text-[14px]">
                                {copiedKey === "target-url" ? "check" : "content_copy"}
                              </span>
                              <span>{copiedKey === "target-url" ? "Copied!" : "Copy URL"}</span>
                            </button>
                          </div>
                          <div className="font-mono text-xs text-text-main truncate">
                            http://127.0.0.1:20128/v1/voice/{currentConfig.name || currentConfig.id}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                        <span className="px-2 py-1 rounded-full bg-surface-2 border border-border-subtle font-mono">
                          {currentConfig?.adapter || "gemini-live"}
                        </span>
                        <span className="px-2 py-1 rounded-full bg-surface-2 border border-border-subtle">
                          voice: {currentConfig?.settings?.voice || "Kore"}
                        </span>
                        <span className="px-2 py-1 rounded-full bg-surface-2 border border-border-subtle">
                          {currentConfig?.settings?.inputSampleRate || sampleRateDefaults(currentConfig?.adapter).input}Hz in / {currentConfig?.settings?.outputSampleRate || sampleRateDefaults(currentConfig?.adapter).output}Hz out
                        </span>
                        <span className="px-2 py-1 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-500 font-medium">
                          ⚡ Voice + Text Parallel Active
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Custom Testing Form */}
                      <Select
                        label="Providers"
                        value={customCred}
                        options={getCredentialOptions(providers, customCred)}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCustomCred(val);
                          const models = getLiveModelsForCredential(val, providers);
                          const first = models[0];
                          if (first) {
                            const targetAdapter = first.adapter || "gemini-live";
                            const preset = DEFAULT_PRESETS[targetAdapter] || DEFAULT_PRESETS["gemini-live"];
                            setCustomModel(first.id);
                            setCustomAdapter(targetAdapter);
                            setCustomWsUrl(preset.wsBaseUrl);
                            setCustomVoice(first.voice || preset.settings.voice);
                            setCustomInRate("");
                            setCustomOutRate("");
                          } else {
                            setCustomModel("");
                          }
                        }}
                        disabled={active}
                      />

                      <div className="flex flex-col gap-1.5">
                        <Select
                          label="Model ID"
                          value={isCustomCustomModel ? "__custom__" : customModel}
                          placeholder={customLiveModels.length === 0 ? "Select or enter model" : "Select live model"}
                          options={[
                            ...customLiveModels.map((m) => ({
                              value: m.id,
                              label: m.label || m.id,
                            })),
                            { value: "__custom__", label: "Custom Model ID (manual entry)..." },
                          ]}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "__custom__") {
                              setCustomModelMode(true);
                              return;
                            }
                            setCustomModelMode(false);
                            const chosen = customLiveModels.find((m) => m.id === val);
                            setCustomModel(val);
                            if (chosen) {
                              const targetAdapter = chosen.adapter || "gemini-live";
                              const preset = DEFAULT_PRESETS[targetAdapter] || DEFAULT_PRESETS["gemini-live"];
                              setCustomAdapter(targetAdapter);
                              setCustomWsUrl(preset.wsBaseUrl);
                              setCustomVoice(chosen.voice || preset.settings.voice);
                              setCustomInRate("");
                              setCustomOutRate("");
                            }
                          }}
                          disabled={active}
                        />
                        {isCustomCustomModel && (
                          <Input
                            label="Custom Model ID"
                            placeholder="Enter custom model ID (e.g. claude-sonnet-4-20250514 or gemini-3.8-live)"
                            value={customModel}
                            onChange={(e) => setCustomModel(e.target.value)}
                            disabled={active}
                          />
                        )}
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <Select
                          label="Adapter / Protocol"
                          value={isCustomCustomAdapter ? "__custom__" : customAdapter}
                          options={[
                            ...STANDARD_ADAPTERS.map((a) => ({ value: a.id, label: a.label })),
                            { value: "__custom__", label: "Custom Adapter / Protocol (manual entry)..." },
                          ]}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "__custom__") {
                              setCustomAdapterMode(true);
                              return;
                            }
                            setCustomAdapterMode(false);
                            setCustomAdapter(val);
                            const preset = DEFAULT_PRESETS[val];
                            if (preset) {
                              setCustomWsUrl(preset.wsBaseUrl);
                              setCustomVoice(preset.settings.voice);
                            }
                          }}
                          disabled={active}
                        />
                        {isCustomCustomAdapter && (
                          <Input
                            label="Custom Adapter / Protocol"
                            placeholder="Enter custom adapter protocol (e.g. claude-bridge, custom-voice, generic-realtime)"
                            value={customAdapter}
                            onChange={(e) => setCustomAdapter(e.target.value)}
                            disabled={active}
                          />
                        )}
                      </div>

                      <div className="flex flex-col gap-1">
                        <Input
                          label="WebSocket URL"
                          value={customWsUrl}
                          onChange={(e) => setCustomWsUrl(e.target.value)}
                          placeholder="wss://..."
                          disabled={active}
                        />
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-xs">
                          <span className="text-text-muted text-[11px]">Presets:</span>
                          <button
                            type="button"
                            disabled={active}
                            onClick={() => {
                              setCustomAdapter("gemini-live");
                              setCustomWsUrl(DEFAULT_PRESETS["gemini-live"].wsBaseUrl);
                              setCustomModel("gemini-2.5-flash-native-audio-preview-12-2025");
                              setCustomVoice("Kore");
                              setCustomInRate("");
                              setCustomOutRate("");
                            }}
                            className="px-2 py-0.5 rounded bg-surface-2 border border-border-subtle hover:border-brand-500/40 text-[11px] font-mono text-text-muted hover:text-text-main"
                          >
                            Gemini Bidi
                          </button>
                          <button
                            type="button"
                            disabled={active}
                            onClick={() => {
                              setCustomAdapter("openai-realtime");
                              setCustomWsUrl(DEFAULT_PRESETS["openai-realtime"].wsBaseUrl);
                              setCustomModel("gpt-realtime-2.1");
                              setCustomVoice("alloy");
                              setCustomInRate("");
                              setCustomOutRate("");
                            }}
                            className="px-2 py-0.5 rounded bg-surface-2 border border-border-subtle hover:border-brand-500/40 text-[11px] font-mono text-text-muted hover:text-text-main"
                          >
                            OpenAI Realtime
                          </button>
                          <button
                            type="button"
                            disabled={active}
                            onClick={() => {
                              setCustomAdapter("openai-realtime");
                              setCustomWsUrl(DEFAULT_PRESETS["custom-live"].wsBaseUrl);
                              setCustomModel("custom-voice-model");
                              setCustomInRate("");
                              setCustomOutRate("");
                            }}
                            className="px-2 py-0.5 rounded bg-surface-2 border border-border-subtle hover:border-brand-500/40 text-[11px] font-mono text-text-muted hover:text-text-main"
                          >
                            Local Custom
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          label="Voice"
                          value={customVoice}
                          onChange={(e) => setCustomVoice(e.target.value)}
                          placeholder="alloy, Kore..."
                          disabled={active}
                        />
                        <Input
                          label="System Prompt (Optional)"
                          value={customPrompt}
                          onChange={(e) => setCustomPrompt(e.target.value)}
                          placeholder="You are a helpful live assistant"
                          disabled={active}
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between mb-0.5">
                          <label className="text-sm font-medium text-text-main">Custom Headers (Optional)</label>
                          <span className="text-[11px] text-text-muted">JSON or Key: Value per line</span>
                        </div>
                        <textarea
                          className="w-full min-h-[50px] font-mono px-3 py-2 text-xs bg-surface-2 border border-border-subtle rounded-[10px] focus:outline-none focus:ring-2 focus:ring-brand-500/30 text-text-main"
                          value={customHeaders}
                          onChange={(e) => setCustomHeaders(e.target.value)}
                          placeholder='e.g. { "X-Custom-Auth": "secret" } or X-Custom-Auth: secret'
                          disabled={active}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <Select
                          label="Input Sample Rate (Hz)"
                          value={customInRate || "default"}
                          options={[
                            { value: "default", label: `Default (${sampleRateDefaults(customAdapter).input} Hz)` },
                            ...SAMPLE_RATE_CHOICES.map((r) => ({ value: String(r), label: `${r} Hz` })),
                          ]}
                          onChange={(e) => setCustomInRate(e.target.value === "default" ? "" : e.target.value)}
                          disabled={active}
                        />
                        <Select
                          label="Output Sample Rate (Hz)"
                          value={customOutRate || "default"}
                          options={[
                            { value: "default", label: `Default (${sampleRateDefaults(customAdapter).output} Hz)` },
                            ...SAMPLE_RATE_CHOICES.map((r) => ({ value: String(r), label: `${r} Hz` })),
                          ]}
                          onChange={(e) => setCustomOutRate(e.target.value === "default" ? "" : e.target.value)}
                          disabled={active}
                        />
                      </div>
                    </>
                  )}

                  {/* Transport Controls */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border-subtle">
                    {!active ? (
                      <Button onClick={connect} icon="call">
                        Connect &amp; Talk
                      </Button>
                    ) : (
                      <Button variant="danger" onClick={disconnect} icon="call_end">
                        Disconnect
                      </Button>
                    )}
                    <Button variant="ghost" onClick={interrupt} icon="front_hand" disabled={status !== "connected"}>
                      Interrupt
                    </Button>
                    {testMode === "config" && currentConfig && (
                      <Button
                        variant="ghost"
                        onClick={() => testConfig(currentConfig)}
                        icon="network_check"
                        disabled={testing[currentConfig.id]?.running}
                      >
                        {testing[currentConfig.id]?.running ? "Testing…" : "Test connection"}
                      </Button>
                    )}
                  </div>

                  {/* Status & Audio Visualizer */}
                  <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-[10px] bg-surface-2 border border-border-subtle">
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-block w-2.5 h-2.5 rounded-full ${
                          status === "connected"
                            ? "bg-green-500 shadow-[0_0_8px_#22c55e]"
                            : status === "connecting"
                              ? "bg-amber-500 animate-pulse"
                              : status === "error"
                                ? "bg-red-500"
                                : "bg-text-muted/40"
                        }`}
                      />
                      <div>
                        <div className="text-sm font-medium text-text-main capitalize">{status}</div>
                        <div className="text-xs text-text-muted truncate max-w-[320px]">{statusDetail || "—"}</div>
                        {active && inputMuted && (
                          <div className="text-[11px] text-amber-500 font-medium">Mic muted — AI speaking (interruptions off)</div>
                        )}
                      </div>
                    </div>
                    <div className="text-sm tabular-nums text-text-muted font-mono font-medium">
                      {String(Math.floor(elapsed / 60)).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")}
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-text-muted mb-1">
                      <span>Audio Output / Speech Level</span>
                      <span>{level}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                      <div className="h-full bg-brand-500 transition-[width] duration-100" style={{ width: `${level}%` }} />
                    </div>
                  </div>
                </div>
              </Card>

              {/* Diagnostic Test Checks (if run) */}
              {testMode === "config" && currentConfig && testing[currentConfig.id]?.checks?.length > 0 && (
                <Card title="Connection test diagnostics" icon="fact_check">
                  <div className="flex flex-col gap-2">
                    {testing[currentConfig.id].checks.map((check) => (
                      <div key={check.id} className="flex items-start justify-between gap-4 text-sm">
                        <span className="text-text-main">{check.label}</span>
                        <span className={`text-right ${STATE_TONE[check.state] || "text-text-muted"}`}>
                          {check.state}
                          {check.detail ? <span className="block text-xs text-text-muted max-w-[320px]">{check.detail}</span> : null}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>

            {/* Transcript Card with Simultaneous Parallel Text Chat */}
            <Card title="Live Conversation (Voice + Parallel Text)" icon="subtitles" className="min-h-[480px] flex flex-col">
              <div className="flex-1 overflow-y-auto max-h-[440px] flex flex-col gap-3 pr-1">
                {turns.length === 0 && (
                  <div className="text-sm text-text-muted py-8 text-center flex flex-col items-center gap-2">
                    <span className="material-symbols-outlined text-[32px] text-text-muted/60">record_voice_over</span>
                    <span>No turns yet. Connect and speak into your mic, or type below.</span>
                    <span className="text-xs text-text-muted/80">Microphone speech and typed text operate concurrently in parallel!</span>
                  </div>
                )}
                {turns.map((turn, i) => (
                  <div
                    key={i}
                    className={`text-sm px-3 py-2.5 rounded-[10px] max-w-[85%] ${
                      turn.role === "user"
                        ? "self-end bg-brand-500/10 border border-brand-500/20"
                        : turn.role === "system"
                          ? "self-center bg-red-500/10 border border-red-500/20 text-red-500 text-xs"
                          : "self-start bg-surface-2 border border-border-subtle"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-text-muted mb-1 font-semibold">
                      <span>{turn.role}</span>
                      {turn.modality && (
                        <span className="px-1 py-0.2 rounded bg-black/10 dark:bg-white/10 text-[9px] font-mono">
                          {turn.modality}
                        </span>
                      )}
                    </div>
                    <div className="whitespace-pre-wrap text-text-main">{turn.text}</div>
                  </div>
                ))}
              </div>

              {/* Parallel Text Chat Input */}
              <div className="flex flex-col gap-1.5 mt-3 pt-3 border-t border-border-subtle">
                <div className="text-[11px] text-text-muted flex items-center justify-between">
                  <span>Send text in parallel while talking:</span>
                  <span className="text-brand-500 font-mono text-[10px]">Enter ↵ to send</span>
                </div>
                <div className="flex gap-2">
                  <input
                    className="flex-1 px-3 py-2.5 text-sm bg-surface-2 border border-border-subtle/60 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-brand-500/30 text-text-main"
                    placeholder="Type text message to test parallel input..."
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") sendParallelText();
                    }}
                    disabled={status !== "connected"}
                  />
                  <Button variant="primary" size="sm" onClick={sendParallelText} disabled={status !== "connected" || !textInput.trim()}>
                    Send Text
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      ) : tab === "docs" ? (
        <IntegrationDocs configs={configs} />
      ) : (
        /* Model & Endpoint Tab */
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-[12px] bg-surface-2 border border-border-subtle">
            <div>
              <h2 className="text-sm font-semibold text-text-main">Configurations &amp; Live Voice Endpoints</h2>
              <p className="text-xs text-text-muted mt-0.5">
                Every configuration generates a dedicated endpoint: <code className="font-mono text-brand-500">http://127.0.0.1:20128/v1/voice/:name</code>. You can group them in{" "}
                <Link className="underline text-brand-500 font-medium" href="/dashboard/combos">
                  Combo &amp; Vision Adapter
                </Link>{" "}
                for automatic routing &amp; failover.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => addPresetConfig("gemini-live")} icon="add">
                + Gemini Live
              </Button>
              <Button variant="secondary" size="sm" onClick={() => addPresetConfig("openai-realtime")} icon="add">
                + OpenAI Realtime
              </Button>
              <Button variant="secondary" size="sm" onClick={() => addPresetConfig("vertex-live")} icon="add">
                + Vertex AI Live
              </Button>
              <Button variant="secondary" size="sm" onClick={() => addPresetConfig("qwen-realtime")} icon="add">
                + Qwen Omni
              </Button>
              <Button variant="secondary" size="sm" onClick={() => addPresetConfig("custom-live")} icon="add">
                + Custom WebSocket
              </Button>
              <Button size="sm" onClick={saveConfigs} disabled={saving} icon="save">
                {saving ? "Verifying & Saving…" : "Save All"}
              </Button>
            </div>
          </div>

          {configs.length === 0 && (
            <Card>
              <div className="text-sm text-text-muted py-6 text-center">
                No configurations yet. Click one of the preset buttons above to create your first live voice endpoint.
              </div>
            </Card>
          )}

          {configs.map((config) => {
            const liveModelsForCred = getLiveModelsForCredential(config.credentialRef, providers);
            const isCustomModel = customModelActive[config.id] || !liveModelsForCred.some((m) => m.id === config.model);
            const isCustomAdapter = customAdapterActive[config.id] || !STANDARD_ADAPTERS.some((a) => a.id === config.adapter);
            const rateDefaults = sampleRateDefaults(config.adapter);
            const dedicatedUrl = `http://127.0.0.1:20128/v1/voice/${config.name || config.id}`;

            return (
              <Card key={config.id} title={`${config.providerName || "Configuration"} · ${config.name || config.id}`} icon="tune">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Configuration Name / Slug */}
                  <div className="flex flex-col gap-1.5">
                    <Input
                      label="Configuration Name / Slug"
                      value={config.name || ""}
                      onChange={(e) => patchConfig(config.id, { name: e.target.value })}
                      placeholder="e.g. testing, testing1, voice-assistant"
                    />
                    <div className="flex items-center justify-between text-xs text-text-muted px-1">
                      <span>Endpoint URL:</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(dedicatedUrl, `copy-${config.id}`)}
                        className="text-brand-500 hover:text-brand-600 font-mono text-[11px] flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[13px]">
                          {copiedKey === `copy-${config.id}` ? "check" : "content_copy"}
                        </span>
                        <span>{copiedKey === `copy-${config.id}` ? "Copied!" : "Copy URL"}</span>
                      </button>
                    </div>
                    <div className="font-mono text-xs px-2.5 py-1.5 rounded-[8px] bg-surface-2 border border-border-subtle text-text-main truncate">
                      {dedicatedUrl}
                    </div>
                  </div>

                  {/* Display Name */}
                  <Input
                    label="Display Name / Title"
                    value={config.providerName || ""}
                    onChange={(e) => patchConfig(config.id, { providerName: e.target.value })}
                    placeholder="e.g. Testing Assistant"
                  />

                  {/* Providers: ALL active 9Router provider connections */}
                  <Select
                    label="Providers"
                    value={config.credentialRef}
                    options={getCredentialOptions(providers, config.credentialRef)}
                    onChange={(e) => handleConfigCredentialChange(config.id, e.target.value)}
                  />

                  {/* Model ID dropdown tailored to credential source */}
                  <div className="flex flex-col gap-1.5">
                    <Select
                      label="Model ID (WebSocket Live Model)"
                      value={isCustomModel ? "__custom__" : config.model}
                      placeholder={liveModelsForCred.length === 0 ? "Select or enter model" : "Select live model"}
                      options={[
                        ...liveModelsForCred.map((m) => ({
                          value: m.id,
                          label: m.label || m.id,
                        })),
                        { value: "__custom__", label: "Custom Model ID (manual entry)..." },
                      ]}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "__custom__") {
                          setCustomModelActive((prev) => ({ ...prev, [config.id]: true }));
                        } else {
                          setCustomModelActive((prev) => ({ ...prev, [config.id]: false }));
                          handleConfigModelSelect(config.id, val, liveModelsForCred);
                        }
                      }}
                    />
                    {isCustomModel && (
                      <Input
                        label="Custom Model ID"
                        placeholder="Enter custom model ID (e.g. claude-sonnet-4-20250514 or gemini-3.8-live)"
                        value={config.model}
                        onChange={(e) => patchConfig(config.id, { model: e.target.value })}
                      />
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Select
                      label="Adapter / Protocol"
                      value={isCustomAdapter ? "__custom__" : config.adapter}
                      options={[
                        ...STANDARD_ADAPTERS.map((a) => ({ value: a.id, label: a.label })),
                        { value: "__custom__", label: "Custom Adapter / Protocol (manual entry)..." },
                      ]}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "__custom__") {
                          setCustomAdapterActive((prev) => ({ ...prev, [config.id]: true }));
                        } else {
                          setCustomAdapterActive((prev) => ({ ...prev, [config.id]: false }));
                          const preset = DEFAULT_PRESETS[val] || DEFAULT_PRESETS["gemini-live"];
                          patchConfig(config.id, {
                            adapter: val,
                            apiBaseUrl: preset.apiBaseUrl,
                            wsBaseUrl: preset.wsBaseUrl,
                            model: config.model || preset.model,
                            settings: {
                              voice: preset.settings.voice,
                              inputSampleRate: preset.settings.inputSampleRate,
                              outputSampleRate: preset.settings.outputSampleRate,
                              inputMimeType: preset.settings.inputMimeType,
                            },
                          });
                        }
                      }}
                    />
                    {isCustomAdapter && (
                      <Input
                        label="Custom Adapter / Protocol"
                        placeholder="Enter custom adapter protocol (e.g. claude-bridge, custom-voice, generic-realtime)"
                        value={config.adapter}
                        onChange={(e) => patchConfig(config.id, { adapter: e.target.value })}
                      />
                    )}
                  </div>

                  {/* WebSocket base URL with quick presets */}
                  <div className="flex flex-col gap-1">
                    <Input
                      label="WebSocket URL"
                      value={config.wsBaseUrl}
                      onChange={(e) => patchConfig(config.id, { wsBaseUrl: e.target.value })}
                      placeholder="wss://... or ws://..."
                    />
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-xs">
                      <span className="text-text-muted text-[11px]">Hardcoded Presets:</span>
                      <button
                        type="button"
                        onClick={() => {
                          const preset = DEFAULT_PRESETS["gemini-live"];
                          patchConfig(config.id, {
                            adapter: preset.adapter,
                            apiBaseUrl: preset.apiBaseUrl,
                            wsBaseUrl: preset.wsBaseUrl,
                            model: preset.model,
                            credentialRef: preset.credentialRef,
                            settings: {
                              voice: preset.settings.voice,
                              inputSampleRate: preset.settings.inputSampleRate,
                              outputSampleRate: preset.settings.outputSampleRate,
                              inputMimeType: preset.settings.inputMimeType,
                            },
                          });
                        }}
                        className="px-2 py-0.5 rounded bg-surface-2 border border-border-subtle hover:border-brand-500/40 text-[11px] font-mono text-text-muted hover:text-text-main"
                      >
                        Gemini Bidi
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const preset = DEFAULT_PRESETS["openai-realtime"];
                          patchConfig(config.id, {
                            adapter: preset.adapter,
                            apiBaseUrl: preset.apiBaseUrl,
                            wsBaseUrl: preset.wsBaseUrl,
                            model: preset.model,
                            credentialRef: preset.credentialRef,
                            settings: {
                              voice: preset.settings.voice,
                              inputSampleRate: preset.settings.inputSampleRate,
                              outputSampleRate: preset.settings.outputSampleRate,
                              inputMimeType: preset.settings.inputMimeType,
                            },
                          });
                        }}
                        className="px-2 py-0.5 rounded bg-surface-2 border border-border-subtle hover:border-brand-500/40 text-[11px] font-mono text-text-muted hover:text-text-main"
                      >
                        OpenAI Realtime
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const preset = DEFAULT_PRESETS["vertex-live"];
                          patchConfig(config.id, {
                            adapter: preset.adapter,
                            apiBaseUrl: preset.apiBaseUrl,
                            wsBaseUrl: preset.wsBaseUrl,
                            model: preset.model,
                            credentialRef: preset.credentialRef,
                            settings: {
                              voice: preset.settings.voice,
                              inputSampleRate: preset.settings.inputSampleRate,
                              outputSampleRate: preset.settings.outputSampleRate,
                              inputMimeType: preset.settings.inputMimeType,
                            },
                          });
                        }}
                        className="px-2 py-0.5 rounded bg-surface-2 border border-border-subtle hover:border-brand-500/40 text-[11px] font-mono text-text-muted hover:text-text-main"
                      >
                        Vertex Live
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const preset = DEFAULT_PRESETS["qwen-realtime"];
                          patchConfig(config.id, {
                            adapter: preset.adapter,
                            apiBaseUrl: preset.apiBaseUrl,
                            wsBaseUrl: preset.wsBaseUrl,
                            model: preset.model,
                            credentialRef: preset.credentialRef,
                            settings: {
                              voice: preset.settings.voice,
                              inputSampleRate: preset.settings.inputSampleRate,
                              outputSampleRate: preset.settings.outputSampleRate,
                              inputMimeType: preset.settings.inputMimeType,
                            },
                          });
                        }}
                        className="px-2 py-0.5 rounded bg-surface-2 border border-border-subtle hover:border-brand-500/40 text-[11px] font-mono text-text-muted hover:text-text-main"
                      >
                        Qwen Realtime
                      </button>
                    </div>
                  </div>

                  <Input
                    label="Voice"
                    value={config.settings?.voice || ""}
                    onChange={(e) => patchConfig(config.id, { settings: { voice: e.target.value } })}
                    placeholder={config.adapter === "openai-realtime" ? "alloy, ash, ballad, coral..." : "Kore, Puck, Fenrir..."}
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      label="Input Sample Rate (Hz)"
                      value={config.settings?.inputSampleRate ? String(config.settings.inputSampleRate) : "default"}
                      options={[
                        { value: "default", label: `Default (${rateDefaults.input} Hz)` },
                        ...SAMPLE_RATE_CHOICES.map((r) => ({ value: String(r), label: `${r} Hz` })),
                      ]}
                      onChange={(e) => {
                        const rate = e.target.value === "default" ? null : Number(e.target.value);
                        patchConfig(config.id, {
                          settings: {
                            inputSampleRate: rate,
                            inputMimeType: `audio/pcm;rate=${rate || rateDefaults.input}`,
                          },
                        });
                      }}
                    />
                    <Select
                      label="Output Sample Rate (Hz)"
                      value={config.settings?.outputSampleRate ? String(config.settings.outputSampleRate) : "default"}
                      options={[
                        { value: "default", label: `Default (${rateDefaults.output} Hz)` },
                        ...SAMPLE_RATE_CHOICES.map((r) => ({ value: String(r), label: `${r} Hz` })),
                      ]}
                      onChange={(e) => patchConfig(config.id, {
                        settings: { outputSampleRate: e.target.value === "default" ? null : Number(e.target.value) },
                      })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      label="Temperature"
                      type="number"
                      step="0.1"
                      value={config.settings?.temperature ?? ""}
                      onChange={(e) => patchConfig(config.id, { settings: { temperature: e.target.value === "" ? null : e.target.value } })}
                    />
                    <Input
                      label="Max Tokens"
                      type="number"
                      value={config.settings?.maxOutputTokens ?? ""}
                      onChange={(e) => patchConfig(config.id, { settings: { maxOutputTokens: e.target.value === "" ? null : e.target.value } })}
                    />
                  </div>

                  <div className="md:col-span-2 px-3 py-3 rounded-[10px] bg-surface-2 border border-border-subtle">
                    <Toggle
                      checked={config.settings?.interruptionEnabled !== false}
                      onChange={(v) => patchConfig(config.id, { settings: { interruptionEnabled: v } })}
                      label="Allow interruptions (barge-in)"
                      description={
                        config.settings?.interruptionEnabled !== false
                          ? "Enabled: your mic stays live while the model speaks, so you can interrupt it mid-turn."
                          : "Disabled: your mic is muted while the model speaks; audio is accepted again once it finishes."
                      }
                    />
                  </div>

                  <div className="md:col-span-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-sm font-medium text-text-main">Custom Headers (Optional)</label>
                      <span className="text-[11px] text-text-muted">JSON or Key: Value per line</span>
                    </div>
                    <textarea
                      className="w-full min-h-[56px] font-mono px-3 py-2 text-xs bg-surface-2 border border-transparent rounded-[10px] focus:outline-none focus:ring-2 focus:ring-brand-500/30 text-text-main"
                      value={
                        typeof config.headers === "object" && config.headers != null
                          ? Object.keys(config.headers).length === 0
                            ? ""
                            : JSON.stringify(config.headers, null, 2)
                          : (config.headers || "")
                      }
                      onChange={(e) => patchConfig(config.id, { headers: e.target.value })}
                      placeholder='e.g. { "X-Custom-Auth": "secret" } or X-Custom-Auth: secret'
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-text-main block mb-1.5">System Instruction</label>
                    <textarea
                      className="w-full min-h-[64px] px-3 py-2 text-sm bg-surface-2 border border-transparent rounded-[10px] focus:outline-none focus:ring-2 focus:ring-brand-500/30 text-text-main"
                      value={config.settings?.systemPrompt || ""}
                      onChange={(e) => patchConfig(config.id, { settings: { systemPrompt: e.target.value } })}
                      placeholder="Optional system instructions for this voice endpoint"
                    />
                  </div>

                  {/* API Fallback & Ranking (Multi-API Failover) Section */}
                  <div className="md:col-span-2 mt-2 pt-4 border-t border-border-subtle flex flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-brand-500 text-[18px]">swap_vert</span>
                          <h4 className="text-sm font-semibold text-text-main">Ranked Fallback APIs (Multi-API Failover)</h4>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-500 border border-brand-500/20 font-medium">
                            {(config.fallbacks?.length || 0) + 1} Total in Chain
                          </span>
                        </div>
                        <p className="text-xs text-text-muted mt-0.5">
                          If an API fails, 9Router automatically fails over down the ranked list. If all fail, it cycles back to Rank #1 before reporting full endpoint diagnostics.
                        </p>
                      </div>

                      {/* Quick add fallback buttons */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] text-text-muted font-medium">+ Fallback:</span>
                        <button
                          type="button"
                          onClick={() => addFallback(config.id, "gemini-live")}
                          className="px-2 py-1 rounded bg-surface-2 border border-border-subtle hover:border-brand-500/40 text-xs font-medium text-text-muted hover:text-text-main transition-colors"
                        >
                          + Gemini
                        </button>
                        <button
                          type="button"
                          onClick={() => addFallback(config.id, "openai-realtime")}
                          className="px-2 py-1 rounded bg-surface-2 border border-border-subtle hover:border-brand-500/40 text-xs font-medium text-text-muted hover:text-text-main transition-colors"
                        >
                          + OpenAI
                        </button>
                        <button
                          type="button"
                          onClick={() => addFallback(config.id, "qwen-realtime")}
                          className="px-2 py-1 rounded bg-surface-2 border border-border-subtle hover:border-brand-500/40 text-xs font-medium text-text-muted hover:text-text-main transition-colors"
                        >
                          + Qwen
                        </button>
                        <button
                          type="button"
                          onClick={() => addFallback(config.id, "vertex-live")}
                          className="px-2 py-1 rounded bg-surface-2 border border-border-subtle hover:border-brand-500/40 text-xs font-medium text-text-muted hover:text-text-main transition-colors"
                        >
                          + Vertex
                        </button>
                        <button
                          type="button"
                          onClick={() => addFallback(config.id, "custom-live")}
                          className="px-2 py-1 rounded bg-surface-2 border border-border-subtle hover:border-brand-500/40 text-xs font-medium text-text-muted hover:text-text-main transition-colors"
                        >
                          + Custom
                        </button>
                      </div>
                    </div>

                    {/* Rank #1 Card Summary */}
                    <div className="p-3 rounded-[10px] bg-brand-500/5 border border-brand-500/20 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5">
                        <span className="px-2 py-0.5 rounded bg-brand-500 text-white font-bold text-[11px] shadow-sm">
                          RANK #1 (PRIMARY)
                        </span>
                        <div className="flex flex-col">
                          <span className="font-medium text-text-main">{config.providerName || config.name || "Primary Live API"}</span>
                          <span className="text-[11px] text-text-muted font-mono">{config.model} · {config.adapter} · {config.credentialRef || "no credential"}</span>
                        </div>
                      </div>
                      {config.fallbacks?.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => moveFallbackUp(config.id, 0)}
                          icon="arrow_downward"
                        >
                          Demote to Rank #2
                        </Button>
                      )}
                    </div>

                    {/* Fallbacks List (Rank #2, Rank #3, ...) */}
                    {(!config.fallbacks || config.fallbacks.length === 0) ? (
                      <div className="text-xs text-text-muted italic px-3 py-2 rounded-[8px] bg-surface-2 border border-dashed border-border-subtle text-center">
                        No fallback APIs configured yet. Click a &quot;+ Fallback&quot; button above to add backup APIs with ranked priority.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {config.fallbacks.map((fb, fbIndex) => {
                          const fbModels = getLiveModelsForCredential(fb.credentialRef, providers);
                          const isCustomFbModel = customModelActive[fb.id] || !fbModels.some((m) => m.id === fb.model);
                          const isCustomFbAdapter = customAdapterActive[fb.id] || !STANDARD_ADAPTERS.some((a) => a.id === fb.adapter);

                          return (
                            <div key={fb.id} className="p-3.5 rounded-[10px] bg-surface-2 border border-border-subtle flex flex-col gap-3">
                              {/* Fallback Header & Ranking Controls */}
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle pb-2">
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 font-bold text-[11px]">
                                    RANK #{fbIndex + 2}
                                  </span>
                                  <input
                                    type="text"
                                    className="font-medium text-xs bg-transparent border-b border-transparent hover:border-border-subtle focus:border-brand-500 focus:outline-none text-text-main px-1"
                                    value={fb.name}
                                    onChange={(e) => patchFallback(config.id, fb.id, { name: e.target.value })}
                                    placeholder={`Fallback #${fbIndex + 2}`}
                                  />
                                </div>

                                {/* Ranking change buttons */}
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    title="Promote Rank (Move Up)"
                                    onClick={() => moveFallbackUp(config.id, fbIndex)}
                                    className="p-1 rounded hover:bg-surface-3 text-text-muted hover:text-text-main transition-colors flex items-center justify-center"
                                  >
                                    <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
                                  </button>
                                  <button
                                    type="button"
                                    title="Demote Rank (Move Down)"
                                    disabled={fbIndex === config.fallbacks.length - 1}
                                    onClick={() => moveFallbackDown(config.id, fbIndex)}
                                    className="p-1 rounded hover:bg-surface-3 text-text-muted hover:text-text-main transition-colors disabled:opacity-30 disabled:hover:bg-transparent flex items-center justify-center"
                                  >
                                    <span className="material-symbols-outlined text-[16px]">arrow_downward</span>
                                  </button>
                                  <button
                                    type="button"
                                    title="Remove Fallback"
                                    onClick={() => removeFallback(config.id, fb.id)}
                                    className="p-1 rounded hover:bg-red-500/10 text-text-muted hover:text-red-500 transition-colors flex items-center justify-center"
                                  >
                                    <span className="material-symbols-outlined text-[16px]">close</span>
                                  </button>
                                </div>
                              </div>

                              {/* Fallback Fields */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <Select
                                  label="Providers"
                                  value={fb.credentialRef}
                                  options={getCredentialOptions(providers, fb.credentialRef)}
                                  onChange={(e) => {
                                    const newCred = e.target.value;
                                    const models = getLiveModelsForCredential(newCred, providers);
                                    const first = models[0];
                                    patchFallback(config.id, fb.id, {
                                      credentialRef: newCred,
                                      ...(first
                                        ? {
                                            model: first.id,
                                            adapter: first.adapter || "openai-realtime",
                                            wsBaseUrl: DEFAULT_PRESETS[first.adapter || "openai-realtime"]?.wsBaseUrl || fb.wsBaseUrl,
                                          }
                                        : {}),
                                    });
                                  }}
                                />

                                <div className="flex flex-col gap-1.5">
                                  <Select
                                    label="Model ID"
                                    value={isCustomFbModel ? "__custom__" : fb.model}
                                    placeholder="Select live model"
                                    options={[
                                      ...fbModels.map((m) => ({ value: m.id, label: m.label || m.id })),
                                      { value: "__custom__", label: "Custom Model ID (manual entry)..." },
                                    ]}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (val === "__custom__") {
                                        setCustomModelActive((prev) => ({ ...prev, [fb.id]: true }));
                                      } else {
                                        setCustomModelActive((prev) => ({ ...prev, [fb.id]: false }));
                                        const chosen = fbModels.find((m) => m.id === val);
                                        patchFallback(config.id, fb.id, {
                                          model: val,
                                          ...(chosen?.adapter ? { adapter: chosen.adapter } : {}),
                                        });
                                      }
                                    }}
                                  />
                                  {isCustomFbModel && (
                                    <Input
                                      label="Custom Model ID"
                                      placeholder="e.g. gpt-realtime-2.1 or claude-sonnet-4-20250514"
                                      value={fb.model}
                                      onChange={(e) => patchFallback(config.id, fb.id, { model: e.target.value })}
                                    />
                                  )}
                                </div>

                                <div className="flex flex-col gap-1.5">
                                  <Select
                                    label="Adapter / Protocol"
                                    value={isCustomFbAdapter ? "__custom__" : fb.adapter}
                                    options={[
                                      ...STANDARD_ADAPTERS.map((a) => ({ value: a.id, label: a.label })),
                                      { value: "__custom__", label: "Custom Adapter / Protocol (manual entry)..." },
                                    ]}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (val === "__custom__") {
                                        setCustomAdapterActive((prev) => ({ ...prev, [fb.id]: true }));
                                      } else {
                                        setCustomAdapterActive((prev) => ({ ...prev, [fb.id]: false }));
                                        const preset = DEFAULT_PRESETS[val];
                                        patchFallback(config.id, fb.id, {
                                          adapter: val,
                                          ...(preset ? { wsBaseUrl: preset.wsBaseUrl, apiBaseUrl: preset.apiBaseUrl } : {}),
                                        });
                                      }
                                    }}
                                  />
                                  {isCustomFbAdapter && (
                                    <Input
                                      label="Custom Adapter / Protocol"
                                      placeholder="e.g. claude-bridge, custom-voice"
                                      value={fb.adapter}
                                      onChange={(e) => patchFallback(config.id, fb.id, { adapter: e.target.value })}
                                    />
                                  )}
                                </div>

                                <Input
                                  label="WebSocket URL"
                                  value={fb.wsBaseUrl}
                                  onChange={(e) => patchFallback(config.id, fb.id, { wsBaseUrl: e.target.value })}
                                  placeholder="wss://..."
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-border-subtle">
                  <div className="flex items-center gap-2 text-xs text-text-muted">
                    <span>ID: {config.id}</span>
                    <span>·</span>
                    <span className={config.verified ? "text-green-500 font-medium" : "text-amber-500"}>
                      {config.verified ? "✅ WebSocket Verified" : "⚠️ Needs Verification"}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setDefaultId(config.id)} disabled={defaultId === config.id}>
                      {defaultId === config.id ? "Default" : "Set Default"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => testConfig(config)} disabled={testing[config.id]?.running} icon="network_check">
                      {testing[config.id]?.running ? "Testing…" : "Test WebSocket"}
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => removeConfig(config.id)} icon="delete">
                      Remove
                    </Button>
                  </div>
                </div>

                {testing[config.id]?.checks?.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border-subtle flex flex-col gap-1.5">
                    {testing[config.id].checks.map((check) => (
                      <div key={check.id} className="flex items-start justify-between gap-4 text-xs">
                        <span className="text-text-main">{check.label}</span>
                        <span className={`text-right ${STATE_TONE[check.state] || "text-text-muted"}`}>
                          {check.state}
                          {check.detail ? <span className="block text-text-muted max-w-[360px]">{check.detail}</span> : null}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
