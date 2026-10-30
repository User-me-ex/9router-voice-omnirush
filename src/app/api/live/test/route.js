import { NextResponse } from "next/server";
import { testLiveConfiguration } from "@/lib/live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const config = body && body.config ? body.config : body;
  if (!config || typeof config !== "object") {
    return NextResponse.json({ error: "config is required." }, { status: 400 });
  }
  try {
    const result = await testLiveConfiguration(config);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        verified: false,
        status: "failed",
        checks: [{ id: "internal", label: "Test runner", state: "failed", detail: String(error && error.message ? error.message : error) }],
      },
      { status: 500 }
    );
  }
}
