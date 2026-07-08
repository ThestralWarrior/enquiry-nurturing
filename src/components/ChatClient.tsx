"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  Copy,
  CornerDownLeft,
  Loader2,
  PhoneCall,
  Send,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import type { Lead } from "@/lib/types";
import { ADVISOR_NAME, AGENCY_NAME } from "@/lib/prompts";
import HealthPill, { useHealth } from "@/components/HealthPill";
import { splitMatchMarker } from "@/lib/streamProtocol";
import { getListingsByIds } from "@/lib/matchProperties";
import { PropertyCardRow } from "@/components/PropertyCard";

interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
  ts: number;
  streaming?: boolean;
  error?: boolean;
  propertyIds?: string[];
}

const QUICK_REPLIES = [
  "3 BHK",
  "₹1.5 – 2 Cr",
  "Ready to move",
  "Home loan",
  "Just exploring for now",
];

export default function ChatClient({ lead }: { lead: Lead }) {
  const health = useHealth();
  const firstName = lead.name.split(" ")[0] || "there";

  const [messages, setMessages] = useState<Msg[]>(() =>
    lead.messages
      .filter((m) => m.role !== "system")
      .map((m, i) => ({
        id: `${m.ts}-${i}`,
        role: m.role as "user" | "assistant",
        content: m.content,
        ts: m.ts,
        propertyIds: m.kind === "properties" ? m.propertyIds : undefined,
      })),
  );
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<"chatting" | "finishing" | "done">("chatting");

  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, phase, scrollToBottom]);

  // Warm the model + system-prompt prefix as soon as the chat opens, so the
  // client's first message gets a near-instant first token.
  useEffect(() => {
    fetch("/api/warmup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId: lead.id }),
    }).catch(() => undefined);
  }, [lead.id]);

  const engineDown = health != null && !health.ok;
  const userTurns = messages.filter((m) => m.role === "user").length;

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || busy) return;

      const now = Date.now();
      const userMsg: Msg = { id: `u-${now}`, role: "user", content, ts: now };
      const placeholder: Msg = {
        id: `a-${now}`,
        role: "assistant",
        content: "",
        ts: now + 1,
        streaming: true,
      };
      setMessages((prev) => [...prev, userMsg, placeholder]);
      setInput("");
      setBusy(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId: lead.id, content }),
        });

        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}));
          const fix: string | undefined = data?.remediation?.fix;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === placeholder.id
                ? {
                    ...m,
                    streaming: false,
                    error: true,
                    content:
                      (data?.remediation?.message || data?.error || "The local AI engine is unavailable right now.") +
                      (fix ? `\n\n${fix}` : ""),
                  }
                : m,
            ),
          );
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          const { display } = splitMatchMarker(acc);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === placeholder.id ? { ...m, content: display } : m,
            ),
          );
        }
        const { display, propertyIds } = splitMatchMarker(acc);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === placeholder.id
              ? { ...m, content: display.trim(), streaming: false, propertyIds }
              : m,
          ),
        );
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === placeholder.id
              ? {
                  ...m,
                  streaming: false,
                  error: true,
                  content: "Connection interrupted. Please try again.",
                }
              : m,
          ),
        );
      } finally {
        setBusy(false);
        taRef.current?.focus();
      }
    },
    [busy, lead.id],
  );

  const finish = useCallback(() => {
    setPhase("finishing");
    // Fire-and-forget: the buyer should never wait on the model. Analysis
    // runs in the background and the dashboard shows it whenever it's ready
    // — typically well within the time it takes an agent to open the lead.
    // If it fails, the agent can just click "Run AI analysis" manually.
    fetch(`/api/leads/${lead.id}/analyze`, { method: "POST" }).catch(() => {
      /* best effort */
    });
    // Brief, fixed delay so the click still feels acknowledged rather than
    // an instant jarring jump — decoupled from the actual analyze latency.
    setTimeout(() => setPhase("done"), 500);
  }, [lead.id]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <div className="flex h-[100dvh] flex-col bg-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 py-3">
          <Link
            href="/"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-ink-800"
            aria-label="Back to home"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="relative">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-gold-400 to-gold-600 text-lg font-bold text-ink-900 shadow-sm">
              {ADVISOR_NAME[0]}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate font-semibold text-ink-900">
                {ADVISOR_NAME}
              </span>
              <BadgeCheck className="h-4 w-4 shrink-0 text-brand-500" />
            </div>
            <p className="truncate text-xs text-slate-500">
              Property advisor · {AGENCY_NAME}
            </p>
          </div>
          <HealthPill health={health} />
        </div>
      </header>

      {/* Engine-down banner */}
      {engineDown && health?.remediation && (
        <EngineBanner
          title={health.remediation.title}
          message={health.remediation.message}
          fix={health.remediation.fix}
        />
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-6">
          <div className="flex justify-center">
            <span className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-slate-400 shadow-sm">
              Today · You're now chatting with {ADVISOR_NAME}
            </span>
          </div>

          {messages.map((m) => (
            <MessageBubble key={m.id} msg={m} />
          ))}

          {phase === "done" && <DoneCard firstName={firstName} leadId={lead.id} />}
        </div>
      </div>

      {/* Composer */}
      {phase !== "done" && (
        <div className="sticky bottom-0 border-t border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto w-full max-w-2xl px-4 pb-4 pt-3">
            {!engineDown && userTurns >= 1 && phase === "chatting" && (
              <div className="mb-2.5 flex items-center justify-between gap-3">
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_REPLIES.map((q) => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      disabled={busy}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-gold-300 hover:bg-gold-50 hover:text-ink-800 disabled:opacity-50"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-end gap-2">
              <div className="flex flex-1 items-end rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm transition focus-within:border-gold-400 focus-within:ring-4 focus-within:ring-gold-400/15">
                <textarea
                  ref={taRef}
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  disabled={busy || engineDown}
                  placeholder={
                    engineDown ? "AI engine offline — see banner above" : "Type your message…"
                  }
                  className="max-h-32 flex-1 resize-none bg-transparent py-1 text-sm text-ink-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
                />
              </div>
              <button
                onClick={() => send(input)}
                disabled={busy || engineDown || !input.trim()}
                className="btn-primary h-11 w-11 shrink-0 rounded-2xl p-0"
                aria-label="Send message"
              >
                {busy ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </button>
            </div>

            <div className="mt-2 flex items-center justify-between">
              <p className="flex items-center gap-1 text-[11px] text-slate-400">
                <CornerDownLeft className="h-3 w-3" /> Enter to send · Shift+Enter for a new line
              </p>
              {userTurns >= 2 && phase === "chatting" && (
                <button
                  onClick={finish}
                  disabled={phase !== "chatting"}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-500"
                >
                  {(phase as string) === "finishing" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <PhoneCall className="h-3.5 w-3.5" />
                  )}
                  I'm done — request a callback
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MessageBubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  const empty = msg.content.length === 0;
  const hasProperties = !msg.streaming && !!msg.propertyIds && msg.propertyIds.length > 0;

  return (
    <div className={clsx("flex animate-fade-up gap-2.5", isUser && "flex-row-reverse")}>
      {!isUser && (
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gold-400 to-gold-600 text-sm font-bold text-ink-900">
          {ADVISOR_NAME[0]}
        </div>
      )}
      <div className={clsx("flex min-w-0 flex-col gap-2", hasProperties ? "max-w-[94%]" : "max-w-[80%]")}>
        <div
          className={clsx(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm",
            isUser
              ? "rounded-br-md bg-ink-900 text-white"
              : msg.error
                ? "rounded-bl-md bg-rose-50 text-rose-700 ring-1 ring-rose-100"
                : "rounded-bl-md bg-white text-ink-800 ring-1 ring-slate-100",
          )}
        >
          {msg.error && (
            <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-rose-600">
              <TriangleAlert className="h-3.5 w-3.5" /> Couldn't reach the AI
            </div>
          )}
          {empty && msg.streaming ? (
            <TypingDots />
          ) : (
            <span className="whitespace-pre-wrap">
              {msg.content}
              {msg.streaming && (
                <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-blink bg-gold-500 align-middle" />
              )}
            </span>
          )}
        </div>
        {hasProperties && <PropertyCardRow listings={getListingsByIds(msg.propertyIds!)} />}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2 w-2 animate-bounce-dot rounded-full bg-slate-300"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

function EngineBanner({
  title,
  message,
  fix,
}: {
  title: string;
  message: string;
  fix: string;
}) {
  const [copied, setCopied] = useState(false);
  const command = fix.match(/`([^`]+)`/)?.[1] ?? null;
  const copy = async () => {
    if (!command) return;
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="border-b border-amber-200 bg-amber-50">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
        <TriangleAlert className="h-5 w-5 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-900">{title}</p>
          <p className="text-xs text-amber-700">{message} {!command && fix}</p>
        </div>
        {command && (
          <div className="flex items-center gap-2 rounded-lg bg-ink-900 px-2.5 py-1.5">
            <code className="font-mono text-[11px] text-gold-300">{command}</code>
            <button onClick={copy} className="text-slate-300 hover:text-white" title="Copy">
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function DoneCard({ firstName, leadId }: { firstName: string; leadId: string }) {
  return (
    <div className="animate-fade-up rounded-2xl border border-emerald-200 bg-gradient-to-b from-emerald-50 to-white p-6 text-center shadow-card">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white shadow-glow">
        <Check className="h-6 w-6" />
      </div>
      <h3 className="text-lg font-semibold text-ink-900">
        Thank you, {firstName}! 🎉
      </h3>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-600">
        A {AGENCY_NAME} advisor has been notified and will call you shortly with
        hand‑picked, RERA‑verified options that match your requirement.
      </p>
      <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-400">
        <Sparkles className="h-3.5 w-3.5 text-gold-500" />
        Your enquiry was qualified instantly by LeadPilot AI
      </div>
      <Link
        href={`/dashboard?lead=${leadId}`}
        className="mt-4 inline-flex text-xs font-semibold text-brand-600 hover:text-brand-500"
      >
        (Demo) See how this lead looks to the agent →
      </Link>
    </div>
  );
}
