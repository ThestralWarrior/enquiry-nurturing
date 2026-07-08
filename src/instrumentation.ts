/**
 * Runs once when the Next.js server boots. We use it to load the Ollama model
 * into memory ahead of time so the very first demo interaction doesn't pay the
 * cold-start (~2-3s) model-load cost.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { warmModel } = await import("@/lib/ollama");
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
