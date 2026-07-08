import { NextResponse } from "next/server";
import { getLead } from "@/lib/store";
import { warmModel } from "@/lib/ollama";
import { chatSystemPrompt } from "@/lib/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Fire-and-forget warm-up, called when the chat page mounts. Preloads the model
 * and the lead's system-prompt prefix so the first real reply is near-instant.
 */
export async function POST(req: Request) {
  let leadId = "";
  try {
    ({ leadId } = await req.json());
  } catch {
    /* ignore */
  }
  const lead = leadId ? await getLead(leadId) : null;
  if (lead) {
    // Warm the exact prefix this lead's first message will use: the system
    // prompt plus the conversation so far (the instant greeting). Ollama then
    // only has to process the client's new message. Fire-and-forget.
    const prefix = [
      { role: "system" as const, content: chatSystemPrompt(lead) },
      ...lead.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    ];
    void warmModel(prefix);
  }
  return NextResponse.json({ ok: true });
}
