import clsx from "clsx";

export function SkylineLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="9" fill="#0b1020" />
      <path
        d="M6 24V15l4-2.5V24H6Zm5 0V11l5-3.5V24h-5Zm6 0V9.5L23 6v18h-6Zm7 0v-8l2 1.2V24h-2Z"
        fill="url(#sky)"
      />
      <circle cx="23.5" cy="9" r="1.4" fill="#f6d98a" />
      <defs>
        <linearGradient id="sky" x1="6" y1="6" x2="26" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f6d98a" />
          <stop offset="1" stopColor="#e6b23e" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function PilotLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="9" fill="#0b1020" />
      <path d="M8 16.5 25 7l-5.5 18-3.7-6.2L8 16.5Z" fill="url(#plt)" />
      <path d="m15.8 18.8 3.7 6.2 1.2-4-4.9-2.2Z" fill="#c9962b" />
      <defs>
        <linearGradient id="plt" x1="8" y1="7" x2="25" y2="25" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f6d98a" />
          <stop offset="1" stopColor="#e6b23e" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function BrandMark({
  variant = "agency",
  className,
  subtitle,
}: {
  variant?: "agency" | "product";
  className?: string;
  subtitle?: string;
}) {
  const isProduct = variant === "product";
  return (
    <div className={clsx("flex items-center gap-2.5", className)}>
      {isProduct ? (
        <PilotLogo className="h-9 w-9" />
      ) : (
        <SkylineLogo className="h-9 w-9" />
      )}
      <div className="leading-tight">
        <div className="flex items-center gap-1.5 font-semibold tracking-tight text-ink-900">
          {isProduct ? (
            <>
              Lead<span className="text-gold-500">Pilot</span>
            </>
          ) : (
            <>
              Skyline<span className="ml-1 font-normal text-slate-500">Realty NCR</span>
            </>
          )}
        </div>
        {subtitle && (
          <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}
