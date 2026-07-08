import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  Clock,
  MapPin,
  MessageSquare,
  Phone,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";
import { SkylineLogo, BrandMark } from "@/components/BrandMark";
import InquiryForm from "@/components/InquiryForm";
import { USE_GROQ } from "@/lib/ollama";

export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden mesh">
      <div className="pointer-events-none absolute inset-0 grid-lines" />

      {/* Nav */}
      <header className="relative z-10">
        <nav className="container-app flex items-center justify-between py-5">
          <BrandMark variant="agency" />
          <div className="flex items-center gap-3">
            <a
              href="tel:+911800000000"
              className="hidden items-center gap-2 text-sm font-medium text-slate-600 hover:text-ink-900 sm:flex"
            >
              <Phone className="h-4 w-4" /> 1800‑000‑000
            </a>
            <Link href="/dashboard" className="btn-ghost text-sm">
              Agent Dashboard
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="container-app relative z-10 grid grid-cols-1 items-center gap-12 pb-20 pt-10 lg:grid-cols-[1.05fr_0.95fr] lg:pt-16">
        <div className="animate-fade-up">
          <span className="chip bg-white/80 text-ink-700 shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-gold-500" />
            RERA‑registered · Gurugram · Noida · Dwarka
          </span>

          <h1 className="mt-5 text-balance text-4xl font-bold leading-[1.08] tracking-tight text-ink-900 sm:text-5xl lg:text-6xl">
            Your next home in{" "}
            <span className="gradient-text">Delhi NCR</span>, matched in minutes.
          </h1>

          <p className="mt-5 max-w-xl text-balance text-lg leading-relaxed text-slate-600">
            Tell us what you need and our advisor engages you{" "}
            <span className="font-semibold text-ink-900">instantly</span> — understanding
            your budget, locality and timeline, then hand‑picking RERA‑verified options
            for you. No waiting, no spam calls.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-x-8 gap-y-4">
            <Stat value="2,500+" label="families settled" />
            <div className="h-8 w-px bg-slate-200" />
            <Stat value="18 min" label="avg. first site visit set" />
            <div className="h-8 w-px bg-slate-200" />
            <div className="flex items-center gap-1.5">
              <div className="flex">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-gold-400 text-gold-400" />
                ))}
              </div>
              <span className="text-sm font-medium text-slate-600">4.9 · Google</span>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <TrustChip icon={<Clock className="h-4 w-4" />} text="Replies in seconds, 24×7" />
            <TrustChip icon={<ShieldCheck className="h-4 w-4" />} text="RERA‑verified listings" />
            <TrustChip icon={<MessageSquare className="h-4 w-4" />} text="No spam, ever" />
          </div>
        </div>

        <div className="animate-fade-up [animation-delay:120ms]">
          <div className="relative">
            <div className="absolute -inset-3 -z-10 rounded-[28px] bg-gradient-to-b from-gold-400/20 to-brand-500/10 blur-2xl" />
            <InquiryForm usingGroq={USE_GROQ} />
          </div>
        </div>
      </section>

      {/* Feature band */}
      <section className="relative z-10 border-t border-slate-200/70 bg-white/60 backdrop-blur-sm">
        <div className="container-app grid grid-cols-1 gap-6 py-12 sm:grid-cols-3">
          <Feature
            icon={<Clock className="h-5 w-5" />}
            title="Answered in seconds"
            body="The moment you enquire, you're in a real conversation — not a queue. Speed is why buyers choose us."
          />
          <Feature
            icon={<MapPin className="h-5 w-5" />}
            title="Matched to your need"
            body="We learn your budget, locality and timeline, then shortlist only the homes that genuinely fit."
          />
          <Feature
            icon={<Building2 className="h-5 w-5" />}
            title="RERA‑verified options"
            body="Every option we share is verified — clean titles, real inventory, honest pricing across NCR."
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-200/70">
        <div className="container-app flex flex-col items-center justify-between gap-4 py-8 sm:flex-row">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <SkylineLogo className="h-5 w-5" />
            © {new Date().getFullYear()} Skyline Realty NCR. All rights reserved.
          </div>
          <div className="flex items-center gap-2 rounded-full bg-ink-900 px-3 py-1.5 text-xs font-medium text-slate-300">
            <Sparkles className="h-3.5 w-3.5 text-gold-400" />
            Instant replies powered by{" "}
            <span className="font-semibold text-white">LeadPilot AI</span>
            <span className="text-slate-500">
              {USE_GROQ ? "· instant AI, Delhi NCR" : "· runs on‑premise"}
            </span>
          </div>
        </div>
      </footer>
    </main>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-2xl font-bold tracking-tight text-ink-900">{value}</div>
      <div className="text-sm text-slate-500">{label}</div>
    </div>
  );
}

function TrustChip({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm">
      <span className="text-gold-500">{icon}</span>
      {text}
    </div>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="group rounded-2xl p-1">
      <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-ink-900 text-gold-400 shadow-sm transition group-hover:scale-105">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-ink-900">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{body}</p>
    </div>
  );
}
