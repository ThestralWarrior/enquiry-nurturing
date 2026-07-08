export type Role = "user" | "assistant" | "system";

export type LeadTemperature = "hot" | "warm" | "cold" | "new";

export type LeadIntent = "buy" | "rent" | "invest" | "unknown";

export interface ChatMessage {
  role: Role;
  content: string;
  ts: number;
  /** Present when this turn also surfaced AI-matched inventory to the client. */
  kind?: "text" | "properties";
  propertyIds?: string[];
}

export interface LeadQualification {
  budget: string | null; // human range, e.g. "₹1.5 – 2 Cr"
  budgetMaxCr: number | null; // best-effort numeric ceiling in ₹ crore
  locality: string | null; // e.g. "Sector 65, Gurugram"
  propertyType: string | null; // Apartment / Villa / Plot / Commercial
  bhk: string | null; // "3 BHK"
  intent: LeadIntent;
  timeline: string | null; // "Ready to move" / "3–6 months"
  financing: string | null; // "Home loan" / "Self-funded"
  purpose: string | null; // "End use" / "Investment"
  score: number; // 0–100 qualification score
  temperature: LeadTemperature;
  notes: string | null; // short internal note
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  source: string; // Website / 99acres / MagicBricks / Walk-in
  locality: string | null; // locality captured on the form
  budget: string | null; // budget band captured on the form
  initialMessage: string;
  createdAt: number;
  updatedAt: number;
  engaged: boolean; // whether the AI has greeted the lead
  messages: ChatMessage[];
  qualification: LeadQualification | null;
  summary: string | null;
  suggestedReply: string | null;
  nextAction: string | null;
  analyzedAt: number | null;
  seen: boolean; // has the agent opened this lead in the dashboard
  matchesShown: boolean; // whether inventory matches have already been surfaced in chat
}

export interface CreateLeadInput {
  name: string;
  phone: string;
  email?: string | null;
  source?: string;
  locality?: string | null;
  budget?: string | null;
  initialMessage: string;
}
