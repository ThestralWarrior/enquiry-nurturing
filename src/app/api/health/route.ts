import { NextResponse } from "next/server";
import { checkHealth, remediationFor } from "@/lib/ollama";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const health = await checkHealth();
  const remediation = remediationFor(health);
  return NextResponse.json(
    { ...health, ok: health.reachable && health.modelInstalled, remediation },
    { headers: { "Cache-Control": "no-store" } },
  );
}
