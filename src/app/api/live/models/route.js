import { NextResponse } from "next/server";
import { availableCredentialProviders, credentialSummary, discoverLiveModels, filterWebSocketLiveModels } from "@/lib/live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const url = new URL(request.url);
  const provider = url.searchParams.get("provider") || "";
  const family = url.searchParams.get("family") || "all";
  const providers = await availableCredentialProviders();
  const models = provider
    ? filterWebSocketLiveModels(provider, providers)
    : await discoverLiveModels({ family });
  const credentials = provider ? await credentialSummary(provider) : null;
  return NextResponse.json({ provider, family, models, credentials, providers });
}
