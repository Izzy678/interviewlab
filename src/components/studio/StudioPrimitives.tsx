import { cn } from "@/lib/utils";

export function Waveform({
  active = true,
  className,
  bars = 28,
}: {
  active?: boolean;
  className?: string;
  bars?: number;
}) {
  return (
    <div
      className={cn("flex h-8 items-center justify-center gap-[3px]", className)}
      aria-label={active ? "Audio waveform active" : "Audio waveform idle"}
    >
      {Array.from({ length: bars }).map((_, index) => {
        const height = 20 + ((index * 17) % 75);
        return (
          <span
            key={index}
            className={cn(
              "w-[2px] rounded-full bg-current transition-opacity",
              active ? "animate-speaking opacity-70" : "opacity-20",
            )}
            style={{
              height: `${height}%`,
              animationDelay: `${(index % 7) * 80}ms`,
              animationDuration: `${720 + (index % 5) * 90}ms`,
            }}
          />
        );
      })}
    </div>
  );
}

export function PresenceOrb({
  active = true,
  size = "md",
  className,
}: {
  active?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    sm: "h-2.5 w-2.5",
    md: "h-16 w-16",
    lg: "h-24 w-24",
  };

  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center rounded-full",
        sizes[size],
        className,
      )}
      aria-hidden="true"
    >
      <span
        className={cn(
          "absolute inset-0 rounded-full bg-primary/12 blur-md",
          active && "animate-breathe",
        )}
      />
      <span className="absolute inset-[18%] rounded-full border border-primary/20 bg-primary/10" />
      <span
        className={cn(
          "relative rounded-full bg-primary",
          size === "sm" ? "h-2 w-2" : size === "lg" ? "h-5 w-5" : "h-3.5 w-3.5",
          active && "shadow-[0_0_24px_color-mix(in_oklab,var(--color-primary)_45%,transparent)]",
        )}
      />
    </span>
  );
}

export function StageLabel({
  children,
  active = false,
  className,
}: {
  children: React.ReactNode;
  active?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em]",
        active ? "text-foreground" : "text-muted-foreground",
        className,
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          active ? "bg-primary shadow-[0_0_10px_var(--color-primary)]" : "bg-border",
        )}
      />
      {children}
    </span>
  );
}
