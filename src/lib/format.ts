import type { LeadTemperature } from "./types";

/** Format a numeric ₹ crore value the way NCR listings are priced: "₹2.1 Cr" or "₹85 L". */
export function formatPriceCr(priceCr: number): string {
  if (priceCr >= 1) {
    const trimmed = priceCr % 1 === 0 ? priceCr.toFixed(0) : priceCr.toFixed(2).replace(/0$/, "");
    return `₹${trimmed} Cr`;
  }
  return `₹${Math.round(priceCr * 100)} L`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function relativeTime(ts: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - ts);
  const sec = Math.floor(diff / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "yesterday";
  if (day < 7) return `${day} days ago`;
  return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function clockTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Normalise an Indian mobile number to 10 digits, dropping +91 / 0 prefixes. */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length > 10 && digits.startsWith("91")) return digits.slice(-10);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits.slice(-10);
}

export function prettyPhone(phone: string): string {
  const d = normalizePhone(phone);
  if (d.length !== 10) return phone;
  return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
}

export function waLink(phone: string, message: string): string {
  const d = normalizePhone(phone);
  return `https://wa.me/91${d}?text=${encodeURIComponent(message)}`;
}

export const TEMPERATURE_META: Record<
  LeadTemperature,
  { label: string; dot: string; badge: string; ring: string }
> = {
  hot: {
    label: "Hot",
    dot: "bg-rose-500",
    badge: "bg-rose-500/10 text-rose-600 ring-1 ring-rose-500/20",
    ring: "text-rose-500",
  },
  warm: {
    label: "Warm",
    dot: "bg-amber-500",
    badge: "bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20",
    ring: "text-amber-500",
  },
  cold: {
    label: "Cold",
    dot: "bg-sky-500",
    badge: "bg-sky-500/10 text-sky-600 ring-1 ring-sky-500/20",
    ring: "text-sky-500",
  },
  new: {
    label: "New",
    dot: "bg-slate-400",
    badge: "bg-slate-500/10 text-slate-600 ring-1 ring-slate-500/20",
    ring: "text-slate-400",
  },
};

export function scoreToTemperature(score: number): LeadTemperature {
  if (score >= 75) return "hot";
  if (score >= 50) return "warm";
  if (score >= 25) return "cold";
  return "new";
}
