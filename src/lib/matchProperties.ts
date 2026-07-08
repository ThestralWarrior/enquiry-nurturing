import { INVENTORY, type PropertyListing } from "./inventory";
import type { LeadIntent } from "./types";

export interface MatchQuery {
  locality: string | null;
  bhk: string | null;
  propertyType: string | null;
  budgetMaxCr: number | null;
  intent: LeadIntent;
}

const STOPWORDS = new Set(["sector", "the", "in", "at", "near", "ncr"]);

// Buyers overwhelmingly use the pre-2016 colloquial name ("Gurgaon") rather
// than the official renamed one ("Gurugram") that the inventory is keyed on.
// Normalising both sides through the same map keeps locality matching from
// silently failing on the single most common way people actually type it.
const SYNONYMS: Record<string, string> = {
  gurgaon: "gurugram",
  ggn: "gurugram",
};

/** Lowercase, punctuation-agnostic word tokens with common stopwords removed. */
export function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t && !STOPWORDS.has(t))
    .map((t) => SYNONYMS[t] ?? t);
}

function localityScore(query: string | null, listing: PropertyListing): number {
  if (!query) return 0;
  const qTokens = new Set(tokens(query));
  if (qTokens.size === 0) return 0;
  const targetTokens = new Set([...tokens(listing.locality), ...tokens(listing.city)]);
  let hits = 0;
  for (const t of qTokens) if (targetTokens.has(t)) hits++;
  if (hits === 0) return 0;
  // Reward matching a larger share of the query's tokens (e.g. both "sector"
  // number and city name), capped at the full 40-point allocation.
  return Math.min(40, Math.round((hits / qTokens.size) * 40));
}

function bhkScore(query: string | null, listing: PropertyListing): number {
  if (!query || !listing.bhk) return 0;
  const qNum = query.match(/\d/)?.[0];
  const lNum = listing.bhk.match(/\d/)?.[0];
  if (!qNum || !lNum) return 0;
  if (qNum === lNum) return 25;
  if (Math.abs(Number(qNum) - Number(lNum)) === 1) return 10;
  return 0;
}

function budgetScore(budgetMaxCr: number | null, listing: PropertyListing): number {
  if (budgetMaxCr == null || budgetMaxCr <= 0) return 0;
  const ratio = listing.priceCr / budgetMaxCr;
  if (ratio <= 1.15 && ratio >= 0.4) {
    // Full marks for anything at or comfortably under budget; taper off for
    // listings far cheaper than the stated budget (likely not the right fit).
    if (ratio <= 1.15 && ratio >= 0.7) return 20;
    return 10;
  }
  return 0;
}

function propertyTypeScore(query: string | null, listing: PropertyListing): number {
  if (!query) return 0;
  return query.toLowerCase() === listing.propertyType.toLowerCase() ? 10 : 0;
}

function intentScore(intent: LeadIntent, listing: PropertyListing): number {
  if (intent === "unknown") return 0;
  return listing.intentFit.includes(intent) ? 5 : 0;
}

/**
 * Deterministic, model-free matcher: scores every listing against the query
 * and returns the top matches. A minimum score threshold means a lead with
 * too little known about them (e.g. only a locality) never gets a shaky,
 * embarrassing "match" — it just returns no results until there's enough signal.
 */
export function matchProperties(query: MatchQuery, limit = 3): PropertyListing[] {
  const MIN_SCORE = 45;
  const scored = INVENTORY.map((listing) => ({
    listing,
    score:
      localityScore(query.locality, listing) +
      bhkScore(query.bhk, listing) +
      budgetScore(query.budgetMaxCr, listing) +
      propertyTypeScore(query.propertyType, listing) +
      intentScore(query.intent, listing),
  }))
    .filter((s) => s.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((s) => s.listing);
}

export function getListingsByIds(ids: string[]): PropertyListing[] {
  const byId = new Map(INVENTORY.map((l) => [l.id, l]));
  return ids.map((id) => byId.get(id)).filter((l): l is PropertyListing => !!l);
}

/** Is there enough signal to attempt a match at all? Avoids wasted lookups. */
export function hasEnoughSignal(query: MatchQuery): boolean {
  return !!query.locality && (!!query.bhk || query.budgetMaxCr != null);
}
