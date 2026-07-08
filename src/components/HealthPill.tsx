"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Check, Copy, Cpu, ChevronDown } from "lucide-react";

export interface HealthState {
  reachable: boolean;
  version: string | null;
  models: string[];
  modelInstalled: boolean;
  requiredModel: string;
  analyzeModelInstalled: boolean;
  analyzeModel: string;
  baseUrl: string;
  ok: boolean;
  remediation: {
    code: string;
    title: string;
    message: string;
    fix: string;
  } | null;
}

type Status = "loading" | "ok" | "model_missing" | "offline";

function statusOf(h: HealthState | null): Status {
  if (!h) return "loading";
  if (h.ok) return "ok";
  if (h.reachable && !h.modelInstalled) return "model_missing";
  return "offline";
}

const META: Record<Status, { label: string; dot: string; text: string; ring: string }> = {
  loading: { label: "Checking engine…", dot: "bg-slate-300 animate-pulse", text: "text-slate-500", ring: "ring-slate-200" },
  ok: { label: "Local AI online", dot: "bg-emerald-500", text: "text-emerald-700", ring: "ring-emerald-200" },
  model_missing: { label: "Model not installed", dot: "bg-amber-500", text: "text-amber-700", ring: "ring-amber-200" },
  offline: { label: "AI engine offline", dot: "bg-rose-500", text: "text-rose-700", ring: "ring-rose-200" },
};

/** Pull the first `backtick command` out of remediation text for a copy button. */
function extractCommand(fix?: string): string | null {
  if (!fix) return null;
  const m = fix.match(/`([^`]+)`/);
  return m ? m[1] : null;
}

export function useHealth(pollMs = 8000) {
  const [health, setHealth] = useState<HealthState | null>(null);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        const data = (await res.json()) as HealthState;
        if (alive) setHealth(data);
      } catch {
        if (alive)
          setHealth({
            reachable: false,
            version: null,
            models: [],
            modelInstalled: false,
            requiredModel: "qwen2.5:1.5b",
            analyzeModelInstalled: false,
            analyzeModel: "qwen2.5:1.5b",
            baseUrl: "http://127.0.0.1:11434",
            ok: false,
            remediation: {
              code: "ollama_unreachable",
              title: "Local AI engine is offline",
              message: "Could not reach the app health endpoint.",
              fix: "Start Ollama (run `ollama serve`) and reload.",
            },
          });
      }
    };
    load();
    const id = setInterval(load, pollMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [pollMs]);
  return health;
}

export default function HealthPill({ health }: { health: HealthState | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const status = statusOf(health);
  const meta = META[status];
  const command = extractCommand(health?.remediation?.fix);

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
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          "inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold shadow-sm ring-1 transition hover:shadow",
          meta.ring,
          meta.text,
        )}
        title="Local AI engine status"
      >
        <span className="relative flex h-2 w-2">
          {status === "ok" && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          )}
          <span className={clsx("relative inline-flex h-2 w-2 rounded-full", meta.dot)} />
        </span>
        {meta.label}
        <ChevronDown className={clsx("h-3.5 w-3.5 opacity-50 transition", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 animate-fade-in rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-lift">
          <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Cpu className="h-4 w-4 text-ink-700" />
            <span className="text-sm font-semibold text-ink-900">Local AI engine</span>
            <span className="ml-auto text-[11px] font-medium text-slate-400">Ollama</span>
          </div>

          <dl className="space-y-1.5 text-xs">
            <Row label="Status" value={meta.label} valueClass={meta.text} />
            <Row label="Endpoint" value={health?.baseUrl ?? "—"} mono />
            <Row label="Model" value={health?.requiredModel ?? "—"} mono />
            {health?.version && <Row label="Version" value={`v${health.version}`} mono />}
            <Row
              label="Installed"
              value={health?.modelInstalled ? "Yes" : "No"}
              valueClass={health?.modelInstalled ? "text-emerald-700" : "text-amber-700"}
            />
            {health && health.analyzeModel !== health.requiredModel && (
              <>
                <Row label="Analysis model" value={health.analyzeModel} mono />
                <Row
                  label="Analysis installed"
                  value={health.analyzeModelInstalled ? "Yes" : "No"}
                  valueClass={health.analyzeModelInstalled ? "text-emerald-700" : "text-amber-700"}
                />
              </>
            )}
          </dl>

          {health?.remediation && (
            <div className="mt-3 rounded-xl bg-amber-50 p-3 ring-1 ring-amber-100">
              <p className="text-xs font-semibold text-amber-800">
                {health.remediation.title}
              </p>
              <p className="mt-0.5 text-xs text-amber-700">{health.remediation.message}</p>
              {command && (
                <div className="mt-2 flex items-center gap-2 rounded-lg bg-ink-900 px-2.5 py-1.5">
                  <code className="flex-1 truncate font-mono text-[11px] text-gold-300">
                    {command}
                  </code>
                  <button
                    onClick={copy}
                    className="shrink-0 rounded-md p-1 text-slate-300 hover:bg-white/10 hover:text-white"
                    title="Copy command"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              )}
            </div>
          )}

          {status === "ok" && (
            <p className="mt-3 text-xs text-slate-500">
              Running privately on this machine — no cloud, no per-message cost.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  valueClass,
}: {
  label: string;
  value: string;
  mono?: boolean;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-400">{label}</dt>
      <dd className={clsx("truncate font-medium text-ink-800", mono && "font-mono text-[11px]", valueClass)}>
        {value}
      </dd>
    </div>
  );
}
