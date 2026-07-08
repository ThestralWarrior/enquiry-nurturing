import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { Lead, CreateLeadInput } from "./types";
import { seedLeads } from "./seed";
import { seedGreeting } from "./prompts";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "leads.json");

// Serialise all mutations so concurrent requests never corrupt the JSON file.
let mutationChain: Promise<unknown> = Promise.resolve();

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = mutationChain.then(fn, fn);
  mutationChain = run.catch(() => undefined);
  return run;
}

async function ensureStore(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    // First run — seed with realistic demo leads.
    await fs.writeFile(DATA_FILE, JSON.stringify(seedLeads(), null, 2), "utf8");
  }
}

export async function readLeads(): Promise<Lead[]> {
  await ensureStore();
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? (parsed as Lead[]) : [];
  } catch {
    return [];
  }
}

async function writeLeads(leads: Lead[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(leads, null, 2), "utf8");
}

export async function getLead(id: string): Promise<Lead | null> {
  const leads = await readLeads();
  return leads.find((l) => l.id === id) ?? null;
}

export async function listLeads(): Promise<Lead[]> {
  const leads = await readLeads();
  return [...leads].sort((a, b) => b.createdAt - a.createdAt);
}

export async function createLead(input: CreateLeadInput): Promise<Lead> {
  return enqueue(async () => {
    const leads = await readLeads();
    const now = Date.now();
    const lead: Lead = {
      id: randomUUID(),
      name: input.name.trim(),
      phone: input.phone.trim(),
      email: input.email?.trim() || null,
      source: input.source?.trim() || "Website",
      locality: input.locality?.trim() || null,
      budget: input.budget?.trim() || null,
      initialMessage: input.initialMessage.trim(),
      createdAt: now,
      updatedAt: now,
      engaged: true,
      seen: false,
      matchesShown: false,
      messages: [],
      qualification: null,
      summary: null,
      suggestedReply: null,
      nextAction: null,
      analyzedAt: null,
    };
    // Seed an instant, templated greeting so the chat opens immediately.
    lead.messages.push({
      role: "assistant",
      content: seedGreeting(lead),
      ts: now + 1,
    });
    leads.unshift(lead);
    await writeLeads(leads);
    return lead;
  });
}

/** Apply a patch to a lead. `patch` may be a partial object or an updater fn. */
export async function updateLead(
  id: string,
  patch: Partial<Lead> | ((lead: Lead) => Partial<Lead>),
): Promise<Lead | null> {
  return enqueue(async () => {
    const leads = await readLeads();
    const idx = leads.findIndex((l) => l.id === id);
    if (idx === -1) return null;
    const current = leads[idx];
    const delta = typeof patch === "function" ? patch(current) : patch;
    const updated: Lead = { ...current, ...delta, updatedAt: Date.now() };
    leads[idx] = updated;
    await writeLeads(leads);
    return updated;
  });
}

export async function appendMessage(
  id: string,
  role: "user" | "assistant",
  content: string,
  extra?: { kind?: "text" | "properties"; propertyIds?: string[] },
): Promise<Lead | null> {
  return updateLead(id, (lead) => ({
    messages: [...lead.messages, { role, content, ts: Date.now(), ...extra }],
  }));
}
