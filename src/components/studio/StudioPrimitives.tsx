import { cn } from "@/lib/utils";

/* ── Types ─────────────────────────────────────────────── */

export type StagePhase =
  | "connecting"
  | "speaking"
  | "listening"
  | "awaiting"
  | "thinking"
  | "concluding"
  | "ended";

/* ══════════════════════════════════════════════════════════
   Waveform — animated speaking bars
   ══════════════════════════════════════════════════════════ */

interface WaveformProps {
  active: boolean;
  barCount?: number;
  className?: string;
}

/**
 * Slim animated audio bars that pulse when `active` is true.
 * Respects `prefers-reduced-motion`.
 *
 * Designed for the session status pill and anywhere the
 * interviewer's speaking state is shown.
 */
export function Waveform({
  active,
  barCount = 3,
  className,
}: WaveformProps) {
  return (
    <span
      className={cn(
        "inline-flex items-end gap-[3px] h-4",
        !active && "opacity-30",
        className,
      )}
      aria-hidden="true"
    >
      {Array.from({ length: barCount }, (_, i) => (
        <span
          key={i}
          className={cn(
            "w-[3px] rounded-full bg-current origin-bottom",
            active && "motion-ok:animate-speaking",
          )}
          style={{
            height: "100%",
            animationDelay: active ? `${i * 0.15}s` : "0s",
          }}
        />
      ))}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════
   PresenceOrb — glowing presence / thinking indicator
   ══════════════════════════════════════════════════════════ */

type OrbState = "idle" | "present" | "thinking";

interface PresenceOrbProps {
  state?: OrbState;
  className?: string;
}

const orbStateStyles: Record<OrbState, string> = {
  idle: "bg-muted-foreground/20 scale-75",
  present:
    "bg-primary motion-ok:animate-breathe shadow-[0_0_12px_2px] shadow-primary/30",
  thinking:
    "bg-primary motion-ok:animate-breathe shadow-[0_0_18px_4px] shadow-primary/40",
};

const orbLabels: Record<OrbState, string> = {
  idle: "Interviewer offline",
  present: "Interviewer present",
  thinking: "Interviewer thinking",
};

/**
 * A soft, glowing orb that communicates the interviewer's
 * presence state at a glance.
 *
 * - `idle`     — dim and small (offline / waiting)
 * - `present`  — bright with a gentle breathe pulse
 * - `thinking` — brighter with a wider glow
 */
export function PresenceOrb({
  state = "idle",
  className,
}: PresenceOrbProps) {
  return (
    <span
      className={cn(
        "inline-block w-3 h-3 rounded-full transition-all duration-700 ease-out",
        orbStateStyles[state],
        className,
      )}
      aria-label={orbLabels[state]}
      role="status"
    />
  );
}

/* ══════════════════════════════════════════════════════════
   StageLabel — phase status pill
   ══════════════════════════════════════════════════════════ */

interface StageLabelProps {
  phase: StagePhase;
  /** When `true`, also shows a `Waveform` (speaking / thinking) */
  showWaveform?: boolean;
  /** Override status text (defaults to a humanised version of phase) */
  label?: string;
  className?: string;
}

const phaseDefaults: Record<
  StagePhase,
  { label: string; color: string }
> = {
  connecting: {
    label: "Connecting…",
    color: "bg-muted text-muted-foreground",
  },
  speaking: {
    label: "Interviewer is speaking…",
    color: "bg-primary/10 text-primary",
  },
  listening: {
    label: "Listening…",
    color: "bg-emerald-100 text-emerald-700",
  },
  awaiting: {
    label: "Your turn",
    color: "bg-muted text-muted-foreground",
  },
  thinking: {
    label: "Thinking…",
    color: "bg-primary/10 text-primary",
  },
  concluding: {
    label: "Wrapping up…",
    color: "bg-muted text-muted-foreground",
  },
  ended: {
    label: "Interview complete",
    color: "bg-emerald-100 text-emerald-700",
  },
};

/**
 * A polished status pill that displays the current interview phase.
 *
 * - Color-coded per phase
 * - Optionally renders the `Waveform` alongside speaking / thinking
 * - Announces changes to assistive tech via `aria-live="polite"`
 * - All transitions are 200ms ease-out so phase changes feel smooth
 */
export function StageLabel({
  phase,
  showWaveform,
  label,
  className,
}: StageLabelProps) {
  const { label: defaultLabel, color } = phaseDefaults[phase];
  const statusText = label ?? defaultLabel;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200 ease-out",
        color,
        className,
      )}
      aria-live="polite"
      role="status"
    >
      {showWaveform && (phase === "speaking" || phase === "thinking") && (
        <Waveform active={phase === "speaking"} />
      )}
      {phase === "listening" && (
        <span
          className="inline-block w-2 h-2 rounded-full bg-current motion-ok:animate-pulse"
          aria-hidden="true"
        />
      )}
      {statusText}
    </div>
  );
}