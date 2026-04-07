"use client";

interface CrawlProgressAnimationProps {
  url: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  dealerName?: string;
  /** "crawling" | "analyzing" | "completed" | "failed" */
  status: "crawling" | "analyzing" | "completed" | "failed";
}

const STATUS_LABELS: Record<CrawlProgressAnimationProps["status"], string> = {
  crawling: "Website wird geladen…",
  analyzing: "KI analysiert Ihre Marke…",
  completed: "Analyse abgeschlossen!",
  failed: "Website konnte nicht geladen werden.",
};

export function CrawlProgressAnimation({
  url,
  logoUrl,
  primaryColor,
  dealerName,
  status,
}: CrawlProgressAnimationProps) {
  const progress =
    status === "crawling" ? 33 : status === "analyzing" ? 66 : 100;
  const isFailed = status === "failed";

  return (
    <div className="flex flex-col items-center gap-6 py-8 px-4">
      {/* Mini branding preview — fills in as data arrives */}
      <div
        className="w-full max-w-xs rounded-2xl shadow-lg overflow-hidden border border-gray-100"
        style={{ borderTop: `4px solid ${primaryColor ?? "#2563EB"}` }}
      >
        <div className="p-5 bg-white space-y-3">
          {/* Logo area */}
          <div className="flex items-center gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="Logo"
                className="h-10 w-auto object-contain animate-[fadeIn_0.5s_ease-in]"
              />
            ) : (
              <div
                className="w-10 h-10 rounded-lg animate-pulse"
                style={{ backgroundColor: primaryColor ?? "#E5E7EB" }}
              />
            )}
            <div className="flex-1">
              {dealerName ? (
                <p className="text-sm font-bold text-gray-900 animate-[fadeIn_0.5s_ease-in]">
                  {dealerName}
                </p>
              ) : (
                <div className="h-3 rounded bg-gray-200 animate-pulse w-32" />
              )}
            </div>
          </div>

          {/* Color swatch */}
          <div className="flex gap-2">
            {["primaryColor", "secondary", "accent"].map((_, i) => (
              <div
                key={i}
                className="w-6 h-6 rounded-full transition-all duration-500"
                style={{
                  backgroundColor:
                    primaryColor && i === 0 ? primaryColor : "#E5E7EB",
                  opacity: primaryColor ? 1 : 0.4,
                }}
              />
            ))}
          </div>

          {/* Placeholder lines */}
          <div className="space-y-1.5">
            <div className="h-2.5 bg-gray-100 rounded animate-pulse w-full" />
            <div className="h-2.5 bg-gray-100 rounded animate-pulse w-4/5" />
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-xs space-y-2">
        <div className="flex justify-between text-xs text-gray-500">
          <span className="truncate max-w-[180px]">{url}</span>
          <span>{isFailed ? "–" : `${progress}%`}</span>
        </div>
        <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${isFailed ? 100 : progress}%`,
              backgroundColor: isFailed ? "#EF4444" : (primaryColor ?? "#2563EB"),
            }}
          />
        </div>
        <p className="text-sm text-center text-gray-600">
          {STATUS_LABELS[status]}
        </p>
      </div>
    </div>
  );
}
