import { KNOWN_LOCALITIES } from "./inventory";
import { tokens, type MatchQuery } from "./matchProperties";
import type { Lead, LeadIntent } from "./types";

/**
 * Fast, deterministic, model-free extraction of matching signal from a live
 * conversation. Used to decide whether to surface inventory matches mid-chat
 * without paying for an extra LLM call (which would add several seconds).
 * Intentionally simpler and less precise than the full LLM-based
 * `extractQualification` — good enough to trigger matching, not meant to
 * replace the AI qualification the dashboard shows.
 */
export function quickExtract(lead: Lead): MatchQuery {
  const userText = lead.messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join(" \n ");
  const fullText = `${lead.initialMessage} \n ${userText}`;

  return {
    locality: extractLocality(fullText) ?? lead.locality,
    bhk: extractBhk(fullText),
    propertyType: extractPropertyType(fullText),
    budgetMaxCr: extractBudgetMaxCr(fullText) ?? extractBudgetMaxCr(lead.budget ?? ""),
    intent: extractIntent(fullText),
  };
}

/**
 * Token-based, punctuation-agnostic locality match: free-text input rarely
 * matches a known locality's exact punctuation (e.g. "Sector 65 Gurugram"
 * vs. the stored "Sector 65, Gurugram"), so this checks that every
 * significant word of a known locality appears somewhere in the text.
 */
function extractLocality(text: string): string | null {
  const textTokens = new Set(tokens(text));
  let best: string | null = null;
  let bestHits = 0;
  for (const loc of KNOWN_LOCALITIES) {
    const locTokens = tokens(loc);
    if (locTokens.length === 0) continue;
    const hits = locTokens.filter((t) => textTokens.has(t)).length;
    // Require every significant token to be present, then prefer the most
    // specific match, e.g. "Sector 65, Gurugram" (2 tokens) over "Gurugram" (1).
    if (hits === locTokens.length && hits > bestHits) {
      best = loc;
      bestHits = hits;
    }
  }
  return best;
}

function extractBhk(text: string): string | null {
  const m = text.match(/(\d)\s*-?\s*bhk/i);
  return m ? `${m[1]} BHK` : null;
}

function extractPropertyType(text: string): string | null {
  const t = text.toLowerCase();
  if (/\bplot|land\b/.test(t)) return "Plot";
  if (/villa|independent house|bungalow/.test(t)) return "Villa";
  if (/builder floor/.test(t)) return "Builder Floor";
  if (/commercial|office space|\bshop\b|retail/.test(t)) return "Commercial";
  if (/apartment|\bflat\b|\bbhk\b/.test(t)) return "Apartment";
  return null;
}

function extractBudgetMaxCr(text: string): number | null {
  const matches = [
    ...text.matchAll(/(\d+(?:\.\d+)?)\s*(cr|crore|lakh|lac|l\b)/gi),
  ];
  if (matches.length === 0) return null;
  let maxCr = 0;
  for (const m of matches) {
    const value = parseFloat(m[1]);
    const unit = m[2].toLowerCase();
    const cr = unit.startsWith("cr") ? value : value / 100;
    if (cr > maxCr) maxCr = cr;
  }
  return maxCr > 0 ? maxCr : null;
}

function extractIntent(text: string): LeadIntent {
  const t = text.toLowerCase();
  if (/invest/.test(t)) return "invest";
  if (/\brent|rental\b/.test(t)) return "rent";
  if (/\bbuy|purchase|own\b/.test(t)) return "buy";
  return "unknown";
}

const TIMELINE_HINT_RE =
  /\bready to move\b|\bmove in\b|\bmoving in\b|\bnext (?:month|year|few months|weeks?)\b|\bin \d+\s*(?:days?|weeks?|months?)\b|\bno rush\b|\burgent\b|\bimmediately\b|\bjust (?:researching|exploring|looking|browsing)\b|\bnot in a hurry\b|\bsometime\b/i;

/** Has the conversation already given any hint about move-in timeline? Used
 *  only to decide what to ask next — not part of the property-matching query. */
function hasTimelineSignal(lead: Lead): boolean {
  const text = [lead.initialMessage, ...lead.messages.map((m) => m.content)].join(" ");
  return TIMELINE_HINT_RE.test(text);
}

/**
 * What to ask next, given what's actually known so far. Single source of
 * truth shared by the seeded greeting, the input-side deferral, and the
 * output-side safety fallback — so none of them can ever ask a question one
 * of the others already just asked. Takes the full `lead` (not just the
 * matching query) so it can also tell whether timeline has already come up —
 * without that, once budget+locality are known this would ask the same
 * "when are you moving?" question forever, even after being answered, since
 * timeline isn't part of the property-matching query itself.
 */
export function nextQuestion(lead: Lead, query: MatchQuery): string {
  if (query.budgetMaxCr == null) {
    return "To line those up, may I know your budget range and the area you're considering?";
  }
  if (!query.locality) {
    return "To shortlist the right ones, which area or sector are you leaning towards, and is it a 2 or 3 BHK you have in mind?";
  }
  if (!hasTimelineSignal(lead)) {
    return "To prioritise the best-fit options, are you hoping to move in soon, or over the next few months?";
  }
  return "One last thing — will this be financed through a home loan, or self-funded?";
}

const SHORT_AFFIRMATION_RE =
  /^(yes|yeah|yep|yup|sure|ok|okay|great|sounds good|perfect|cool|got it|alright|absolutely|of course)[.!]?$/i;

// Does this message even relate to home-buying at all? Broader than "did it
// add new info" — a message can be fully on-topic (e.g. confirming details
// already given elsewhere) without introducing anything new.
const ON_TOPIC_HINT_RE =
  /\bbhk\b|\bflat\b|\bapartment\b|\bvilla\b|\bplot\b|\bhome\b|\bhouse\b|\bpropert(?:y|ies)\b|\bbudget\b|\bcr\b|\bcrore\b|\blakh\b|\blac\b|₹|\bsector\b|\bloan\b|\bfund(?:ed|ing)\b|\bmove\b|\bmoving\b|\binvest\b|\brent\b|\bbuy\b|\bnoida\b|\bgur(?:u)?gaon\b|\bgurugram\b|\bdwarka\b|\bfaridabad\b|\bghaziabad\b/i;

/**
 * Should THIS turn be allowed to trigger proactive card surfacing? Once enough
 * cumulative signal exists, every later turn re-checks `hasEnoughSignal` — but
 * without this guard, a completely unrelated aside (e.g. "what's the weather
 * like?") sent right after the qualifying info would coincidentally attach
 * cards to an off-topic reply.
 *
 * Fires when this turn adds new qualifying signal, is a short affirmation
 * continuing the flow, or is simply on-topic for home-buying — that last case
 * matters because if the buyer put everything in their initial free-text
 * message (locality+budget+BHK all at once), the very first real chat reply
 * often just confirms details already known and adds nothing "new" by the
 * stricter check alone, which would otherwise miss the first valid moment to
 * ever show matches.
 */
export function isPropertyRelevantTurn(
  lead: Lead,
  content: string,
  query: MatchQuery,
): boolean {
  const trimmed = content.trim();
  if (SHORT_AFFIRMATION_RE.test(trimmed)) return true;
  if (ON_TOPIC_HINT_RE.test(trimmed)) return true;
  const before = quickExtract(lead);
  return (
    query.locality !== before.locality ||
    query.bhk !== before.bhk ||
    query.propertyType !== before.propertyType ||
    query.budgetMaxCr !== before.budgetMaxCr ||
    query.intent !== before.intent
  );
}
