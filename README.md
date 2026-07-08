# LeadPilot — Speed‑to‑Lead AI for Delhi NCR Real Estate

A working demo of an AI that answers every property enquiry **in seconds**, qualifies the
buyer in a natural WhatsApp‑style chat, and hands the agent a **hot, ready‑to‑call lead**
with a one‑click reply — all running **privately on your own machine** via a local
[Ollama](https://ollama.com) model (`qwen2.5:1.5b`). No cloud, no per‑message cost, no data leaving the laptop.

Built to be shown to a real estate agency owner as a ₹50,000 pilot concept.

---

## The story it tells (3 screens)

1. **The buyer's view** (`/`) — a real estate landing page. A homebuyer submits an enquiry.
2. **Instant engagement** (`/chat/[id]`) — the AI advisor "Priya" greets them immediately and
   qualifies them (budget, locality, configuration, timeline, financing) in a live, streaming chat.
   Once she knows enough, she surfaces **real matching inventory with photos, inline in the
   chat** — not just a "someone will call you" deferral.
3. **The agent's view** (`/dashboard`) — the agency sees every lead scored **hot / warm / cold**,
   with an AI **summary**, a ready‑to‑send **WhatsApp reply**, the full **transcript**, an
   **AI‑shortlisted properties** section, and a qualification breakdown. One click to call or
   WhatsApp.

The pitch: *industry‑average first response is ~8 hours; LeadPilot responds in seconds — and speed is the single biggest driver of real‑estate lead conversion.*

---

## Requirements

| Tool | Version | Notes |
|------|---------|-------|
| **Node.js** | 18+ (tested on 24) | https://nodejs.org |
| **Ollama** | 0.3+ | https://ollama.com/download — `setup.ps1` installs this for you on Windows if it's missing |
| **Chat model** | `qwen2.5:1.5b` (~1 GB) | fast model for the live buyer-facing chat |
| **Analysis model** | `qwen2.5:3b` (~2 GB, optional) | more capable model for background lead qualification — see [why](#why-two-models) |

Runs comfortably on a normal Windows/Mac laptop with **no GPU** (CPU‑only inference).

---

## Quick start

### First time on a new machine (Windows)

One command takes you from a fresh clone to a running app — installs Ollama if it's missing,
pulls both models, runs `npm install`, creates `.env.local`, builds, and starts:

```powershell
powershell -ExecutionPolicy Bypass -File setup.ps1

# Or, to skip the larger 3B analysis model and save ~2 GB / some time:
powershell -ExecutionPolicy Bypass -File setup.ps1 -SkipAnalyzeModel
```

It's safe to re-run — every step checks first and skips whatever's already done.

### Every time after that (Windows)

```powershell
# Start everything (Ollama + model warm-up + the app) and open your browser
powershell -ExecutionPolicy Bypass -File start-demo.ps1

# When you're done demoing
powershell -ExecutionPolicy Bypass -File stop-demo.ps1
```

`start-demo.ps1` checks Ollama is running, confirms the model is pulled, warms it, starts the
app in the background, waits until it responds, then opens **http://localhost:3000** for you.
It's safe to run again if the app is already up — it just detects that and opens the browser.

`stop-demo.ps1` shuts the app down cleanly. It leaves Ollama itself running (so your *next* demo
starts instantly with no re-download/re-warm) — pass `-All` if you want to stop Ollama too.

## Manual setup (macOS/Linux, or if you'd rather do it by hand)

```bash
# 1. Install dependencies
npm install

# 2. Make sure Ollama is running and the model is present (one time)
ollama serve            # (or just launch the Ollama app)
ollama pull qwen2.5:1.5b

# 3a. Development mode (hot reload)
npm run dev

# 3b. …or production mode (what start-demo.ps1 runs under the hood)
npm run build
npm start
```

Open **http://localhost:3000**.

The app **warms the model on startup** and again when a chat page opens, so the very first
reply in your demo is fast (typically **< 1 second to first word** on a modern laptop CPU).

---

## How it works

### Architecture

```
Next.js 14 (App Router, TypeScript, Tailwind)
│
├─ src/app/                      UI + API (route handlers, Node runtime)
│   ├─ page.tsx                  Landing page + inquiry form
│   ├─ chat/[id]/page.tsx        Buyer chat (streaming)
│   ├─ dashboard/page.tsx        Agent workspace
│   └─ api/
│       ├─ leads/                create / list / get leads
│       ├─ chat/                 streams the AI reply from Ollama
│       ├─ leads/[id]/extract    → qualification JSON
│       ├─ leads/[id]/summary    → summary + suggested reply
│       ├─ leads/[id]/analyze    → both, in one model call (used by the UI)
│       ├─ health/               Ollama reachability + model check
│       └─ warmup/               preloads the model prefix
│
├─ src/lib/
│   ├─ ollama.ts                 Ollama client: health, streaming chat, JSON chat, warm‑up
│   ├─ prompts.ts                Priya's persona + extraction/summary/analysis prompts
│   ├─ guardrails.ts             deterministic safety rail (never invent names/prices)
│   ├─ inventory.ts              sample NCR listing data (fictional, illustrative)
│   ├─ matchProperties.ts        deterministic, model‑free scoring/matching engine
│   ├─ quickExtract.ts           regex/keyword qualification parser for live chat (no LLM call)
│   ├─ analyze.ts                JSON parsing, coercion, scoring, validated fallbacks
│   ├─ store.ts                  file‑backed lead store (data/leads.json)
│   ├─ seed.ts                   realistic demo leads on first run
│   └─ types.ts, format.ts       shared types + formatting helpers
│
├─ src/instrumentation.ts        warms the model when the server boots
└─ data/leads.json               runtime lead storage (git‑ignored, auto‑seeded)
```

There is **no database** — leads persist to a JSON file so the demo has zero setup. Writes are
serialised in‑process so concurrent requests can't corrupt the file.

### The AI layer

- **Chat** (`/api/chat`) proxies a streaming completion from Ollama's `/api/chat` and re‑streams
  the tokens to the browser as plain text, so the reply *types out* live. The full turn is
  persisted to the lead's transcript when it finishes.
- **Qualification & brief** (`/api/leads/[id]/analyze`) asks the model for **strict JSON** and
  parses it defensively — code‑fence stripping, brace matching, enum sanitising, and
  **tailored template fallbacks** if the small model returns something malformed. It always yields
  a valid, presentable result.
- **Scoring** blends the model's judgement with a deterministic rubric (budget, locality,
  configuration, timeline, financing, intent) so a complete lead always reads as strong.

### Why it's fast (on CPU)

An early version made the model spend ~6.5s *before the first word*. Three changes fixed it:

1. **Tight system prompt** — the biggest lever. Prompt tokens dominate time‑to‑first‑token on CPU.
2. **Model kept warm** — `keep_alive: 4h` plus a boot‑time and page‑open **warm‑up** that caches
   the exact prompt prefix, so the first real message only has to process the new text.
3. **Capped reply length** — replies are short by design (1–2 WhatsApp sentences), so they finish quickly.

Result: **~0.9s to first token, ~2.5s full reply** on an i5 laptop, down from ~8.5s.

### Why two models

The live chat and the background lead-analysis step have opposite needs — chat is
latency‑sensitive (a buyer is watching), analysis isn't (it runs after "request a callback",
decoupled from the buyer's screen, and the dashboard just shows it whenever it's ready). So they
use different models:

- **Chat stays on `qwen2.5:1.5b`** — a bigger model here was tested and rejected: on this CPU,
  `qwen2.5:3b` was 47–120% slower per turn with **no measurable safety/quality improvement**,
  because the real safety net is the deterministic guardrail code below, not the model's own
  judgment.
- **Analysis defaults to `qwen2.5:3b`** if you have it (`OLLAMA_ANALYZE_MODEL` in `.env.local`,
  set automatically by `setup.ps1`) — benchmarked head‑to‑head on 15 hand‑scripted transcripts:
  **77% vs 53% structured‑field completeness**, zero new violations, at ~2.8x the latency
  (~24s vs ~9s avg). That cost is free now that analysis doesn't block the buyer. Falls back to
  the chat model automatically if the bigger one isn't installed (`-SkipAnalyzeModel` in setup).

### Why it won't embarrass you (guardrails)

A 1.5B model is small, so quality is enforced, not hoped for:

- **Deterministic safety rail** (`guardrails.ts`): if a buyer asks *"suggest some projects"* or
  *"what's the price?"*, the app **does not let the model improvise**. It replies with a polished,
  on‑brand deferral ("our advisor will personally share matching RERA‑verified options with exact
  pricing…") and keeps qualifying — exactly what a sharp human agent does. This kills the #1 failure
  mode (inventing fake project names / prices).
- **Grounded prompt**: never names a project/building, never quotes a figure, never restates a
  budget number (avoids unit slips), stays in character (never "as an AI"), and low temperature (0.3).
- **Validated analysis**: enum echoes, role confusion, and placeholder leaks are caught and replaced
  with clean templates before anything reaches the dashboard.

### Property matching — real inventory, not just a deferral

Instead of only saying "our advisor will share options," the app actually shows matching listings
with photos, inline in the chat, the moment it knows enough about the buyer:

- **`inventory.ts`** — a sample set of ~15 fictional NCR listings (clearly labelled "Sample listing"
  in the UI — this is illustrative pilot data standing in for a real agency's CRM/MLS feed).
- **`matchProperties.ts`** — a deterministic scoring function (locality, BHK, budget, property type,
  intent). **Not a model call** — plain arithmetic, so it's instant and can never hallucinate a
  listing. A minimum score threshold means a lead with too little known about them just gets no
  results, never a shaky, embarrassing "match."
- **`quickExtract.ts`** — a lightweight regex/keyword parser that reads the live conversation for
  locality/BHK/budget/intent **without an extra LLM call**, so surfacing matches adds zero latency
  to the chat.
- **Trigger logic**: matches show up automatically once the conversation has enough signal
  (proactively, like a sharp human advisor), and only once per lead (`matchesShown` flag) so it
  never spams. If a buyer asks for suggestions before there's enough signal, the app still falls
  back to the safe deferral and keeps qualifying.
- **"Photos"** are inline SVG illustrations (`PropertyArt.tsx`), not stock photography — so the
  whole demo, including the visuals, still works with **zero network calls**, matching the
  "runs entirely on your machine" pitch.
- The same matcher powers the dashboard's **AI‑shortlisted properties** section on any qualified
  lead — the agent sees the same shortlist the buyer saw.

Tested across buyers, investors, vague browsers, Hindi‑English messages, direct price/project asks,
and a prompt‑injection attempt — all handled cleanly.

### Graceful degradation

If Ollama is off or the model is missing, the app doesn't crash — the health pill turns amber/red
and the chat shows the exact fix command (e.g. `ollama pull qwen2.5:1.5b`) with a copy button.

---

## Configuration

Optional — sensible defaults are baked in. Copy `.env.example` → `.env.local` to override:

```
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:1.5b
OLLAMA_KEEP_ALIVE=4h
```

Want higher answer quality and don't mind a bit more latency? Pull a bigger model and point at it:

```
ollama pull qwen2.5:3b
# .env.local →  OLLAMA_MODEL=qwen2.5:3b
```

---

## Suggested demo script (for the client meeting)

1. Open the **dashboard** first — it's pre‑seeded with realistic leads (a hot Sector‑65 buyer, a
   warm Noida investor). Show the score, summary, and one‑click WhatsApp reply.
2. Open the **landing page** in another tab. Submit an enquiry as a buyer.
3. You're instantly in the **chat** — reply a couple of times. Point out the speed and that it's
   *running locally, no cloud*.
4. Try asking it *"suggest some projects"* — show that it never makes things up.
5. Click **"request a callback"**, switch back to the **dashboard** — the new lead is there,
   qualified, with a ready reply. That's the whole speed‑to‑lead loop.

---

## Scripts

| Command | Does |
|---------|------|
| `setup.ps1` | (Windows) fresh clone → running app: installs Ollama if missing, pulls both models, `npm install`, creates `.env.local`, builds, and starts |
| `start-demo.ps1` | (Windows) check Ollama + model, warm, and launch (assumes `setup.ps1` has already run once) |
| `stop-demo.ps1` | (Windows) stop the app cleanly; `-All` also stops Ollama |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build |
| `npm start` | Run the production build |

---

## Notes & limitations

- The model is intentionally small (`qwen2.5:1.5b`) so it runs on any laptop. Occasional phrasing
  can be a touch generic — that's the trade‑off for zero‑cost, on‑device inference. The guardrails
  ensure it's never *wrong* in a way that would embarrass you in front of a client.
- Lead data lives in `data/leads.json`. Delete that file to reset to the clean seed leads.
- This is a pilot concept: production would add a real datastore, auth, CRM/WhatsApp Business API
  integration, and lead routing.
