import { NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/localDb";
import { getCombos } from "@/models";
import {
  ADAPTERS,
  availableCredentialProviders,
  discoverLiveModels,
  liveWsToken,
  normalizeConfig,
  validateConfig,
  testLiveConfiguration,
} from "@/lib/live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let settings = {};
  try {
    settings = await getSettings();
  } catch {}
  const raw = (settings && settings.liveCommunication) || {};
  const configs = (Array.isArray(raw.configs) ? raw.configs : []).map((c) => normalizeConfig(c));

  let combos = [];
  try {
    combos = await getCombos();
  } catch {}

  return NextResponse.json({
    configs,
    combos: (combos || []).map((c) => ({ id: c.id, name: c.name, models: c.models })),
    defaultId: raw.defaultId || (configs[0] ? configs[0].id : ""),
    adapters: ADAPTERS,
    credentials: await availableCredentialProviders(),
    models: await discoverLiveModels(),
    wsToken: liveWsToken(),
  });
}

export async function PUT(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const incoming = Array.isArray(body.configs) ? body.configs.slice(0, 25) : null;
  if (!incoming) return NextResponse.json({ error: "configs[] is required." }, { status: 400 });

  const seenIds = new Set();
  const seenNames = new Set();
  const configs = [];

  for (const item of incoming) {
    const { config, errors } = validateConfig(item);
    if (errors.length) {
      return NextResponse.json({ error: `Configuration "${item.name || item.id}": ${errors.join(" ")}` }, { status: 400 });
    }

    const id = config.id || "live-" + Math.random().toString(36).slice(2, 10);
    const name = config.name || "testing";

    if (seenIds.has(id)) return NextResponse.json({ error: `Duplicate configuration ID "${id}".` }, { status: 400 });
    if (seenNames.has(name)) return NextResponse.json({ error: `Duplicate configuration name "${name}". Each configuration must have a unique name.` }, { status: 400 });

    seenIds.add(id);
    seenNames.add(name);

    // If enforceWsValidation is requested or config not yet verified, check if connection is valid
    if (body.validateWs) {
      const probe = await testLiveConfiguration(config);
      if (!probe.verified) {
        return NextResponse.json(
          {
            error: `Configuration "${name}" failed WebSocket verification: ${probe.reason || "Unable to establish native audio WebSocket session."}`,
            checks: probe.checks,
          },
          { status: 400 }
        );
      }
      config.verified = true;
      config.checkedAt = new Date().toISOString();
      config.checks = probe.checks;
    }

    configs.push({ ...config, id, name });
  }

  const defaultId = configs.some((c) => c.id === body.defaultId || c.name === body.defaultId)
    ? body.defaultId
    : configs[0]
      ? configs[0].id
      : "";

  await updateSettings({ liveCommunication: { configs, defaultId } });
  return NextResponse.json({ configs, defaultId, saved: true });
}
