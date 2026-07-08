import type { Role } from "./types";

// If GROQ_API_KEY is set, every chat/analysis call is routed to Groq's
// OpenAI-compatible API (a real 70B model, no local install/GPU needed)
// instead of the local Ollama server. Unset the key to fall back to fully
// local/offline Ollama instantly — nothing else needs to change.
export const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
export const USE_GROQ = !!GROQ_API_KEY;
export const GROQ_BASE_URL =
  process.env.GROQ_BASE_URL?.replace(/\/$/, "") || "https://api.groq.com/openai/v1";
const GROQ_CHAT_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const GROQ_ANALYZE_MODEL = process.env.GROQ_ANALYZE_MODEL || GROQ_CHAT_MODEL;

export const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL?.replace(/\/$/, "") || "http://127.0.0.1:11434";
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:1.5b";

// The model used for the live buyer-facing chat, and for the one-time
// lead-analysis step (extraction + summary + suggested reply). Analysis runs
// in the background (ChatClient.tsx's "finish" fires it without blocking the
// buyer's screen) so it can afford a bigger/slower model than chat when on
// Ollama; on Groq both are fast enough that one model for both is simplest
// unless overridden.
export const CHAT_MODEL = USE_GROQ ? GROQ_CHAT_MODEL : OLLAMA_MODEL;
export const ANALYZE_MODEL = USE_GROQ
  ? GROQ_ANALYZE_MODEL
  : process.env.OLLAMA_ANALYZE_MODEL || OLLAMA_MODEL;

// Keep the model resident in memory so a demo never pays the cold-load cost.
// Applied to every request so no single call shortens the unload timer.
// Ollama-only; Groq is a stateless cloud API with no concept of this.
export const KEEP_ALIVE = process.env.OLLAMA_KEEP_ALIVE || "4h";

export interface OllamaMessage {
  role: Role;
  content: string;
}

export interface OllamaHealth {
  provider: "groq" | "ollama";
  reachable: boolean;
  version: string | null;
  models: string[];
  modelInstalled: boolean;
  requiredModel: string;
  analyzeModelInstalled: boolean;
  analyzeModel: string;
  baseUrl: string;
  error: string | null;
}

export interface Remediation {
  code: "ollama_unreachable" | "model_missing";
  title: string;
  message: string;
  fix: string;
}

/** A model "qwen2.5:1.5b" should also match a bare "qwen2.5" install tag. */
export function modelMatches(installed: string, required: string): boolean {
  if (installed === required) return true;
  const [instRepo, instTag] = installed.split(":");
  const [reqRepo, reqTag] = required.split(":");
  if (instRepo !== reqRepo) return false;
  // If the required tag is unspecified, any tag of the repo counts.
  if (!reqTag) return true;
  // Tolerate the implicit ":latest" tag on either side.
  const norm = (t?: string) => (t && t !== "latest" ? t : "");
  return norm(instTag) === norm(reqTag);
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 4000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timer);
  }
}

async function checkHealthGroq(): Promise<OllamaHealth> {
  const health: OllamaHealth = {
    provider: "groq",
    reachable: false,
    version: null,
    models: [],
    modelInstalled: false,
    requiredModel: CHAT_MODEL,
    analyzeModelInstalled: false,
    analyzeModel: ANALYZE_MODEL,
    baseUrl: GROQ_BASE_URL,
    error: null,
  };
  if (!GROQ_API_KEY) {
    health.error = "GROQ_API_KEY is not set.";
    return health;
  }
  try {
    const res = await fetchWithTimeout(
      `${GROQ_BASE_URL}/models`,
      { headers: { Authorization: `Bearer ${GROQ_API_KEY}` } },
      5000,
    );
    if (!res.ok) {
      health.error =
        res.status === 401
          ? "Groq rejected the API key (401 Unauthorized)."
          : `Groq responded with HTTP ${res.status}.`;
      return health;
    }
    health.reachable = true;
    const data = (await res.json()) as { data?: { id: string }[] };
    health.models = (data.data ?? []).map((m) => m.id).sort();
    health.modelInstalled = health.models.includes(CHAT_MODEL);
    health.analyzeModelInstalled = health.models.includes(ANALYZE_MODEL);
  } catch (err) {
    health.error =
      err instanceof Error && err.name === "AbortError"
        ? "Timed out connecting to Groq."
        : "Could not reach the Groq API.";
  }
  return health;
}

async function checkHealthOllama(): Promise<OllamaHealth> {
  const health: OllamaHealth = {
    provider: "ollama",
    reachable: false,
    version: null,
    models: [],
    modelInstalled: false,
    requiredModel: OLLAMA_MODEL,
    analyzeModelInstalled: false,
    analyzeModel: ANALYZE_MODEL,
    baseUrl: OLLAMA_BASE_URL,
    error: null,
  };

  try {
    const res = await fetchWithTimeout(`${OLLAMA_BASE_URL}/api/tags`, {}, 3500);
    if (!res.ok) {
      health.error = `Ollama responded with HTTP ${res.status}.`;
      return health;
    }
    health.reachable = true;
    const data = (await res.json()) as { models?: { name: string }[] };
    health.models = (data.models ?? []).map((m) => m.name).sort();
    health.modelInstalled = health.models.some((m) =>
      modelMatches(m, OLLAMA_MODEL),
    );
    health.analyzeModelInstalled = health.models.some((m) =>
      modelMatches(m, ANALYZE_MODEL),
    );
  } catch (err) {
    health.error =
      err instanceof Error && err.name === "AbortError"
        ? "Timed out connecting to Ollama."
        : "Could not reach the Ollama server.";
    return health;
  }

  // Version is best-effort; the demo doesn't depend on it.
  try {
    const vr = await fetchWithTimeout(`${OLLAMA_BASE_URL}/api/version`, {}, 2000);
    if (vr.ok) {
      const v = (await vr.json()) as { version?: string };
      health.version = v.version ?? null;
    }
  } catch {
    /* ignore */
  }

  return health;
}

export async function checkHealth(): Promise<OllamaHealth> {
  return USE_GROQ ? checkHealthGroq() : checkHealthOllama();
}

export function remediationFor(health: OllamaHealth): Remediation | null {
  if (health.provider === "groq") {
    if (!health.reachable) {
      return {
        code: "ollama_unreachable",
        title: "Groq API unreachable",
        message: health.error || `Could not reach Groq at ${health.baseUrl}.`,
        fix: "Check that GROQ_API_KEY in .env.local is set and valid, then retry.",
      };
    }
    if (!health.modelInstalled) {
      return {
        code: "model_missing",
        title: "Chat model unavailable on Groq",
        message: `Groq doesn't currently list "${health.requiredModel}" as an available model.`,
        fix: "Check GROQ_MODEL in .env.local against Groq's current model list.",
      };
    }
    if (!health.analyzeModelInstalled) {
      return {
        code: "model_missing",
        title: "Analysis model unavailable on Groq",
        message: `Groq doesn't currently list "${health.analyzeModel}" as an available model.`,
        fix: "Check GROQ_ANALYZE_MODEL in .env.local against Groq's current model list.",
      };
    }
    return null;
  }
  if (!health.reachable) {
    return {
      code: "ollama_unreachable",
      title: "Local AI engine is offline",
      message: `Ollama isn't reachable at ${health.baseUrl}.`,
      fix: "Start Ollama (launch the Ollama app, or run `ollama serve` in a terminal), then retry.",
    };
  }
  if (!health.modelInstalled) {
    return {
      code: "model_missing",
      title: "Model not installed",
      message: `The model “${health.requiredModel}” isn't installed yet.`,
      fix: `Run \`ollama pull ${health.requiredModel}\` in a terminal, then retry.`,
    };
  }
  if (!health.analyzeModelInstalled) {
    return {
      code: "model_missing",
      title: "Analysis model not installed",
      message: `Chat is ready, but the lead-analysis model “${health.analyzeModel}” isn't installed yet.`,
      fix: `Run \`ollama pull ${health.analyzeModel}\` in a terminal, then retry.`,
    };
  }
  return null;
}

export class OllamaError extends Error {
  remediation: Remediation;
  constructor(remediation: Remediation) {
    super(remediation.message);
    this.name = "OllamaError";
    this.remediation = remediation;
  }
}

/** Throws OllamaError if the engine or model is unavailable. */
export async function assertReady(): Promise<void> {
  const health = await checkHealth();
  const remediation = remediationFor(health);
  if (remediation) throw new OllamaError(remediation);
}

async function chatOnceGroq(
  messages: OllamaMessage[],
  {
    json = false,
    temperature = 0.2,
    numPredict = 700,
    model = CHAT_MODEL,
  }: { json?: boolean; temperature?: number; numPredict?: number; model?: string },
): Promise<string> {
  const res = await fetchWithTimeout(
    `${GROQ_BASE_URL}/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: numPredict,
        ...(json ? { response_format: { type: "json_object" } } : {}),
      }),
    },
    30000,
  );
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `Groq chat failed with HTTP ${res.status}${errText ? `: ${errText.slice(0, 200)}` : ""}`,
    );
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content ?? "";
}

/**
 * Non-streaming completion. When `json` is true we ask for structured JSON
 * output and the returned string is a JSON document. Routes to Groq or local
 * Ollama depending on whether GROQ_API_KEY is set (see USE_GROQ above).
 */
export async function chatOnce(
  messages: OllamaMessage[],
  {
    json = false,
    temperature = 0.2,
    numPredict = 700,
    model = CHAT_MODEL,
  }: { json?: boolean; temperature?: number; numPredict?: number; model?: string } = {},
): Promise<string> {
  if (USE_GROQ) {
    return chatOnceGroq(messages, { json, temperature, numPredict, model });
  }
  const res = await fetchWithTimeout(
    `${OLLAMA_BASE_URL}/api/chat`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        keep_alive: KEEP_ALIVE,
        ...(json ? { format: "json" } : {}),
        options: { temperature, num_predict: numPredict },
      }),
    },
    60000,
  );
  if (!res.ok) {
    throw new Error(`Ollama chat failed with HTTP ${res.status}`);
  }
  const data = (await res.json()) as { message?: { content?: string } };
  return data.message?.content ?? "";
}

/**
 * Preload the model and warm the KV cache for a given prompt prefix so the
 * user's first real message returns its first token almost immediately.
 * Pass the full conversation-so-far (system + greeting) to cache all of it —
 * Ollama then only has to process the new user turn. Best-effort; errors are
 * swallowed. No-op on Groq: it's a stateless cloud API with no local model
 * load or KV cache to preload.
 */
export async function warmModel(messages: OllamaMessage[]): Promise<void> {
  if (USE_GROQ || messages.length === 0) return;
  try {
    await fetchWithTimeout(
      `${OLLAMA_BASE_URL}/api/chat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          messages,
          stream: false,
          keep_alive: KEEP_ALIVE,
          options: { num_predict: 1 },
        }),
      },
      30000,
    );
  } catch {
    /* best effort */
  }
}
