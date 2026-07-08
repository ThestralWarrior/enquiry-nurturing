import type { Role } from "./types";

export const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL?.replace(/\/$/, "") || "http://127.0.0.1:11434";
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:1.5b";

// The one-time lead-analysis step (extraction + summary + suggested reply)
// is NOT on the buyer's live critical path — ChatClient.tsx's "finish" fires
// it in the background rather than blocking the buyer's screen on it — so it
// can afford a bigger, more capable model without hurting perceived chat
// speed. Defaults to the same model as chat unless explicitly overridden.
export const ANALYZE_MODEL = process.env.OLLAMA_ANALYZE_MODEL || OLLAMA_MODEL;

// Keep the model resident in memory so a demo never pays the cold-load cost.
// Applied to every request so no single call shortens the unload timer.
export const KEEP_ALIVE = process.env.OLLAMA_KEEP_ALIVE || "4h";

export interface OllamaMessage {
  role: Role;
  content: string;
}

export interface OllamaHealth {
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

export async function checkHealth(): Promise<OllamaHealth> {
  const health: OllamaHealth = {
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

export function remediationFor(health: OllamaHealth): Remediation | null {
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

/**
 * Non-streaming completion. When `json` is true we ask Ollama for structured
 * JSON output and the returned string is a JSON document.
 */
export async function chatOnce(
  messages: OllamaMessage[],
  {
    json = false,
    temperature = 0.2,
    numPredict = 700,
    model = OLLAMA_MODEL,
  }: { json?: boolean; temperature?: number; numPredict?: number; model?: string } = {},
): Promise<string> {
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
 * swallowed.
 */
export async function warmModel(messages: OllamaMessage[]): Promise<void> {
  if (messages.length === 0) return;
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
