import { NextResponse } from "next/server";
import { getSettings } from "@/lib/localDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request, context) {
  const { params } = context;
  const slug = (await params)?.slug || [];
  const host = request.headers.get("host") || "127.0.0.1:20128";
  const protocol = request.headers.get("x-forwarded-proto") === "https" ? "https" : "http";
  const wsProtocol = protocol === "https" ? "wss" : "ws";

  let settings = {};
  try {
    settings = await getSettings();
  } catch {}

  const live = settings?.liveCommunication || {};
  const configs = Array.isArray(live.configs) ? live.configs : [];
  const groups = Array.isArray(live.groups) ? live.groups : [];

  if (slug.length >= 2 && slug[0] === "group") {
    const groupName = decodeURIComponent(slug.slice(1).join("/"));
    const group = groups.find((g) => g.name === groupName || g.id === groupName);
    if (!group) {
      return NextResponse.json(
        {
          error: `Voice routing group "${groupName}" not found.`,
          availableGroups: groups.map((g) => g.name || g.id),
        },
        { status: 404 }
      );
    }

    const memberConfigs = configs.filter((c) => (group.configNames || []).includes(c.name) || (group.configIds || []).includes(c.id));
    return NextResponse.json({
      type: "voice_routing_group",
      name: group.name,
      strategy: group.strategy || "fallback",
      websocketUrl: `${wsProtocol}://${host}/v1/voice/group/${encodeURIComponent(group.name)}`,
      httpUrl: `${protocol}://${host}/v1/voice/group/${encodeURIComponent(group.name)}`,
      configurations: memberConfigs.map((c) => ({
        name: c.name || c.id,
        model: c.model,
        adapter: c.adapter,
        verified: !!c.verified,
      })),
      updatedAt: group.updatedAt || null,
    });
  }

  const endpointName = decodeURIComponent(slug.join("/"));
  const config = configs.find((c) => c.name === endpointName || c.id === endpointName);

  if (!config) {
    return NextResponse.json(
      {
        error: `Voice endpoint "${endpointName}" not found.`,
        availableEndpoints: configs.map((c) => c.name || c.id),
        availableGroups: groups.map((g) => g.name || g.id),
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    type: "voice_endpoint",
    name: config.name || config.id,
    model: config.model,
    adapter: config.adapter,
    status: config.verified ? "verified" : "configured",
    websocketUrl: `${wsProtocol}://${host}/v1/voice/${encodeURIComponent(config.name || config.id)}`,
    httpUrl: `${protocol}://${host}/v1/voice/${encodeURIComponent(config.name || config.id)}`,
    audio: {
      format: "pcm16",
      inputSampleRate: config.settings?.inputSampleRate || 16000,
      outputSampleRate: config.settings?.outputSampleRate || 24000,
      inputMimeType: config.settings?.inputMimeType || "audio/pcm;rate=16000",
      voice: config.settings?.voice || "alloy",
    },
    checkedAt: config.checkedAt || null,
  });
}
