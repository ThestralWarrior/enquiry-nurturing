import { NextResponse } from "next/server";
import { getLead, appendMessage, updateLead } from "@/lib/store";
import { checkHealth, remediationFor, chatOnce } from "@/lib/ollama";
import { chatSystemPrompt } from "@/lib/prompts";
import {
  detectRiskIntent,
  deferralReply,
  detectReplyRisk,
  safeFallbackReply,
  toStreamChunks,
} from "@/lib/guardrails";
import { quickExtract, isPropertyRelevantTurn } from "@/lib/quickExtract";
import { matchProperties, hasEnoughSignal } from "@/lib/matchProperties";
import { MATCH_MARKER } from "@/lib/streamProtocol";
import type { Lead } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const encoder = new TextEncoder();
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Stream a fixed reply word-by-word (natural typing) and persist it. */
function streamCanned(leadId: string, text: string): Response {
  const chunks = toStreamChunks(text);
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
        await wait(18);
      }
      await appendMessage(leadId, "assistant", text);
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

/**
 * Stream a caption, then attach real (deterministically matched) inventory to
 * that same message. One message, one bubble: the caption text is the natural
 * lead-in line, the property cards render immediately below it.
 */
function streamCannedWithMatches(
  leadId: string,
  captionText: string,
  propertyIds: string[],
): Response {
  const chunks = toStreamChunks(captionText);
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
        await wait(18);
      }
      await appendMessage(leadId, "assistant", captionText, {
        kind: "properties",
        propertyIds,
      });
      await updateLead(leadId, { matchesShown: true });
      controller.enqueue(encoder.encode(`\n\n${MATCH_MARKER}${JSON.stringify(propertyIds)}`));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

function withUserTurn(lead: Lead, content: string): Lead {
  return { ...lead, messages: [...lead.messages, { role: "user", content, ts: Date.now() }] };
}

export async function POST(req: Request) {
  let body: { leadId?: string; content?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const leadId = body.leadId ?? "";
  const content = (body.content ?? "").trim();
  if (!leadId || !content) {
    return NextResponse.json(
      { error: "leadId and content are required." },
      { status: 400 },
    );
  }

  const lead = await getLead(leadId);
  if (!lead) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }

  // Deterministic safety rail: if the client asks us to name specific
  // properties or quote a price, never let the small model improvise. If we
  // already know enough to match real (sample) inventory, show it — that's a
  // better answer than a deferral and it's still zero-hallucination, since the
  // matching is plain arithmetic, not a model call. Otherwise fall back to the
  // on-brand deferral that keeps qualifying.
  const risk = detectRiskIntent(content);
  if (risk) {
    await appendMessage(leadId, "user", content);
    const query = quickExtract(withUserTurn(lead, content));
    if (hasEnoughSignal(query)) {
      const matches = matchProperties(query);
      if (matches.length > 0) {
        const first = lead.name.split(" ")[0] || "there";
        const caption = `Great news, ${first} — based on what you have shared, here are a few options that could be a good fit:`;
        return streamCannedWithMatches(leadId, caption, matches.map((m) => m.id));
      }
    }
    void updateLead(leadId, {});
    return streamCanned(leadId, deferralReply(lead, risk, query));
  }

  // Make sure the local engine + model are actually available before we commit.
  const health = await checkHealth();
  const remediation = remediationFor(health);
  if (remediation) {
    return NextResponse.json({ error: remediation.message, remediation }, {
      status: 503,
    });
  }

  // Persist the incoming user turn.
  const withUser = await appendMessage(leadId, "user", content);
  const history = (withUser ?? lead).messages;

  const ollamaMessages = [
    { role: "system" as const, content: chatSystemPrompt(lead) },
    ...history
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  ];

  let raw: string;
  try {
    raw = await chatOnce(ollamaMessages, { temperature: 0.3, numPredict: 160 });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to reach the local model.",
        remediation: remediationFor(await checkHealth()),
      },
      { status: 503 },
    );
  }

  let trimmed = raw.trim();

  // Computed once and reused below: what the live conversation has actually
  // established so far (not the lead's stored budget/locality fields, which
  // stay null once the landing-page dropdowns were removed in favour of the
  // buyer just telling the AI directly in chat).
  const query = quickExtract(withUserTurn(lead, content));

  // Output-side safety net, mirroring the input-side one above. A 1.5B model
  // will not reliably obey "never recommend a specific area" or "never imply
  // you have listings" through prompting alone over a long conversation — this
  // catches it deterministically before the text ever reaches the client,
  // rather than hoping the prompt holds every single turn.
  if (trimmed && detectReplyRisk(trimmed, lead)) {
    trimmed = safeFallbackReply(lead, query);
  }

  // Proactive surfacing: once the conversation has told us enough (locality +
  // budget/BHK), attach real matches to the reply — like a sharp human advisor
  // would — but only once per lead so it never spams. Matching is plain
  // deterministic scoring, not a model call, so this never risks a hallucinated
  // listing regardless of what the model's own text says.
  let attachedIds: string[] | null = null;
  try {
    if (
      trimmed &&
      !lead.matchesShown &&
      hasEnoughSignal(query) &&
      isPropertyRelevantTurn(lead, content, query)
    ) {
      const matches = matchProperties(query);
      if (matches.length > 0) attachedIds = matches.map((m) => m.id);
    }
  } catch {
    // Matches are a bonus, never let a matching bug break the chat reply.
  }

  if (trimmed) {
    if (attachedIds) {
      await appendMessage(leadId, "assistant", trimmed, {
        kind: "properties",
        propertyIds: attachedIds,
      });
      await updateLead(leadId, { matchesShown: true });
    } else {
      await appendMessage(leadId, "assistant", trimmed);
      void updateLead(leadId, {});
    }
  }

  // The reply is already fully generated and safety-checked, so there's
  // nothing left to stream from Ollama — reveal it word-by-word (same
  // technique as the canned replies) for a natural typing feel.
  const chunks = toStreamChunks(trimmed);
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
        await wait(14);
      }
      if (attachedIds) {
        controller.enqueue(
          encoder.encode(`\n\n${MATCH_MARKER}${JSON.stringify(attachedIds)}`),
        );
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
