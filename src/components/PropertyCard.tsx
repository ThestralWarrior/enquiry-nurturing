import clsx from "clsx";
import { MapPin, Maximize, BedDouble } from "lucide-react";
import type { PropertyListing } from "@/lib/inventory";
import { formatPriceCr } from "@/lib/format";
import { PropertyArt } from "./PropertyArt";

export function PropertyCard({
  listing,
  compact = false,
}: {
  listing: PropertyListing;
  compact?: boolean;
}) {
  return (
    <div
      className={clsx(
        "overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card transition hover:shadow-lift",
        compact ? "w-full" : "w-64 shrink-0 sm:w-72",
      )}
    >
      <div className={clsx("relative", compact ? "h-28" : "h-36")}>
        <PropertyArt art={listing.art} className="h-full w-full" />
        <span className="absolute left-2 top-2 rounded-full bg-ink-900/80 px-2 py-0.5 text-[10px] font-medium text-gold-300 backdrop-blur">
          Sample listing
        </span>
        <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-ink-800 shadow-sm">
          {listing.possession}
        </span>
      </div>
      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-semibold leading-tight text-ink-900">{listing.title}</h4>
          <span className="shrink-0 text-sm font-bold text-gold-600">
            {formatPriceCr(listing.priceCr)}
          </span>
        </div>
        <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
          <MapPin className="h-3 w-3 shrink-0" />
          {listing.locality}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          {listing.bhk && (
            <span className="flex items-center gap-1">
              <BedDouble className="h-3 w-3" /> {listing.bhk}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Maximize className="h-3 w-3" /> {listing.areaSqft.toLocaleString("en-IN")} sq ft
          </span>
        </div>
        {!compact && (
          <div className="mt-2.5 flex flex-wrap gap-1">
            {listing.amenities.slice(0, 2).map((a) => (
              <span
                key={a}
                className="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-100"
              >
                {a}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function PropertyCardRow({
  listings,
  caption,
}: {
  listings: PropertyListing[];
  caption?: string;
}) {
  if (listings.length === 0) return null;
  return (
    <div className="animate-fade-up">
      {caption && <p className="mb-2 text-xs font-medium text-slate-500">{caption}</p>}
      <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
        {listings.map((l) => (
          <PropertyCard key={l.id} listing={l} />
        ))}
      </div>
    </div>
  );
}
