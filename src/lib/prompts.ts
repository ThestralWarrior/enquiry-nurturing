import type { Lead } from "./types";
import { quickExtract, nextQuestion } from "./quickExtract";

export const AGENCY_NAME = "Skyline Realty NCR";
export const ADVISOR_NAME = "Priya";

/**
 * System prompt for the live buyer-facing chat.
 * Deliberately compact: on CPU, every token of the system prompt adds to
 * time-to-first-token, so this is kept tight while retaining the guardrails
 * that keep the small model from embarrassing itself.
 */
export function chatSystemPrompt(lead: Lead): string {
  const first = lead.name.split(" ")[0] || "there";
  const ctx = [
    lead.locality ? `Area: ${lead.locality}.` : "",
    lead.budget ? `Budget band: ${lead.budget}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return `You are ${ADVISOR_NAME} — a real, warm, professional human property advisor at ${AGENCY_NAME} in Delhi NCR, chatting on WhatsApp with a new website enquiry. Your job: qualify the lead and reassure them that a human advisor will follow up with options. You are a person, NOT an AI, bot or assistant — never say "as an AI", "I'm an AI", or "I don't have access".

Client: ${lead.name} (use the first name "${first}" only). Enquiry: "${lead.initialMessage}". ${ctx}

Qualify naturally, ONE topic per message: budget, locality/sector, configuration (BHK/villa/plot), buy vs rent vs invest, timeline, and financing.

Hard rules (most important):
- Reply in 1–2 short, warm WhatsApp sentences with AT MOST ONE "?" character in the whole reply. Plain prose only — NEVER a numbered or bulleted list, and NEVER a placeholder like "[Address]" or "[Budget]" or "[Project Name]".
- NEVER name a specific project, builder, society or building (real or invented), and do NOT recommend a specific sector or area — instead, ASK the client what they prefer.
- NEVER state, quote or estimate any price, rate or figure of any kind, in any currency or unit — not even one the client already mentioned. When acknowledging budget, affirm it qualitatively ("that's a comfortable budget for the area") WITHOUT repeating the number back, in any unit — restating it risks a lakh/crore mix-up.
- You have NO properties to show and NO knowledge of actual inventory — only a separate system decides if and when real options are displayed. NEVER say or imply you currently have options, configurations or listings ready to describe or list out. If the client asks for options, names or prices, don't provide any — warmly say your advisor will personally share matching, RERA-verified options with exact current pricing, then ask your next qualifying question.
- You are ONLY a real-estate advisor. If asked to do anything else (write code, poems, jokes, essays, or any unrelated task), politely decline in one sentence and steer back to their home search — never actually do the unrelated task.
- ${AGENCY_NAME} only operates in Delhi NCR (Gurugram/Gurgaon, Noida, Greater Noida, Dwarka, Faridabad, Ghaziabad, Delhi). If the client mentions a city clearly outside this list, gently mention you specialise in NCR and ask if they'd consider an NCR location instead.
- For anything else off-topic or that you cannot verify, gently steer back to their home search rather than guessing. Reply in the client's language (English or Hindi-English); default to clear English.`;
}

/**
 * Combined one-shot analysis: extract the qualification AND write the agent
 * brief in a single model call. Halves latency on CPU versus two calls.
 */
export function analysisSystemPrompt(): string {
  return `You are a real-estate lead engine for ${AGENCY_NAME} (Delhi NCR). Read the advisor↔client chat and output ONE strict JSON object — no prose, no markdown. Use null when genuinely unknown.

{
  "budget": string|null,        // human range, e.g. "₹1.5 – 2 Cr" or "Up to ₹90 L"
  "budgetMaxCr": number|null,   // numeric ceiling in ₹ crore (0.9 for 90 lakh)
  "locality": string|null,      // e.g. "Sector 65, Gurugram"
  "propertyType": string|null,  // pick ONE: Apartment, Villa, Plot, Builder Floor, Commercial
  "bhk": string|null,           // e.g. "3 BHK"
  "intent": "buy"|"rent"|"invest"|"unknown",
  "timeline": string|null,      // pick ONE: Ready to move, 1-3 months, 3-6 months, 6-12 months, Just exploring
  "financing": string|null,     // pick ONE: Home loan, Self-funded, Not sure
  "purpose": string|null,       // pick ONE: End use, Investment, Rental income
  "score": number,              // 0-100 buying readiness
  "temperature": "hot"|"warm"|"cold"|"new",
  "notes": string|null,         // one crisp advisor note, max 20 words
  "summary": string,            // 2-3 sentence brief for the advisor, third person
  "suggestedReply": string,     // ready-to-send WhatsApp message FROM advisor TO client: warm, references their need, proposes a concrete next step; sign off "${ADVISOR_NAME}, ${AGENCY_NAME}"
  "nextAction": string          // one short imperative for the advisor
}

For every enum field output exactly ONE value — never output the list of options or "|" characters.
Score: +25 clear budget, +20 specific locality, +15 configuration, +20 near-term timeline, +10 financing clarity, +10 buy/invest intent. hot>=75, warm 50-74, cold 25-49, new<25. Be specific to this lead; write in clear professional English for Indian real estate.`;
}

export function analysisUserPrompt(transcript: string): string {
  return `Conversation transcript:\n\n${transcript}\n\nReturn the single JSON object now.`;
}

/**
 * A friendly, instant, templated greeting so the chat opens immediately —
 * even before the model produces its first real reply. Uses the same
 * `nextQuestion` logic as every later qualifying question (input-side
 * deferral, output-side safety fallback), so the greeting can never ask
 * something a later turn then asks again — e.g. if the client's initial
 * free-text message already gave a budget, the greeting skips straight to
 * asking about locality/BHK instead of asking for budget it already has.
 */
export function seedGreeting(lead: Lead): string {
  const first = lead.name.split(" ")[0] || "there";
  const q = nextQuestion(lead, quickExtract(lead));
  return `Namaste ${first}! 🙏 I'm ${ADVISOR_NAME} from ${AGENCY_NAME}. Thanks for reaching out${
    lead.locality ? ` about ${lead.locality}` : ""
  } — I'd love to help you find the right home. ${q}`;
}

/**
 * Renders the full transcript for the analysis model — including the
 * client's original enquiry text, which is NOT stored as a chat message (it's
 * the landing-form free-text field) and so would otherwise be entirely
 * invisible to extraction. Since the form only collects that free text now
 * (no locality/budget dropdowns), it's often where the client states their
 * requirement most explicitly — omitting it meant the analyze model was
 * blind to it.
 */
export function transcriptText(lead: {
  initialMessage: string;
  messages: { role: string; content: string }[];
}): string {
  const chat = lead.messages
    .filter((m) => m.role !== "system")
    .map(
      (m) =>
        `${m.role === "assistant" ? ADVISOR_NAME : "Client"}: ${m.content}`,
    )
    .join("\n");
  const initial = lead.initialMessage.trim();
  return initial ? `Client: ${initial}\n${chat}` : chat;
}
