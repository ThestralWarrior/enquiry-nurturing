import { NextResponse } from "next/server";
import { getLead, updateLead } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const lead = await getLead(params.id);
  if (!lead) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }
  return NextResponse.json(
    { lead },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Lightweight updates from the dashboard, e.g. marking a lead as seen. */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* empty body is fine */
  }
  const patch: Record<string, unknown> = {};
  if (typeof body.seen === "boolean") patch.seen = body.seen;

  const lead = await updateLead(params.id, patch);
  if (!lead) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }
  return NextResponse.json({ lead });
}
