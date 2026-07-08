"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  ArrowLeft,
  BedDouble,
  Building2,
  CalendarClock,
  Check,
  Copy,
  Flame,
  Goal,
  IndianRupee,
  Inbox,
  MapPin,
  MessageSquareText,
  Phone,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  Wallet,
  Loader2,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import type { Lead, LeadTemperature } from "@/lib/types";
import {
  initials,
  relativeTime,
  clockTime,
  prettyPhone,
  waLink,
  TEMPERATURE_META,
} from "@/lib/format";
import { ADVISOR_NAME } from "@/lib/prompts";
import { matchProperties } from "@/lib/matchProperties";
import { PropertyCardRow } from "@/components/PropertyCard";
import HealthPill, { useHealth } from "@/components/HealthPill";

type Filter = "all" | LeadTemperature;

export default function Dashboard() {
  const health = useHealth(10000);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [tab, setTab] = useState<"brief" | "transcript">("brief");

  const loadLeads = useCallback(async () => {
    try {
      const res = await fetch("/api/leads", { cache: "no-store" });
      const data = (await res.json()) as { leads: Lead[] };
      setLeads(data.leads ?? []);
      setLoaded(true);
    } catch {
      setLoaded(true);
    }
  }, []);

  // Initial load + live polling.
  useEffect(() => {
    loadLeads();
    const id = setInterval(loadLeads, 5000);
    return () => clearInterval(id);
  }, [loadLeads]);

  // Deep-link ?lead=<id> from the chat page.
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("lead");
    if (param) setSelectedId(param);
  }, []);

  const selectLead = useCallback(
    (lead: Lead) => {
      setSelectedId(lead.id);
      setTab("brief");
      if (!lead.seen) {
        setLeads((prev) =>
          prev.map((l) => (l.id === lead.id ? { ...l, seen: true } : l)),
        );
        fetch(`/api/leads/${lead.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ seen: true }),
        }).catch(() => undefined);
      }
    },
    [],
  );

  const analyze = useCallback(async (id: string) => {
    setAnalyzingId(id);
    try {
      const res = await fetch(`/api/leads/${id}/analyze`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.lead) {
        setLeads((prev) => prev.map((l) => (l.id === id ? data.lead : l)));
      }
    } catch {
      /* ignore — UI shows engine status via pill */
    } finally {
      setAnalyzingId(null);
    }
  }, []);

  const selected = useMemo(
    () => leads.find((l) => l.id === selectedId) ?? null,
    [leads, selectedId],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((l) => {
      if (filter !== "all" && (l.qualification?.temperature ?? "new") !== filter)
        return false;
      if (!q) return true;
      return (
        l.name.toLowerCase().includes(q) ||
        l.phone.includes(q) ||
        (l.locality ?? "").toLowerCase().includes(q) ||
        l.initialMessage.toLowerCase().includes(q)
      );
    });
  }, [leads, query, filter]);

  const stats = useMemo(() => {
    const analyzed = leads.filter((l) => l.analyzedAt);
    const hot = leads.filter((l) => l.qualification?.temperature === "hot").length;
    const avg =
      analyzed.length > 0
        ? Math.round(
            analyzed.reduce((s, l) => s + (l.qualification?.score ?? 0), 0) /
              analyzed.length,
          )
        : 0;
    const isToday = (ts: number) =>
      new Date(ts).toDateString() === new Date().toDateString();
    return {
      today: leads.filter((l) => isToday(l.createdAt)).length,
      hot,
      qualified: analyzed.length,
      avg,
    };
  }, [leads]);

  return (
    <div className="min-h-[100dvh] bg-slate-100">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1400px] items-center gap-4 px-4 py-3 sm:px-6">
          <ProductBrand />
          <div className="ml-auto flex items-center gap-2.5">
            <span className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100 sm:inline-flex">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Live
            </span>
            <HealthPill health={health} />
            <Link href="/" className="btn-ghost hidden text-sm sm:inline-flex">
              <ExternalLink className="h-4 w-4" /> Public site
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6">
        {/* Stats */}
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={<Inbox className="h-4 w-4" />} label="New today" value={stats.today} tone="brand" />
          <StatCard icon={<Flame className="h-4 w-4" />} label="Hot leads" value={stats.hot} tone="rose" />
          <StatCard icon={<Sparkles className="h-4 w-4" />} label="Qualified by AI" value={stats.qualified} tone="gold" />
          <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Avg. score" value={stats.avg} tone="emerald" />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[380px_1fr]">
          {/* Lead list */}
          <aside className={clsx("min-w-0", selectedId && "hidden lg:block")}>
            <div className="card overflow-hidden">
              <div className="border-b border-slate-100 p-3">
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search name, phone, area…"
                    className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                  />
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {(["all", "hot", "warm", "cold", "new"] as Filter[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={clsx(
                        "rounded-full px-3 py-1 text-xs font-semibold capitalize transition",
                        filter === f
                          ? "bg-ink-900 text-white"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200",
                      )}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <div className="max-h-[calc(100dvh-320px)] min-h-[300px] overflow-y-auto">
                {!loaded ? (
                  <ListSkeleton />
                ) : filtered.length === 0 ? (
                  <EmptyList hasLeads={leads.length > 0} />
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {filtered.map((lead) => (
                      <LeadRow
                        key={lead.id}
                        lead={lead}
                        active={lead.id === selectedId}
                        onClick={() => selectLead(lead)}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </aside>

          {/* Detail */}
          <section className={clsx("min-w-0", !selectedId && "hidden lg:block")}>
            {selected ? (
              <LeadDetail
                lead={selected}
                analyzing={analyzingId === selected.id}
                onAnalyze={() => analyze(selected.id)}
                onBack={() => setSelectedId(null)}
                tab={tab}
                setTab={setTab}
              />
            ) : (
              <DetailEmpty />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function ProductBrand() {
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="h-9 w-9" aria-hidden="true">
        <rect width="32" height="32" rx="9" fill="#0b1020" />
        <path d="M8 16.5 25 7l-5.5 18-3.7-6.2L8 16.5Z" fill="#f0c65f" />
        <path d="m15.8 18.8 3.7 6.2 1.2-4-4.9-2.2Z" fill="#c9962b" />
      </svg>
      <div className="leading-tight">
        <div className="font-semibold tracking-tight text-ink-900">
          Lead<span className="text-gold-500">Pilot</span>
        </div>
        <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
          Speed‑to‑Lead · Skyline Realty NCR
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "brand" | "rose" | "gold" | "emerald";
}) {
  const tones: Record<string, string> = {
    brand: "bg-brand-500/10 text-brand-600",
    rose: "bg-rose-500/10 text-rose-600",
    gold: "bg-gold-500/15 text-gold-600",
    emerald: "bg-emerald-500/10 text-emerald-600",
  };
  return (
    <div className="card flex items-center gap-3 p-4">
      <div className={clsx("flex h-9 w-9 items-center justify-center rounded-lg", tones[tone])}>
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold leading-none tracking-tight text-ink-900">
          {value}
        </div>
        <div className="mt-1 text-xs text-slate-500">{label}</div>
      </div>
    </div>
  );
}

function LeadRow({
  lead,
  active,
  onClick,
}: {
  lead: Lead;
  active: boolean;
  onClick: () => void;
}) {
  const temp = lead.qualification?.temperature ?? "new";
  const meta = TEMPERATURE_META[temp];
  return (
    <li>
      <button
        onClick={onClick}
        className={clsx(
          "flex w-full items-start gap-3 px-4 py-3.5 text-left transition",
          active ? "bg-gold-50/70" : "hover:bg-slate-50",
        )}
      >
        <div className="relative">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-ink-700 to-ink-900 text-sm font-semibold text-white">
            {initials(lead.name)}
          </div>
          <span className={clsx("absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white", meta.dot)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold text-ink-900">{lead.name}</span>
            {!lead.seen && (
              <span className="shrink-0 rounded-full bg-brand-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                New
              </span>
            )}
            <span className="ml-auto shrink-0 text-[11px] text-slate-400">
              {relativeTime(lead.createdAt)}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-500">{lead.initialMessage}</p>
          <div className="mt-1.5 flex items-center gap-2">
            <span className={clsx("rounded-full px-2 py-0.5 text-[10px] font-semibold", meta.badge)}>
              {meta.label}
            </span>
            {lead.qualification?.score != null && lead.analyzedAt && (
              <span className="text-[11px] font-medium text-slate-400">
                Score {lead.qualification.score}
              </span>
            )}
            {lead.locality && (
              <span className="flex items-center gap-0.5 truncate text-[11px] text-slate-400">
                <MapPin className="h-3 w-3" /> {lead.locality}
              </span>
            )}
          </div>
        </div>
      </button>
    </li>
  );
}

function LeadDetail({
  lead,
  analyzing,
  onAnalyze,
  onBack,
  tab,
  setTab,
}: {
  lead: Lead;
  analyzing: boolean;
  onAnalyze: () => void;
  onBack: () => void;
  tab: "brief" | "transcript";
  setTab: (t: "brief" | "transcript") => void;
}) {
  const temp = lead.qualification?.temperature ?? "new";
  const meta = TEMPERATURE_META[temp];
  const analyzed = !!lead.analyzedAt;

  return (
    <div className="card animate-fade-in overflow-hidden">
      {/* Header */}
      <div className="border-b border-slate-100 bg-gradient-to-b from-white to-slate-50/60 p-5">
        <div className="flex items-start gap-4">
          <button onClick={onBack} className="mt-1 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 lg:hidden">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-ink-700 to-ink-900 text-lg font-bold text-white">
            {initials(lead.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-ink-900">{lead.name}</h2>
              <span className={clsx("rounded-full px-2.5 py-0.5 text-xs font-semibold", meta.badge)}>
                {temp === "hot" && <Flame className="mr-0.5 inline h-3 w-3" />}
                {meta.label} lead
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
              <a href={`tel:+91${lead.phone}`} className="flex items-center gap-1.5 font-medium text-ink-800 hover:text-brand-600">
                <Phone className="h-3.5 w-3.5" /> {prettyPhone(lead.phone)}
              </a>
              <span className="flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-slate-300" /> via {lead.source}
              </span>
              <span className="text-slate-400">{relativeTime(lead.createdAt)}</span>
            </div>
          </div>
          {analyzed && lead.qualification && (
            <ScoreRing score={lead.qualification.score} temp={temp} />
          )}
        </div>

        {/* Primary action: WhatsApp the suggested reply */}
        {analyzed && lead.suggestedReply && (
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={waLink(lead.phone, lead.suggestedReply)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn bg-emerald-500 text-white hover:bg-emerald-600"
            >
              <MessageSquareText className="h-4 w-4" /> Reply on WhatsApp
            </a>
            <a href={`tel:+91${lead.phone}`} className="btn-ghost">
              <Phone className="h-4 w-4" /> Call now
            </a>
            <button onClick={onAnalyze} disabled={analyzing} className="btn-ghost ml-auto">
              {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Re‑run AI
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-100 px-4 pt-3">
        <TabButton active={tab === "brief"} onClick={() => setTab("brief")}>
          <Sparkles className="h-4 w-4" /> AI brief
        </TabButton>
        <TabButton active={tab === "transcript"} onClick={() => setTab("transcript")}>
          <MessageSquareText className="h-4 w-4" /> Transcript
          <span className="ml-1 rounded-full bg-slate-100 px-1.5 text-[10px] font-semibold text-slate-500">
            {lead.messages.filter((m) => m.role !== "system").length}
          </span>
        </TabButton>
      </div>

      <div className="p-5">
        {tab === "brief" ? (
          <BriefTab lead={lead} analyzing={analyzing} onAnalyze={onAnalyze} />
        ) : (
          <Transcript lead={lead} />
        )}
      </div>
    </div>
  );
}

function BriefTab({
  lead,
  analyzing,
  onAnalyze,
}: {
  lead: Lead;
  analyzing: boolean;
  onAnalyze: () => void;
}) {
  if (!lead.analyzedAt || !lead.qualification) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
          <Sparkles className="h-6 w-6 text-gold-500" />
        </div>
        <h3 className="text-base font-semibold text-ink-900">Not qualified yet</h3>
        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
          Run the local AI to extract this lead's budget, locality and intent, and
          generate a ready‑to‑send reply.
        </p>
        <button onClick={onAnalyze} disabled={analyzing} className="btn-gold mt-4">
          {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {analyzing ? "Qualifying…" : "Run AI analysis"}
        </button>
        {analyzing && (
          <p className="mt-3 text-xs text-slate-400">
            Reading the conversation on‑device — this takes a few seconds.
          </p>
        )}
      </div>
    );
  }

  const q = lead.qualification;
  const matches = matchProperties({
    locality: q.locality,
    bhk: q.bhk,
    propertyType: q.propertyType,
    budgetMaxCr: q.budgetMaxCr,
    intent: q.intent,
  });

  return (
    <div className="space-y-5">
      {/* Qualification grid */}
      <div>
        <SectionTitle>Qualification</SectionTitle>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <QualItem icon={<IndianRupee className="h-4 w-4" />} label="Budget" value={q.budget} />
          <QualItem icon={<MapPin className="h-4 w-4" />} label="Locality" value={q.locality} />
          <QualItem icon={<BedDouble className="h-4 w-4" />} label="Config" value={q.bhk} />
          <QualItem icon={<Building2 className="h-4 w-4" />} label="Type" value={q.propertyType} />
          <QualItem icon={<Target className="h-4 w-4" />} label="Intent" value={capitalize(q.intent)} />
          <QualItem icon={<CalendarClock className="h-4 w-4" />} label="Timeline" value={q.timeline} />
          <QualItem icon={<Wallet className="h-4 w-4" />} label="Financing" value={q.financing} />
          <QualItem icon={<Goal className="h-4 w-4" />} label="Purpose" value={q.purpose} />
        </div>
      </div>

      {/* AI-shortlisted properties */}
      {matches.length > 0 && (
        <div>
          <SectionTitle>AI‑shortlisted properties</SectionTitle>
          <PropertyCardRow listings={matches} />
        </div>
      )}

      {/* Summary */}
      {lead.summary && (
        <div>
          <SectionTitle>AI summary</SectionTitle>
          <p className="rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-ink-800 ring-1 ring-slate-100">
            {lead.summary}
          </p>
        </div>
      )}

      {/* Next action */}
      {lead.nextAction && (
        <div className="flex items-start gap-2.5 rounded-xl bg-brand-500/5 p-4 ring-1 ring-brand-500/15">
          <Target className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-brand-600">
              Recommended next action
            </div>
            <p className="mt-0.5 text-sm font-medium text-ink-800">{lead.nextAction}</p>
          </div>
        </div>
      )}

      {/* Suggested reply */}
      {lead.suggestedReply && (
        <SuggestedReply text={lead.suggestedReply} phone={lead.phone} />
      )}

      {q.notes && (
        <p className="text-xs text-slate-400">
          <span className="font-semibold">Note:</span> {q.notes}
        </p>
      )}
    </div>
  );
}

function SuggestedReply({ text, phone }: { text: string; phone: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };
  return (
    <div>
      <div className="flex items-center justify-between">
        <SectionTitle>Suggested reply</SectionTitle>
        <button
          onClick={copy}
          className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-ink-800"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="relative rounded-2xl rounded-tl-md bg-emerald-50 p-4 ring-1 ring-emerald-100">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-800">{text}</p>
        <div className="mt-3 flex gap-2">
          <a
            href={waLink(phone, text)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn bg-emerald-500 px-3 py-1.5 text-xs text-white hover:bg-emerald-600"
          >
            <MessageSquareText className="h-3.5 w-3.5" /> Send on WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}

function Transcript({ lead }: { lead: Lead }) {
  const msgs = lead.messages.filter((m) => m.role !== "system");
  return (
    <div className="space-y-3">
      {msgs.map((m, i) => {
        const isAdvisor = m.role === "assistant";
        return (
          <div key={i} className={clsx("flex gap-2.5", !isAdvisor && "flex-row-reverse")}>
            <div
              className={clsx(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                isAdvisor
                  ? "bg-gradient-to-br from-gold-400 to-gold-600 text-ink-900"
                  : "bg-ink-900 text-white",
              )}
            >
              {isAdvisor ? ADVISOR_NAME[0] : initials(lead.name)}
            </div>
            <div className="max-w-[78%]">
              <div
                className={clsx(
                  "rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                  isAdvisor
                    ? "rounded-tl-md bg-white text-ink-800 ring-1 ring-slate-100"
                    : "rounded-tr-md bg-ink-900 text-white",
                )}
              >
                <span className="whitespace-pre-wrap">{m.content}</span>
              </div>
              <div className={clsx("mt-1 text-[10px] text-slate-400", !isAdvisor && "text-right")}>
                {isAdvisor ? ADVISOR_NAME : lead.name.split(" ")[0]} · {clockTime(m.ts)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ScoreRing({ score, temp }: { score: number; temp: LeadTemperature }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const meta = TEMPERATURE_META[temp];
  return (
    <div className="relative hidden h-16 w-16 shrink-0 sm:block">
      <svg viewBox="0 0 56 56" className="h-16 w-16 -rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" stroke="#eef1f6" strokeWidth="6" />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          className={meta.ring}
          stroke="currentColor"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold leading-none text-ink-900">{score}</span>
        <span className="text-[9px] uppercase tracking-wide text-slate-400">score</span>
      </div>
    </div>
  );
}

function QualItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3">
      <div className="flex items-center gap-1.5 text-slate-400">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <div className={clsx("mt-1 text-sm font-semibold", value ? "text-ink-900" : "text-slate-300")}>
        {value ?? "—"}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex items-center gap-1.5 rounded-t-lg px-3.5 py-2 text-sm font-semibold transition",
        active
          ? "border-b-2 border-gold-500 text-ink-900"
          : "border-b-2 border-transparent text-slate-400 hover:text-slate-600",
      )}
    >
      {children}
    </button>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
      {children}
    </h4>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-1 p-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <div className="h-10 w-10 rounded-full bg-slate-100" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 rounded bg-slate-100" />
            <div className="h-2.5 w-2/3 rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyList({ hasLeads }: { hasLeads: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <Inbox className="h-8 w-8 text-slate-300" />
      <p className="mt-2 text-sm font-medium text-slate-500">
        {hasLeads ? "No leads match your filter" : "No leads yet"}
      </p>
      {!hasLeads && (
        <Link href="/" className="mt-2 text-xs font-semibold text-brand-600 hover:text-brand-500">
          Try the inquiry form →
        </Link>
      )}
    </div>
  );
}

function DetailEmpty() {
  return (
    <div className="card flex min-h-[400px] flex-col items-center justify-center p-10 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
        <MessageSquareText className="h-8 w-8 text-slate-300" />
      </div>
      <h3 className="text-lg font-semibold text-ink-900">Select a lead</h3>
      <p className="mt-1 max-w-xs text-sm text-slate-500">
        Pick a lead to see its AI‑qualified brief, full transcript and a
        ready‑to‑send reply.
      </p>
    </div>
  );
}

function capitalize(s: string | null): string | null {
  if (!s) return null;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
