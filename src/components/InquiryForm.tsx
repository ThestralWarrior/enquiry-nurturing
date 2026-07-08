"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, ShieldCheck, Zap } from "lucide-react";

export default function InquiryForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onPhoneChange = (v: string) => {
    setPhone(v.replace(/[^\d]/g, "").slice(0, 10));
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (name.trim().length < 2) return setError("Please enter your name.");
    if (phone.length !== 10) return setError("Please enter a valid 10-digit mobile number.");
    if (message.trim().length < 3)
      return setError("Tell us a little about what you're looking for.");

    setSubmitting(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone,
          initialMessage: message.trim(),
          source: "Website",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      router.push(`/chat/${data.lead.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-slate-100 bg-gradient-to-b from-white to-slate-50/60 px-6 py-5">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-100">
            <Zap className="h-3 w-3" /> Instant response
          </span>
          <span className="text-xs text-slate-400">Avg. reply in seconds, 24×7</span>
        </div>
        <h3 className="mt-3 text-lg font-semibold text-ink-900">
          Find your home in Delhi NCR
        </h3>
        <p className="mt-0.5 text-sm text-slate-500">
          Share your requirement — our advisor Priya will start helping you right away.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4 px-6 py-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="name">Full name</label>
            <input
              id="name"
              className="input"
              placeholder="e.g. Rahul Verma"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>
          <div>
            <label className="label" htmlFor="phone">Mobile number</label>
            <div className="flex items-center rounded-xl border border-slate-200 bg-white shadow-sm transition focus-within:border-gold-400 focus-within:ring-4 focus-within:ring-gold-400/15">
              <span className="select-none border-r border-slate-200 px-3 py-2.5 text-sm text-slate-500">
                +91
              </span>
              <input
                id="phone"
                className="w-full rounded-r-xl bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-slate-400"
                placeholder="98XXXXXXXX"
                inputMode="numeric"
                value={phone}
                onChange={(e) => onPhoneChange(e.target.value)}
                autoComplete="tel"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="message">What are you looking for?</label>
          <textarea
            id="message"
            className="input min-h-[84px] resize-none"
            placeholder="e.g. Ready-to-move 3 BHK in Sector 65 Gurugram, under ₹2.5 Cr, moving in 1–2 months."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>

        {error && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 ring-1 ring-rose-100">
            {error}
          </p>
        )}

        <button type="submit" className="btn-gold w-full py-3 text-base" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Connecting you with Priya…
            </>
          ) : (
            <>
              Get instant help
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>

        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5" />
          Your details stay private — processed locally, never sold.
        </p>
      </form>
    </div>
  );
}
