import { NextResponse } from "next/server";
import { getProviderConnections } from "@/lib/localDb";
import { probeAllProviderConnections } from "@/lib/live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    const results = await probeAllProviderConnections();
    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json({ error: String(error?.message || error) }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const results = await probeAllProviderConnections(body.providerId);
    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json({ error: String(error?.message || error) }, { status: 500 });
  }
}
