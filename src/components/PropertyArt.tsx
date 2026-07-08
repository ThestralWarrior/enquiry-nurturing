import type { ArtKey } from "@/lib/inventory";

/**
 * Flat-vector illustrations standing in for listing photos. Deliberately
 * illustrative (not photoreal) — this is sample pilot inventory, and inline
 * SVG means the whole demo (including "photos") works fully offline with
 * zero network calls, matching the "runs entirely on your machine" pitch.
 */
function Sky({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 400 240" className="h-full w-full" preserveAspectRatio="xMidYMax slice">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1b2547" />
          <stop offset="100%" stopColor="#293563" />
        </linearGradient>
        <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f6d98a" />
          <stop offset="100%" stopColor="#e6b23e" />
        </linearGradient>
      </defs>
      <rect width="400" height="240" fill="url(#sky)" />
      <circle cx="330" cy="55" r="26" fill="#f0c65f" opacity="0.9" />
      <rect x="0" y="200" width="400" height="40" fill="#0b1020" />
      {children}
    </svg>
  );
}

export function ApartmentArt() {
  return (
    <Sky>
      <rect x="150" y="60" width="110" height="150" fill="#070a14" rx="4" />
      {Array.from({ length: 5 }).map((_, row) =>
        Array.from({ length: 3 }).map((_, col) => (
          <rect
            key={`${row}-${col}`}
            x={162 + col * 32}
            y={75 + row * 27}
            width="20"
            height="16"
            rx="2"
            fill="url(#gold)"
            opacity={0.55 + ((row + col) % 3) * 0.15}
          />
        )),
      )}
      <rect x="60" y="120" width="70" height="90" fill="#111834" rx="3" />
      <rect x="270" y="100" width="80" height="110" fill="#111834" rx="3" />
    </Sky>
  );
}

export function VillaArt() {
  return (
    <Sky>
      <rect x="0" y="185" width="400" height="15" fill="#1b2547" />
      <polygon points="90,150 200,95 310,150" fill="#070a14" />
      <rect x="100" y="150" width="200" height="55" fill="#111834" rx="3" />
      <rect x="130" y="165" width="24" height="24" fill="url(#gold)" opacity="0.7" rx="2" />
      <rect x="188" y="165" width="24" height="40" fill="#070a14" rx="2" />
      <rect x="246" y="165" width="24" height="24" fill="url(#gold)" opacity="0.7" rx="2" />
      <ellipse cx="55" cy="195" rx="22" ry="30" fill="#1b2547" />
      <rect x="49" y="195" width="12" height="20" fill="#111834" />
    </Sky>
  );
}

export function BuilderFloorArt() {
  return (
    <Sky>
      <rect x="120" y="80" width="160" height="130" fill="#070a14" rx="3" />
      {Array.from({ length: 3 }).map((_, row) => (
        <g key={row}>
          {Array.from({ length: 4 }).map((_, col) => (
            <rect
              key={col}
              x={135 + col * 34}
              y={95 + row * 38}
              width="22"
              height="20"
              rx="2"
              fill="url(#gold)"
              opacity={0.5 + row * 0.15}
            />
          ))}
        </g>
      ))}
      <rect x="270" y="150" width="14" height="60" fill="#293563" />
    </Sky>
  );
}

export function PlotArt() {
  return (
    <Sky>
      <rect x="0" y="170" width="400" height="40" fill="#111834" />
      <polygon
        points="70,205 100,150 300,150 330,205"
        fill="none"
        stroke="url(#gold)"
        strokeWidth="3"
        strokeDasharray="10 6"
      />
      <rect x="185" y="120" width="6" height="35" fill="#e6b23e" />
      <polygon points="191,120 220,130 191,140" fill="#f6d98a" />
    </Sky>
  );
}

export function CommercialArt() {
  return (
    <Sky>
      <rect x="110" y="55" width="130" height="155" fill="#070a14" rx="2" />
      <rect x="115" y="60" width="120" height="145" fill="#111834" rx="2" opacity="0.6" />
      {Array.from({ length: 8 }).map((_, row) => (
        <rect
          key={row}
          x="122"
          y={68 + row * 17}
          width="106"
          height="10"
          fill="url(#gold)"
          opacity={0.25 + (row % 2) * 0.2}
        />
      ))}
      <rect x="150" y="180" width="50" height="12" fill="#e6b23e" rx="2" />
    </Sky>
  );
}

const ART: Record<ArtKey, React.ComponentType> = {
  apartment: ApartmentArt,
  villa: VillaArt,
  builderFloor: BuilderFloorArt,
  plot: PlotArt,
  commercial: CommercialArt,
};

export function PropertyArt({ art, className }: { art: ArtKey; className?: string }) {
  const Art = ART[art];
  return (
    <div className={className}>
      <Art />
    </div>
  );
}
