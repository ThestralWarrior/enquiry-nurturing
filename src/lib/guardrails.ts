import type { Lead } from "./types";
import { KNOWN_LOCALITIES } from "./inventory";
import { tokens, type MatchQuery } from "./matchProperties";
import { nextQuestion } from "./quickExtract";

export type RiskKind = "listing" | "price" | null;

// "suggest/name/show me ... a project/society/builder/option ..." — a request
// for specific inventory the model must never fabricate.
const LISTING_RE =
  /\b(suggest|recommend|name|show|list|share|give|tell|which|what(?:'s|s| is| are)?|any|some|best|top|good|options?\s+for)\b[^.?!\n]*\b(projects?|societ(?:y|ies)|builders?|options?|propert(?:y|ies)|flats?|apartments?|towers?|villas?|schemes?|complex(?:es)?|penthouses?|farmhouses?)\b/i;

// Direct price / rate questions — the model must never quote figures.
const PRICE_RE =
  /\b(price|prices|pricing|rate|rates|cost|costs?|per\s*sq\.?\s*ft|psf|how\s+much|kitna|kitne)\b/i;

// A capitalized "Name Suffix" pattern that looks like a specific project or
// building (ours or anyone else's), or a well-known major Indian developer
// name. If the client names one directly (e.g. "DLF Camellias") — even
// without any "suggest/show me" verb — that's just as much a request to
// discuss specifics as a generic listing ask, and must be deferred the same
// way rather than let the model engage with (and invent details about) it.
const NAMED_PROJECT_RE =
  /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(Camellias|Towers?|Heights|Residenc(?:y|es)|Park|Greens|Enclave|Estate|Gardens|Homes|Apartments|City|Vista|Court|Villas?|Floors?)\b|\b(?:DLF|Godrej|M3M|Sobha|Lodha|Prestige|Tata|Emaar|Adani|Hiranandani|Purvankara|Brigade|Unitech|Ansal|Omaxe|Supertech|Amrapali)\b/;

/**
 * Detects the prompts the small model is most likely to fumble on: being
 * asked to name specific properties (generically, or by directly naming one),
 * or to quote a price. For these we bypass the model and reply with a safe,
 * on-brand deferral.
 */
export function detectRiskIntent(text: string): RiskKind {
  const t = text.trim();
  if (PRICE_RE.test(t)) return "price";
  if (LISTING_RE.test(t) || NAMED_PROJECT_RE.test(t)) return "listing";
  return null;
}

/**
 * A warm, human deferral — never names a property or quotes a price, and always
 * moves qualification forward with exactly one question.
 */
export function deferralReply(
  lead: Lead,
  kind: Exclude<RiskKind, null>,
  query: MatchQuery,
): string {
  const first = lead.name.split(" ")[0] || "there";
  const q = nextQuestion(lead, query);
  if (kind === "price") {
    return `Great question, ${first} — prices move quite a bit, so instead of quoting a stale figure, our advisor will personally share the exact, current pricing on RERA‑verified options that fit you. ${q}`;
  }
  return `I'd love to help with that, ${first}! Rather than generic names, our advisor will hand‑pick RERA‑verified options that genuinely match your needs and walk you through them personally. ${q}`;
}

// Phrases that imply the model is presenting, comparing, or describing actual
// curated listings — it never has any. Caught even though no project name or
// price was used, since these still promise/describe inventory that doesn't exist.
const IMPLIES_INVENTORY_RE =
  /\bwe(?:'ve|(?:\s+\w+)?\s+have)\s+(?:several|some|a few|many)\b|\blet'?s\s+(?:explore|compare)\s+(?:the|these|those)\b|\beach\s+propert(?:y|ies)\b|\bbetter\s+views?\b|\bmore\s+space\b|\bwe'?ll\s+(?:start\s+by\s+)?show(?:ing)?\s+you\b|\bconfigurations?\s+(?:that|which)\s+(?:include|offer)\b|\bhere\s+(?:are|is)\s+(?:some|a few|several|the)\b/i;

// The model recommending unnamed-but-specific areas on its own initiative
// ("areas like X", "such as Y or Z") — forbidden regardless of which area.
const NAMES_AREA_RE = /\b(?:areas?|localit(?:y|ies)|sectors?|places?)\s+(?:like|such as)\b/i;

// The single strongest, near-zero-false-positive signal that the model just
// improvised a fake listing template: an unfilled placeholder bracket like
// "[Address]" or "[Budget]". Observed live in testing — the model produced a
// numbered list of fake properties each with "Located at [Address], budget
// ₹[Budget]". No legitimate reply ever needs a bracketed placeholder.
const PLACEHOLDER_BRACKET_RE = /\[[A-Za-z][a-zA-Z ]{1,30}\]/;

// Priya must never format a reply as a list — a numbered/bulleted list is
// also how the model tends to present invented "options" wholesale, and it's
// already against the "1-2 short sentences" style rule regardless of content.
const LIST_FORMAT_RE = /(^|\n)\s*(?:\d+[.)]|[-*•])\s+\S/;

// Any price/rate figure in the model's own free-generated text — even one
// that happens to correctly restate what the client said risks a unit slip
// (observed live: "0.5 crore" restated back as "₹5 lakh", a 10x error), and
// several were fully invented with no basis in anything the client said. The
// safe move is qualitative acknowledgement only, so this is a blanket ban.
const PRICE_FIGURE_RE = /₹\s?\d|\b\d+(?:\.\d+)?\s*(?:cr|crore|lakh|lac)\b/i;

// The model complying with an unrelated task (writing code, poems, etc.)
// instead of staying in character as a property advisor. Observed live: asked
// to "write a python script to scrape listings", it wrote working-looking code.
const OFF_TOPIC_COMPLIANCE_RE =
  /```|\bdef\s+\w+\(|\bimport\s+(?:requests|bs4|scrapy|pandas)\b|\bonce upon a time\b|\bhere'?s\s+a\s+(?:poem|script|function|recipe|joke)\b/i;

/**
 * Did the reply mention a specific known NCR locality the client never said
 * themselves? Priya may only ask about locality, never suggest one — if she
 * names one unprompted, that's exactly the "recommend a specific area"
 * violation the prompt forbids, and small models don't obey that reliably
 * 100% of the time through prompting alone.
 */
function localityLeaked(text: string, lead: Lead): boolean {
  const clientText = [
    lead.initialMessage,
    ...lead.messages.filter((m) => m.role === "user").map((m) => m.content),
  ].join(" ");
  const clientTokens = new Set(tokens(clientText));
  const replyTokens = new Set(tokens(text));
  for (const loc of KNOWN_LOCALITIES) {
    const locTokens = tokens(loc);
    if (locTokens.length === 0) continue;
    const inReply = locTokens.every((t) => replyTokens.has(t));
    if (!inReply) continue;
    const clientSaidIt = locTokens.every((t) => clientTokens.has(t));
    if (!clientSaidIt) return true;
  }
  return false;
}

/**
 * Output-side safety net, mirroring `detectRiskIntent` but for the model's own
 * generated reply instead of the client's message. A 1.5B model will not
 * reliably obey "never recommend a specific area" or "never imply you have
 * listings" through prompting alone over a long conversation — this catches
 * it deterministically before the text ever reaches the client.
 */
export function detectReplyRisk(text: string, lead: Lead): boolean {
  if (PLACEHOLDER_BRACKET_RE.test(text)) return true;
  if (LIST_FORMAT_RE.test(text)) return true;
  if (PRICE_FIGURE_RE.test(text)) return true;
  if (OFF_TOPIC_COMPLIANCE_RE.test(text)) return true;
  if (IMPLIES_INVENTORY_RE.test(text)) return true;
  if (NAMES_AREA_RE.test(text)) return true;
  // Even if the client named a real project first, the model must never
  // engage with or describe it — defense in depth alongside the input-side
  // check, in case a named-project mention slips through some other turn.
  if (NAMED_PROJECT_RE.test(text)) return true;
  if (localityLeaked(text, lead)) return true;
  return false;
}

/** A safe, generic line that keeps qualifying without repeating whatever the
 *  model almost said — reuses the same "what's still missing" logic as the
 *  input-side deferral so it always asks something genuinely useful next. */
export function safeFallbackReply(lead: Lead, query: MatchQuery): string {
  const first = lead.name.split(" ")[0] || "there";
  return `Got it, ${first}! ${nextQuestion(lead, query)}`;
}

/** Split a canned reply into word chunks so it can be streamed like real typing. */
export function toStreamChunks(text: string): string[] {
  return text.split(/(\s+)/).filter((s) => s.length > 0);
}
