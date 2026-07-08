import type { Lead } from "./types";
import { ADVISOR_NAME, AGENCY_NAME } from "./prompts";

const MIN = 60_000;
const HOUR = 60 * MIN;

/** Realistic Delhi NCR demo leads, generated fresh so timestamps look live. */
export function seedLeads(): Lead[] {
  const now = Date.now();

  const rohanCreated = now - 12 * MIN;
  const rohan: Lead = {
    id: "seed-rohan-mehta",
    name: "Rohan Mehta",
    phone: "9873012045",
    email: "rohan.mehta@gmail.com",
    source: "Website",
    locality: "Sector 65, Gurugram",
    budget: "₹1.5 – 2.5 Cr",
    initialMessage:
      "Looking for a ready-to-move 3 BHK in Sector 65 Gurugram, budget around 2.2 Cr.",
    createdAt: rohanCreated,
    updatedAt: now - 9 * MIN,
    engaged: true,
    seen: false,
    matchesShown: true,
    messages: [
      {
        role: "assistant",
        content:
          "Namaste Rohan! 🙏 I'm Priya from Skyline Realty NCR. Thanks for reaching out about Sector 65, Gurugram — great choice, it's very well connected. To share the best matching options: are you looking at ready-to-move, and is 3 BHK the configuration you'd like?",
        ts: rohanCreated + 4_000,
      },
      {
        role: "user",
        content:
          "Yes ready to move, 3 BHK. Budget is around 2.2 crore, can stretch a little for the right property.",
        ts: rohanCreated + 90_000,
      },
      {
        role: "assistant",
        content:
          "Perfect, that's a comfortable range for a quality 3 BHK in Sector 65 — typically 1,600–1,950 sq ft. Are you buying for your own family to move in, and would you be taking a home loan or self-funding?",
        ts: rohanCreated + 150_000,
      },
      {
        role: "user",
        content:
          "For our own use, moving in the next month or so. Will take a home loan for part of it.",
        ts: rohanCreated + 210_000,
      },
      {
        role: "assistant",
        content:
          "Got it, Rohan — end-use, moving in ~1 month, part home loan. I'll have our advisor shortlist 3 RERA-verified, ready-to-move 3 BHKs in Sector 65 in your range and set up a site visit this week. You'll get a call shortly. 🙌",
        ts: rohanCreated + 260_000,
      },
    ],
    qualification: {
      budget: "₹2.2 Cr (flexible)",
      budgetMaxCr: 2.4,
      locality: "Sector 65, Gurugram",
      propertyType: "Apartment",
      bhk: "3 BHK",
      intent: "buy",
      timeline: "Ready to move (~1 month)",
      financing: "Home loan (partial)",
      purpose: "End use",
      score: 92,
      temperature: "hot",
      notes: "End-use buyer, ready to move in ~1 month, budget flexible upward.",
    },
    summary:
      "Rohan Mehta is an end-use buyer seeking a ready-to-move 3 BHK apartment in Sector 65, Gurugram, with a budget of ~₹2.2 Cr (flexible upward). He plans to move in within about a month and will take a partial home loan. Strong, near-term, high-intent lead.",
    suggestedReply: `Hi Rohan, thanks for connecting with ${AGENCY_NAME}! Based on our chat, I'm shortlisting 3 ready-to-move, RERA-verified 3 BHKs in Sector 65 (1,600–1,950 sq ft) within your budget. Could we do a quick 10-minute call today to lock a site visit this week? — ${ADVISOR_NAME}, ${AGENCY_NAME}`,
    nextAction:
      "Call within 30 min; share 3 ready-to-move 3 BHKs in Sector 65 and book a site visit this week.",
    analyzedAt: now - 8 * MIN,
  };

  const ananyaCreated = now - 2 * HOUR - 14 * MIN;
  const ananya: Lead = {
    id: "seed-ananya-sharma",
    name: "Ananya Sharma",
    phone: "9812345678",
    email: null,
    source: "99acres",
    locality: "Noida Expressway",
    budget: "₹1 – 1.25 Cr",
    initialMessage:
      "Interested in a 2 BHK near Noida Expressway for investment, rental potential is important.",
    createdAt: ananyaCreated,
    updatedAt: now - 2 * HOUR,
    engaged: true,
    seen: false,
    matchesShown: true,
    messages: [
      {
        role: "assistant",
        content:
          "Namaste Ananya! 🙏 I'm Priya from Skyline Realty NCR. Thanks for your interest in a 2 BHK near the Noida Expressway. Since rental potential matters to you, are you targeting a specific sector, and what budget range should I work within?",
        ts: ananyaCreated + 5_000,
      },
      {
        role: "user",
        content:
          "Somewhere around Sector 150 or 143. Budget up to 1.2 crore. Mainly for investment and rental yield.",
        ts: ananyaCreated + 120_000,
      },
      {
        role: "assistant",
        content:
          "Great picks — Sector 150 and 143 have strong rental demand from the corporate belt. For investment I'd look at well-managed, sports-city projects. Are you planning to purchase in the next few months, and would this be a loan or self-funded purchase?",
        ts: ananyaCreated + 180_000,
      },
      {
        role: "user",
        content:
          "Probably in the next 3-4 months. Self-funded mostly. Just want good appreciation and easy tenants.",
        ts: ananyaCreated + 240_000,
      },
    ],
    qualification: {
      budget: "Up to ₹1.2 Cr",
      budgetMaxCr: 1.2,
      locality: "Sector 150 / 143, Noida Expressway",
      propertyType: "Apartment",
      bhk: "2 BHK",
      intent: "invest",
      timeline: "3-6 months",
      financing: "Self-funded",
      purpose: "Investment (rental yield + appreciation)",
      score: 68,
      temperature: "warm",
      notes: "Investor focused on rental yield; 3-4 month horizon, self-funded.",
    },
    summary:
      "Ananya Sharma is an investor looking for a 2 BHK near the Noida Expressway (Sector 150/143) with a budget up to ₹1.2 Cr, prioritising rental yield and appreciation. She expects to buy within 3–4 months, mostly self-funded. Solid mid-term investment lead.",
    suggestedReply: `Hi Ananya, thank you for reaching out to ${AGENCY_NAME}! For rental yield in Sector 150/143, I have a couple of well-managed projects with strong tenant demand within ₹1.2 Cr. Shall I share a short comparison of expected yields and send you the RERA details? — ${ADVISOR_NAME}, ${AGENCY_NAME}`,
    nextAction:
      "Share a 2-project yield comparison for Sector 150/143 within ₹1.2 Cr; follow up in 2 days.",
    analyzedAt: now - 2 * HOUR,
  };

  const vikramCreated = now - 3 * MIN;
  const vikram: Lead = {
    id: "seed-vikram-singh",
    name: "Vikram Singh",
    phone: "9911223344",
    email: null,
    source: "MagicBricks",
    locality: "Greater Noida",
    budget: "Not sure yet",
    initialMessage:
      "Just exploring plots in Greater Noida, not in a hurry. Want to understand pricing.",
    createdAt: vikramCreated,
    updatedAt: vikramCreated + 4_000,
    engaged: true,
    seen: false,
    matchesShown: false,
    messages: [
      {
        role: "assistant",
        content:
          "Namaste Vikram! 🙏 I'm Priya from Skyline Realty NCR. Happy to help you understand plot pricing in Greater Noida — no pressure at all. Are you leaning towards a particular area (say Greater Noida West / Yamuna Expressway), and is this more for building a home or as an investment?",
        ts: vikramCreated + 4_000,
      },
    ],
    qualification: null,
    summary: null,
    suggestedReply: null,
    nextAction: null,
    analyzedAt: null,
  };

  return [vikram, rohan, ananya];
}
