/**
 * Runs once when the Next.js server boots. On local Ollama we use it to load
 * the model into memory ahead of time so the very first demo interaction
 * doesn't pay the cold-start (~2-3s) model-load cost. On Groq this is a
 * no-op (stateless cloud API, nothing to preload) — see warmModel().
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { warmModel, USE_GROQ } = await import("@/lib/ollama");
    if (USE_GROQ) {
      // eslint-disable-next-line no-console
      console.log("[LeadPilot] Using Groq for chat + analysis.");
      return;
    }
    await warmModel([
      {
        role: "system",
        content:
          "You are Priya, a property advisor at Skyline Realty NCR in Delhi NCR.",
      },
      { role: "user", content: "hello" },
    ]);
    // eslint-disable-next-line no-console
    console.log("[LeadPilot] Ollama model warmed on startup.");
  } catch {
    /* best effort — the app still works, first reply is just slower */
  }
}
