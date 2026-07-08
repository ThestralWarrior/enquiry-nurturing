import { NextResponse } from "next/server";
import { getLead, updateLead } from "@/lib/store";
import { checkHealth, remediationFor } from "@/lib/ollama";
import { analyzeLead } from "@/lib/analyze";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One-shot: extract structured qualification, then generate the agent brief. */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const lead = await getLead(params.id);
  if (!lead) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }

  const remediation = remediationFor(await checkHealth());
  if (remediation) {
    return NextResponse.json({ error: remediation.message, remediation }, {
      status: 503,
    });
  }

  try {
    const { qualification, summary, suggestedReply, nextAction } =
      await analyzeLead(lead);
    const updated = await updateLead(params.id, {
      qualification,
      summary,
      suggestedReply,
      nextAction,
      analyzedAt: Date.now(),
    });
    return NextResponse.json(
      { qualification, summary, suggestedReply, nextAction, lead: updated },
      { status: 200 },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed." },
      { status: 502 },
    );
  }
}
