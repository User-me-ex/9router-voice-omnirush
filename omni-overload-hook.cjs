"use strict";

/**
 * OmniRush overload auto-retry for 9router.
 *
 * OmniRush reports upstream overload as assistant *text* on an HTTP 200 stream
 * ("[Error] Our servers are currently overloaded. Please try again later")
 * instead of an error status. Clients (Amoeba, Claude Code, etc.) treat that
 * text as the model's answer and stop working.
 *
 * Two failure shapes are handled:
 *
 *  1. Overload before any output (stream starts with the notice)
 *     -> the turn is retried before a single event is forwarded; if the retry
 *        budget is spent, a real HTTP 503 is returned so combo fallback can
 *        move to another model.
 *
 *  2. Overload mid-stream (real text was already forwarded)
 *     -> the notice is suppressed, the upstream stream is cancelled, and a
 *        continuation request is issued with the partial assistant output plus
 *        a "continue" user nudge. The continuation's text deltas are spliced
 *        into the *same* SSE response, so the client sees one uninterrupted
 *        answer and never has to restart the turn.
 *
 * Configuration (env):
 *   OMNIRUSH_OVERLOAD_RETRIES      default 6
 *   OMNIRUSH_OVERLOAD_DELAY_MS     default 2500 (base, doubled per attempt)
 *   OMNIRUSH_OVERLOAD_MAX_DELAY_MS default 30000
 *   OMNIRUSH_HOOK_HOSTS            default "omnirush.ai" (comma separated, for tests)
 *   OMNIRUSH_HOOK_DEBUG=1          verbose logging
 *   OMNIRUSH_HOOK_STATE            state file path
 */

const ORIGINAL_FETCH = globalThis.fetch;
const fs = require("fs");
const path = require("path");

const PATTERNS = [
  "our servers are currently overloaded",
  "servers are currently overloaded",
  "server is currently overloaded",
  "currently overloaded, please try again",
  "currently overloaded. please try again",
];
const PATTERNS_LOWER = PATTERNS.map((p) => p.toLowerCase());
// Full notices as they may be split across deltas, including the client-facing lead.
const NOTICE_CANDIDATES = PATTERNS_LOWER.flatMap((p) => ["", "[error] ", "[error]", "error: ", "error "].map((lead) => lead + p));
const MAX_NOTICE_LEN = Math.max(...NOTICE_CANDIDATES.map((c) => c.length));

const RESUME_PROMPT = "continue";
const HOLD_MIN = 16;
const MAX_PEEK_BYTES = 32 * 1024;
const ERROR_LEAD_RE = /[\[(]?\s*error\s*[\])]?\s*:?\s*$/i;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function envInt(name, fallback) {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw >= 0 ? raw : fallback;
}

const RETRIES = envInt("OMNIRUSH_OVERLOAD_RETRIES", 6);
const BASE_DELAY_MS = envInt("OMNIRUSH_OVERLOAD_DELAY_MS", 2500);
const MAX_DELAY_MS = envInt("OMNIRUSH_OVERLOAD_MAX_DELAY_MS", 30000);
const DEBUG = process.env.OMNIRUSH_HOOK_DEBUG === "1";
const HOSTS = String(process.env.OMNIRUSH_HOOK_HOSTS || "omnirush.ai")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const stats = {
  requests: 0,
  overloads: 0,
  retries: 0,
  resumes: 0,
  continuations: 0,
  exhausted: 0,
  recovered: 0,
};

const STATE_FILE = process.env.OMNIRUSH_HOOK_STATE || path.join(__dirname, "omni-hook.state.json");
let lastStateWrite = 0;

function log(...args) {
  if (DEBUG) console.warn("[omni-hook]", ...args);
}

function writeState(force = false) {
  const now = Date.now();
  if (!force && now - lastStateWrite < 500) return;
  lastStateWrite = now;
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({ pid: process.pid, updatedAt: new Date(now).toISOString(), stats }, null, 2));
  } catch {
    /* ignore */
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function targetUrl(input) {
  try {
    if (typeof input === "string") return new URL(input);
    if (input && typeof input.url === "string") return new URL(input.url);
    return null;
  } catch {
    return null;
  }
}

function shouldHook(url) {
  if (!url) return false;
  const host = url.host.toLowerCase();
  const hostMatch = HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  if (!hostMatch) return false;
  return url.pathname.includes("/responses");
}

function matchOverload(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const pattern of PATTERNS) {
    if (lower.includes(pattern)) return pattern;
  }
  return null;
}

function stripErrorLead(text) {
  return text.replace(ERROR_LEAD_RE, "");
}

function collectText(node) {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(collectText).join("");
  if (typeof node !== "object") return "";
  let out = "";
  for (const key of ["text", "delta", "content", "output_text", "value"]) {
    const value = node[key];
    if (typeof value === "string") out += value;
    else if (value && typeof value === "object") out += collectText(value);
  }
  return out;
}

function parseEvent(raw) {
  let type = null;
  const dataLines = [];
  for (const line of raw.split("\n")) {
    if (line.startsWith("event:")) type = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
  }
  const dataRaw = dataLines.join("\n");
  if (dataRaw && dataRaw !== "[DONE]") {
    try {
      return { type: type || null, data: JSON.parse(dataRaw), dataRaw };
    } catch {
      /* not JSON */
    }
  }
  return { type, data: null, dataRaw };
}

function eventBoundary(buffer) {
  const a = buffer.indexOf("\n\n");
  const b = buffer.indexOf("\r\n\r\n");
  if (a === -1 && b === -1) return null;
  if (a === -1) return { start: b, end: b + 4 };
  if (b === -1) return { start: a, end: a + 2 };
  return a < b ? { start: a, end: a + 2 } : { start: b, end: b + 4 };
}

function sanitizeHeaders(headers) {
  const copy = new Headers(headers);
  copy.delete("content-encoding");
  copy.delete("content-length");
  return copy;
}

function emitRaw(controller, raw) {
  controller.enqueue(encoder.encode(`${raw}\n\n`));
}

function emitDelta(controller, text) {
  if (!text) return;
  controller.enqueue(
    encoder.encode(`event: response.output_text.delta\ndata: ${JSON.stringify({ type: "response.output_text.delta", delta: text })}\n\n`)
  );
}

function emitCompleted(controller, ctx) {
  const payload = {
    type: "response.completed",
    response: {
      id: ctx.responseId || `resp_${Date.now()}`,
      object: "response",
      created_at: Math.floor(Date.now() / 1000),
      status: "completed",
      output: [],
    },
  };
  controller.enqueue(encoder.encode(`event: response.completed\ndata: ${JSON.stringify(payload)}\n\n`));
}

function flushHold(controller, ctx) {
  if (!ctx.hold) return;
  const text = stripErrorLead(ctx.hold);
  ctx.hold = "";
  if (text) {
    ctx.partial += text;
    emitDelta(controller, text);
  }
}

// Split incoming text into "safe to forward" and "hold back" so a notice that is
// split across deltas (e.g. "...Our serv" + "ers are currently overloaded...")
// is still detected before any of it reaches the client.
function splitText(text) {
  const lower = text.toLowerCase();
  let hold = Math.min(HOLD_MIN, text.length);
  const window = Math.min(text.length, MAX_NOTICE_LEN - 1);
  for (let n = window; n > hold; n--) {
    const suffix = lower.slice(lower.length - n);
    if (NOTICE_CANDIDATES.some((candidate) => candidate.startsWith(suffix))) {
      hold = n;
      break;
    }
  }
  return [text.slice(0, text.length - hold), text.slice(text.length - hold)];
}

// Returns true when the text contained the overload notice.
function pushText(controller, ctx, text) {
  const combined = ctx.hold + text;
  const hit = matchOverload(combined);
  if (hit) {
    const at = combined.toLowerCase().indexOf(hit);
    const before = stripErrorLead(combined.slice(0, at));
    ctx.hold = "";
    if (before) {
      ctx.partial += before;
      emitDelta(controller, before);
    }
    return true;
  }

  const [release, hold] = splitText(combined);
  ctx.hold = hold;
  if (release) {
    ctx.partial += release;
    emitDelta(controller, release);
  }
  return false;
}

// Consume one upstream SSE stream, forwarding events and splicing nothing.
// Returns "done" | "overload" | "eof" | "cancelled".
async function consume(reader, controller, ctx) {
  let buffer = "";
  try {
    for (;;) {
      if (ctx.cancelled || ctx.signal?.aborted) return "cancelled";
      const { done, value } = await reader.read();
      if (done) break;
      if (value && value.length) buffer += decoder.decode(value, { stream: true });

      let boundary;
      while ((boundary = eventBoundary(buffer))) {
        const raw = buffer.slice(0, boundary.start);
        buffer = buffer.slice(boundary.end);
        const outcome = handleEvent(controller, raw, ctx);
        if (outcome === "overload" || outcome === "done") return outcome;
      }
    }

    if (buffer.trim()) {
      const outcome = handleEvent(controller, buffer, ctx);
      if (outcome === "overload" || outcome === "done") return outcome;
    }
    flushHold(controller, ctx);
    return "eof";
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* ignore */
    }
  }
}

function handleEvent(controller, raw, ctx) {
  const parsed = parseEvent(raw);
  const type = parsed.type || (parsed.data && parsed.data.type) || null;

  if (!type && parsed.dataRaw === "[DONE]") {
    emitRaw(controller, raw);
    return "raw";
  }

  if (type === "response.output_text.delta") {
    const delta = (parsed.data && parsed.data.delta) || "";
    if (!delta) return "skip";
    if (parsed.data && parsed.data.response_id) ctx.responseId = parsed.data.response_id;
    return pushText(controller, ctx, delta) ? "overload" : "raw";
  }

  if (type === "response.output_text.done" || type === "response.content_part.done") {
    return "skip";
  }

  if (type === "response.created" || type === "response.in_progress") {
    if (parsed.data && parsed.data.response && parsed.data.response.id) ctx.responseId = parsed.data.response.id;
    if (ctx.continuing) return "skip";
    emitRaw(controller, raw);
    return "raw";
  }

  if (type === "error" || type === "response.failed") {
    if (matchOverload(JSON.stringify(parsed.data || {}))) return "overload";
    flushHold(controller, ctx);
    emitRaw(controller, raw);
    ctx.terminalForwarded = true;
    return "done";
  }

  if (type === "response.completed" || type === "response.done") {
    if (matchOverload(collectText(parsed.data && parsed.data.response ? parsed.data.response.output : parsed.data))) {
      return "overload";
    }
    flushHold(controller, ctx);
    emitRaw(controller, raw);
    ctx.terminalForwarded = true;
    return "done";
  }

  emitRaw(controller, raw);
  return "raw";
}

function overloadResponse(pattern, attempts) {
  return new Response(
    JSON.stringify({
      error: {
        message: `OmniRush upstream overloaded after ${attempts} retries: ${pattern}`,
        type: "service_unavailable",
        code: "omnirush_overloaded",
      },
    }),
    { status: 503, statusText: "Service Unavailable", headers: { "content-type": "application/json" } }
  );
}

function withResume(body, partial) {
  const text = String(partial || "").trim();
  if (!text) return body;
  if (!body || typeof body !== "object") return body;

  if (Array.isArray(body.input)) {
    return {
      ...body,
      input: [
        ...body.input,
        { role: "assistant", content: [{ type: "output_text", text }] },
        { role: "user", content: [{ type: "input_text", text: RESUME_PROMPT }] },
      ],
    };
  }
  if (typeof body.input === "string") {
    return {
      ...body,
      input: [
        { role: "user", content: [{ type: "input_text", text: body.input }] },
        { role: "assistant", content: [{ type: "output_text", text }] },
        { role: "user", content: [{ type: "input_text", text: RESUME_PROMPT }] },
      ],
    };
  }
  if (Array.isArray(body.messages)) {
    return {
      ...body,
      messages: [...body.messages, { role: "assistant", content: text }, { role: "user", content: RESUME_PROMPT }],
    };
  }
  return body;
}

// Peek the start of a response: detect an immediate overload (retry before
// forwarding anything) or the first real text (hand off to streaming).
async function peekStart(response, signal) {
  if (!response || !response.ok || !response.body) return { matched: null, chunks: [], reader: null };
  const reader = response.body.getReader();
  const chunks = [];
  let text = "";
  let bytes = 0;
  let matched = null;
  let sawText = false;

  try {
    while (bytes < MAX_PEEK_BYTES) {
      if (signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      if (value && value.length) {
        chunks.push(value);
        bytes += value.length;
        text += decoder.decode(value, { stream: true });
      }
      matched = matchOverload(text);
      if (matched) break;
      if (/"type"\s*:\s*"response\.output_text\.delta"/.test(text)) {
        sawText = true;
        break;
      }
    }
  } catch {
    /* fall through */
  }

  if (matched) {
    try {
      await reader.cancel();
    } catch {
      /* ignore */
    }
    return { matched, chunks: [], reader: null };
  }
  return { matched: null, chunks, reader };
}

function chainStream(prefixChunks, reader) {
  return new ReadableStream({
    start(controller) {
      for (const chunk of prefixChunks) {
        try {
          controller.enqueue(chunk);
        } catch {
          return;
        }
      }
      (async () => {
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
          controller.close();
        } catch (error) {
          try {
            controller.error(error);
          } catch {
            /* ignore */
          }
        }
      })();
    },
    cancel(reason) {
      return reader.cancel(reason).catch(() => {});
    },
  });
}

function finalize(controller, ctx) {
  flushHold(controller, ctx);
  if (!ctx.terminalForwarded) {
    emitCompleted(controller, ctx);
    ctx.terminalForwarded = true;
  }
}

async function pump(response, prefixChunks, reader, controller, ctx) {
  let current = response;
  let stream = prefixChunks.length ? chainStream(prefixChunks, reader) : current.body;

  for (;;) {
    const streamReader = stream.getReader();
    ctx.activeReader = streamReader;
    const outcome = await consume(streamReader, controller, ctx);

    if (outcome === "cancelled") return;
    if (outcome === "done") return;

    if (outcome !== "overload") {
      finalize(controller, ctx);
      return;
    }

    stats.overloads++;
    writeState();

    if (ctx.attempt >= RETRIES || !ctx.replayable) {
      stats.exhausted++;
      writeState();
      log(`overload with no budget left (attempt ${ctx.attempt}/${RETRIES}) -> ending stream`);
      finalize(controller, ctx);
      return;
    }

    ctx.attempt++;
    stats.retries++;
    ctx.continuing = true;

    if (ctx.partial.trim().length > 0) {
      ctx.body = withResume(ctx.baseBody, ctx.partial);
      stats.resumes++;
      log(`splicing continuation with ${ctx.partial.length} chars of partial output`);
    } else {
      ctx.body = ctx.baseBody;
      log("retrying turn (no partial output yet)");
    }

    const delay = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** (ctx.attempt - 1));
    log(`retry ${ctx.attempt}/${RETRIES} in ${delay}ms`);
    await sleep(delay);

    if (ctx.cancelled || ctx.signal?.aborted) return;

    try {
      current = await ORIGINAL_FETCH(ctx.input, { ...ctx.init, body: JSON.stringify(ctx.body) });
    } catch (error) {
      log(`continuation fetch failed: ${error && error.message}`);
      finalize(controller, ctx);
      return;
    }

    if (!current.ok || !current.body) {
      log(`continuation returned ${current.status} - ending stream`);
      finalize(controller, ctx);
      return;
    }

    stats.continuations++;
    writeState();
    stream = current.body;
  }
}

async function hookedFetch(input, init) {
  const url = targetUrl(input);
  if (!shouldHook(url)) return ORIGINAL_FETCH(input, init);

  stats.requests++;
  writeState();

  const signal = init?.signal;
  if (typeof init?.body !== "string") return ORIGINAL_FETCH(input, init);

  let baseBody;
  try {
    baseBody = JSON.parse(init.body);
  } catch {
    return ORIGINAL_FETCH(input, init);
  }

  if (process.env.OMNI_DUMP === "1") {
    try {
      fs.appendFileSync(
        path.join(__dirname, "omni-dump.jsonl"),
        JSON.stringify({ at: new Date().toISOString(), url, body: baseBody }) + "\n"
      );
    } catch {}
  }


  // Pre-content phase: retry before anything is forwarded so a 503 can still
  // drive combo fallback.
  let attempt = 0;
  let response;
  let peek;
  for (;;) {
    response = await ORIGINAL_FETCH(input, init);
    peek = await peekStart(response, signal);
    if (!peek.matched) break;

    stats.overloads++;
    writeState();

    if (attempt >= RETRIES) {
      stats.exhausted++;
      writeState();
      return overloadResponse(peek.matched, attempt);
    }
    attempt++;
    stats.retries++;
    const delay = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** (attempt - 1));
    log(`overload before output ("${peek.matched}") - retry ${attempt}/${RETRIES} in ${delay}ms`);
    await sleep(delay);
    if (signal?.aborted) throw signal.reason || new Error("aborted");
  }

  if (!response.ok || !response.body) return response;

  const ctx = {
    input,
    init,
    baseBody,
    body: baseBody,
    partial: "",
    hold: "",
    attempt,
    continuing: attempt > 0,
    replayable: true,
    responseId: null,
    terminalForwarded: false,
    cancelled: false,
    signal,
  };

  const body = new ReadableStream({
    start(controller) {
      pump(response, peek.chunks, peek.reader, controller, ctx)
        .then(() => {
          try {
            controller.close();
          } catch {
            /* ignore */
          }
        })
        .catch((error) => {
          try {
            controller.error(error);
          } catch {
            /* ignore */
          }
        });
    },
    cancel(reason) {
      ctx.cancelled = true;
      try {
        if (ctx.activeReader) ctx.activeReader.cancel(reason);
        else if (peek.reader) peek.reader.cancel(reason);
      } catch {
        /* ignore */
      }
    },
  });

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: sanitizeHeaders(response.headers),
  });
}

if (typeof ORIGINAL_FETCH === "function") {
  globalThis.fetch = hookedFetch;
  globalThis.__omniOverloadHook = {
    stats,
    config: { RETRIES, BASE_DELAY_MS, MAX_DELAY_MS, HOSTS, PATTERNS },
    active: true,
  };
  console.log(`[omni-hook] installed (hosts=${HOSTS.join(",")}, retries=${RETRIES})`);
  writeState(true);
} else {
  console.warn("[omni-hook] global fetch not found - hook disabled");
}




