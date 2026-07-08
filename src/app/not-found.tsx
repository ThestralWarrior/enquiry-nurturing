import Link from "next/link";
import { Home, Compass } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

export default function NotFound() {
  return (
    <main className="mesh flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center">
      <BrandMark variant="agency" className="mb-8" />
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-card">
        <Compass className="h-8 w-8 text-gold-500" />
      </div>
      <h1 className="mt-6 text-3xl font-bold tracking-tight text-ink-900">
        Page not found
      </h1>
      <p className="mt-2 max-w-sm text-slate-500">
        This link may have expired or the lead no longer exists.
      </p>
      <Link href="/" className="btn-primary mt-6">
        <Home className="h-4 w-4" /> Back to home
      </Link>
    </main>
  );
}
