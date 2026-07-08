import { chatOnce, ANALYZE_MODEL } from "./ollama";
import {
  analysisSystemPrompt,
  analysisUserPrompt,
  transcriptText,
  ADVISOR_NAME,
  AGENCY_NAME,
} from "./prompts";
import { scoreToTemperature } from "./format";
import type { Lead, LeadQualification, LeadIntent } from "./types";

/** Best-effort JSON parse: tolerates code fences and surrounding prose. */
export function parseJsonLoose<T = unknown>(raw: string): T | null {
  if (!raw) return null;
  let text = raw.trim();
  // strip ```json ... ``` fences
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  // direct attempt
  try {
    return JSON.parse(text) as T;
  } catch {
    /* fall through */
  }
  // find the first balanced {...}
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') inString = !inString;
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        const candidate = text.slice(start, i + 1);
        try {
          return JSON.parse(candidate) as T;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t || /^(null|n\/a|unknown|none|-)$/i.test(t)) return null;
  return t;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[^0-9.]/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function coerceIntent(v: unknown): LeadIntent {
  const s = typeof v === "string" ? v.toLowerCase() : "";
  if (s.includes("buy")) return "buy";
  if (s.includes("rent")) return "rent";
  if (s.includes("invest")) return "invest";
  return "unknown";
}

/** Guard against the model echoing the schema's option list as the value. */
function cleanEnum(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  // Take the first option if the model returned "A | B | C" or "A, B, C".
  const first = s.split(/\s*[|/]\s*|,\s*(?=[A-Z])/)[0].trim();
  if (!first) return null;
  // Consistent casing for display (e.g. "end use" -> "End use", "3 BHK" stays).
  return first.charAt(0).toUpperCase() + first.slice(1);
}

/** Normalise a free-text property type to one clean, known label. */
function normPropertyType(v: unknown): string | null {
  const s = (cleanEnum(v) || "").toLowerCase();
  if (!s) return null;
  if (/\bplot|land\b/.test(s)) return "Plot";
  if (/villa|independent house|bungalow/.test(s)) return "Villa";
  if (/builder floor|floor/.test(s)) return "Builder Floor";
  if (/commercial|office|shop|retail/.test(s)) return "Commercial";
  if (/apartment|flat|residential/.test(s)) return "Apartment";
  return null;
}

// Small models will echo instructional prompt text verbatim into a field
// rather than following it (observed live: timeline came back as "Just
// exploring — map 'urgent' to Just exploring or 'asap'", literally copying
// the schema comment). Reject anything that looks like leaked instructions
// rather than a real value — long, or containing tell-tale meta-language.
function looksLikePromptLeak(s: string): boolean {
  return s.length > 40 || /\bmap\b|\bor ['"]|→/i.test(s);
}

const URGENCY_RE =
  /\burgent\b|\basap\b|\bimmediately\b|\bjaldi\b|\bin\s+\d+\s*(?:days?|weeks?)\b|\bwithin\s+\d+\s*(?:days?|weeks?)\b/i;

/**
 * Resolve the timeline deterministically rather than trusting the model's
 * field alone: reject prompt-leak junk, and — since a soft "map urgent to X"
 * prompt instruction proved unreliable — directly scan the transcript for
 * urgency language and override a missing/"exploring" value to "Ready to
 * move" when found. Same philosophy as the guardrails.ts output checks:
 * catch it deterministically, don't just hope the prompt holds.
 */
function fixTimeline(raw: string | null, lead: Lead): string | null {
  const value = raw && !looksLikePromptLeak(raw) ? raw : null;
  const transcriptRaw = [lead.initialMessage, ...lead.messages.map((m) => m.content)].join(" ");
  if (URGENCY_RE.test(transcriptRaw) && (!value || /explor/i.test(value))) {
    return "Ready to move";
  }
  return value;
}

/** Fallback score from how many strong signals we captured. */
function heuristicScore(q: Partial<LeadQualification>): number {
  let score = 0;
  if (q.budget) score += 25;
  if (q.locality) score += 20;
  if (q.bhk || q.propertyType) score += 15;
  if (q.timeline) {
    const t = q.timeline.toLowerCase();
    if (t.includes("ready") || t.includes("1-3") || t.includes("immediat"))
      score += 20;
    else if (t.includes("3-6")) score += 12;
    else if (t.includes("explor")) score += 3;
    else score += 8;
  }
  if (q.financing) score += 10;
  if (q.intent === "buy" || q.intent === "invest") score += 10;
  return Math.max(0, Math.min(100, score));
}

/** Build a validated LeadQualification from raw model JSON. */
function coerceQualification(
  parsed: Record<string, unknown>,
  lead: Lead,
): LeadQualification {
  const q: LeadQualification = {
    budget: str(parsed.budget),
    budgetMaxCr: num(parsed.budgetMaxCr),
    locality: str(parsed.locality) ?? lead.locality,
    propertyType: normPropertyType(parsed.propertyType),
    bhk: cleanEnum(parsed.bhk),
    intent: coerceIntent(parsed.intent),
    timeline: fixTimeline(cleanEnum(parsed.timeline), lead),
    financing: cleanEnum(parsed.financing),
    purpose: cleanEnum(parsed.purpose),
    score: 0,
    temperature: "new",
    notes: str(parsed.notes),
  };

  // Derive the numeric budget ceiling from the human string when the model's
  // value is missing or inconsistent (small models often get this wrong).
  q.budgetMaxCr = reconcileBudgetCr(q.budget, num(parsed.budgetMaxCr));

  // Display fallback: if only the numeric ceiling is known, synthesize a label
  // so the dashboard never shows an empty budget field.
  if (!q.budget && q.budgetMaxCr != null) {
    q.budget =
      q.budgetMaxCr >= 1
        ? `Up to ₹${+q.budgetMaxCr.toFixed(2)} Cr`
        : `Up to ₹${Math.round(q.budgetMaxCr * 100)} L`;
  }

  // Blend the model's judgement with a deterministic, rubric-based heuristic so
  // a lead with strong, complete signals always reads as strong (never under-sold).
  const heuristic = heuristicScore(q);
  const modelScore = num(parsed.score);
  const score =
    modelScore !== null && modelScore >= 0 && modelScore <= 100
      ? Math.round(0.55 * heuristic + 0.45 * modelScore)
      : heuristic;
  q.score = score;
  q.temperature = scoreToTemperature(score);

  return q;
}

/** Parse a ₹ budget string into a numeric crore ceiling. */
function reconcileBudgetCr(
  budget: string | null,
  modelCr: number | null,
): number | null {
  if (budget) {
    const text = budget.toLowerCase();
    const nums = (text.match(/\d+(?:\.\d+)?/g) || []).map(Number).filter((n) => n > 0);
    if (nums.length) {
      const max = Math.max(...nums);
      if (/cr|crore/.test(text)) return max;
      if (/lakh|lac|\bl\b/.test(text)) return +(max / 100).toFixed(2);
      // No explicit unit: values <= 20 are almost certainly crore, else lakh.
      return max <= 20 ? max : +(max / 100).toFixed(2);
    }
  }
  return modelCr;
}

export interface LeadBrief {
  summary: string;
  suggestedReply: string;
  nextAction: string;
}

/**
 * Validate the model's brief and fall back to a tailored template if it
 * confused roles, leaked a "[placeholder]", or came back empty. A small model
 * frequently writes the summary as the client or reverses the reply direction.
 */
function buildBrief(parsed: Record<string, unknown>, lead: Lead): LeadBrief {
  const first = lead.name.split(" ")[0] || "there";
  const modelSummary = str(parsed.summary);
  const modelReply = str(parsed.suggestedReply);
  const modelAction = str(parsed.nextAction);

  return {
    summary:
      modelSummary && isValidBrief(modelSummary, first)
        ? normalizeClientName(modelSummary, lead)
        : templateSummary(lead),
    suggestedReply:
      modelReply && isValidReply(modelReply, first)
        ? modelReply
        : templateReply(lead),
    nextAction:
      modelAction && !modelAction.includes("[")
        ? modelAction
        : templateAction(lead),
  };
}

export interface FullAnalysis extends LeadBrief {
  qualification: LeadQualification;
}

/**
 * Combined one-shot analysis — extract qualification AND write the brief in a
 * single model call. Used by the /analyze endpoint; roughly halves latency
 * versus running extraction and summary separately on CPU.
 */
export async function analyzeLead(lead: Lead): Promise<FullAnalysis> {
  const transcript = transcriptText(lead);
  const raw = await chatOnce(
    [
      { role: "system", content: analysisSystemPrompt() },
      { role: "user", content: analysisUserPrompt(transcript) },
    ],
    { json: true, temperature: 0.1, numPredict: 520, model: ANALYZE_MODEL },
  );
  const parsed = parseJsonLoose<Record<string, unknown>>(raw) ?? {};
  const qualification = coerceQualification(parsed, lead);
  const brief = buildBrief(parsed, { ...lead, qualification });
  return { qualification, ...brief };
}

/** Correct any hallucinated surname: normalise the first "First [Surname]"
 *  mention to the client's actual full name. */
function normalizeClientName(text: string, lead: Lead): string {
  const first = lead.name.split(" ")[0];
  if (!first) return text;
  const esc = first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\b${esc}(\\s+[A-Z][a-zA-Z]+)?`);
  return text.replace(re, lead.name);
}

/** A brief is valid if it's about the client (third person), not a greeting/reply. */
function isValidBrief(text: string, first: string): boolean {
  if (text.includes("[") || text.includes("|") || text.length < 25) return false;
  if (/^\s*(hi|hello|namaste|dear|hey|i['’]?m\s|i am\s|thanks|thank you)/i.test(text))
    return false;
  return text.toLowerCase().includes(first.toLowerCase());
}

/** A reply is valid if it's addressed to the client and free of placeholders. */
function isValidReply(text: string, first: string): boolean {
  if (text.includes("[") || text.includes("|") || text.length < 25) return false;
  // Reject text that reads as the client replying to the advisor.
  if (/thank you for the (suggestion|option)|i['’]?ll review|sounds perfect with (your|my)/i.test(text))
    return false;
  const addressed =
    text.toLowerCase().includes(first.toLowerCase()) ||
    /^\s*(hi|hello|namaste|dear)\b/i.test(text);
  return addressed;
}

function wantPhrase(lead: Lead): string {
  const q = lead.qualification;
  const parts = [q?.bhk, q?.propertyType].filter(Boolean);
  // Bare plural noun (not "a home") since every call site already supplies
  // its own article/quantifier — "RERA-verified a home" reads as broken
  // grammar, "RERA-verified properties" doesn't.
  return parts.length ? parts.join(" ") : "properties";
}

function templateSummary(lead: Lead): string {
  const q = lead.qualification;
  if (!q) return `${lead.name} enquired: “${lead.initialMessage}”. Awaiting qualification.`;
  const role =
    q.intent === "invest" ? "investor" : q.intent === "rent" ? "rental-seeker" : "buyer";
  const loc = q.locality ? ` in ${q.locality}` : " in Delhi NCR";
  let s = `${lead.name} is a ${role} looking for ${wantPhrase(lead)}${loc}`;
  if (q.budget) s += ` within ${q.budget}`;
  s += ".";
  const extra: string[] = [];
  if (q.timeline) extra.push(`Timeline: ${q.timeline}`);
  if (q.financing) extra.push(q.financing);
  if (extra.length) s += ` ${extra.join("; ")}.`;
  return s;
}

function templateReply(lead: Lead): string {
  const first = lead.name.split(" ")[0] || "there";
  const q = lead.qualification;
  const loc = q?.locality ? ` in ${q.locality}` : "";
  const bud = q?.budget ? ` within ${q.budget}` : "";
  return `Hi ${first}, thanks for connecting with ${AGENCY_NAME}! Based on our chat, I'm shortlisting a few RERA-verified ${wantPhrase(lead)}${loc}${bud}. Could we do a quick 10-minute call today to set up a site visit this week? — ${ADVISOR_NAME}, ${AGENCY_NAME}`;
}

function templateAction(lead: Lead): string {
  const first = lead.name.split(" ")[0] || "the lead";
  const q = lead.qualification;
  const what = q?.locality ? ` matching ${wantPhrase(lead)} in ${q.locality}` : "";
  return `Call ${first} within 30 min; share 3 RERA-verified options${what}.`;
}
