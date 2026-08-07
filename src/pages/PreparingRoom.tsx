import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PresenceOrb, Waveform } from "@/components/studio/StudioPrimitives";
import {
  buildPrepStages,
  runInterviewPreparation,
  type PrepStage,
  type PrepStageId,
  type SetupPayload,
} from "@/lib/prepareInterview";

const ACTIVE_COPY: Record<PrepStageId, string> = {
  parse_resume: "Reading your experience…",
  fetch_job: "Opening the posting…",
  analyze_job: "Understanding the role…",
  create_plan: "Building the interview strategy…",
};

function formatPrepError(raw: string): string {
  if (/429|quota|resource.?exhausted|rate.?limit/i.test(raw)) {
    return "The AI provider is temporarily rate-limited. Wait a moment, then tap Retry.";
  }
  // Collapse noisy JSON blobs into a short readable line
  const cleaned = raw
    .replace(/\s+/g, " ")
    .replace(/\{[\s\S]*$/, "")
    .trim();
  if (cleaned.length > 0 && cleaned.length < 180) return cleaned;
  return raw.length > 160 ? `${raw.slice(0, 160).trim()}…` : raw;
}

export default function PreparingRoom() {
  const navigate = useNavigate();
  const location = useLocation();
  const payload = location.state as SetupPayload | null;

  const initialStages = useMemo(
    () => (payload ? buildPrepStages(payload) : []),
    [payload],
  );

  const [stages, setStages] = useState<PrepStage[]>(initialStages);
  const [activeId, setActiveId] = useState<PrepStageId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const runIdRef = useRef(0);

  const hasContext =
    Boolean(payload?.resumeFilePath) ||
    Boolean(payload?.jobUrl?.trim()) ||
    Boolean(payload?.jobDescription?.trim());

  const run = async () => {
    if (!payload || !hasContext) return;

    const runId = ++runIdRef.current;
    setError(null);
    setReady(false);
    setStages(buildPrepStages(payload));
    setActiveId(null);

    try {
      const plan = await runInterviewPreparation(payload, (next, active) => {
        if (runId !== runIdRef.current) return;
        setStages(next);
        setActiveId(active);
      });

      if (runId !== runIdRef.current) return;

      setReady(true);
      setActiveId(null);
      await new Promise((r) => setTimeout(r, 900));
      if (runId !== runIdRef.current) return;
      navigate("/session/1", { state: { plan }, replace: true });
    } catch (err) {
      if (runId !== runIdRef.current) return;
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  };

  useEffect(() => {
    if (!payload || !hasContext) return;
    void run();
    return () => {
      runIdRef.current += 1;
    };
    // Intentionally run once on mount for this payload
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!payload || !hasContext) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-6 text-center">
        <p className="font-display text-3xl tracking-tight">Nothing to prepare yet</p>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Add a resume or target role in the preparation room first.
        </p>
        <Button className="mt-8" onClick={() => navigate("/setup")}>
          Back to preparation
        </Button>
      </div>
    );
  }

  const headline = ready
    ? "The room is ready"
    : error
      ? "Preparation paused"
      : activeId
        ? ACTIVE_COPY[activeId]
        : "Preparing the room…";

  return (
    <div className="relative mx-auto flex min-h-[78vh] max-w-2xl flex-col items-center justify-center px-6 py-16">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-[18%] h-64 w-64 -translate-x-1/2 rounded-full bg-primary/8 blur-3xl animate-breathe" />
        <div className="absolute left-[18%] top-[42%] h-1.5 w-1.5 animate-drift rounded-full bg-primary/25" />
        <div className="absolute right-[22%] top-[28%] h-1 w-1 animate-drift rounded-full bg-foreground/20 [animation-delay:1.2s]" />
      </div>

      <div className="animate-fade-up flex flex-col items-center text-center">
        <p className="mb-6 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
          Entering the room
        </p>

        <PresenceOrb active={!error} size="lg" />

        <h1 className="font-display mt-10 text-3xl tracking-tight sm:text-4xl">
          {headline}
        </h1>
        <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
          {ready
            ? "Connecting you with your interviewer."
            : error
              ? "One of the preparation steps needs attention before we continue."
              : "Your interviewer is studying the context you provided."}
        </p>

        <div className="mt-8 text-primary/70">
          <Waveform active={!error && !ready} bars={22} className="h-7" />
        </div>
      </div>

      <ol className="mt-14 w-full max-w-md space-y-0">
        {stages.map((stage, index) => {
          const isActive = stage.status === "active";
          const isDone = stage.status === "done";
          const isError = stage.status === "error";
          return (
            <li key={stage.id} className="relative flex gap-4 pb-8 last:pb-0">
              {index < stages.length - 1 && (
                <span
                  className={`absolute left-[11px] top-7 h-[calc(100%-1.25rem)] w-px ${
                    isDone ? "bg-primary/40" : "bg-border"
                  }`}
                  aria-hidden
                />
              )}
              <span
                className={`relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold transition-colors ${
                  isDone
                    ? "border-primary/40 bg-accent text-primary"
                    : isActive
                      ? "border-primary bg-primary text-primary-foreground"
                      : isError
                        ? "border-destructive/50 bg-destructive/10 text-destructive"
                        : "border-border bg-card text-muted-foreground"
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : isError ? (
                  <AlertCircle className="h-3.5 w-3.5" />
                ) : (
                  index + 1
                )}
              </span>
              <div className="min-w-0 pt-0.5 text-left">
                <p
                  className={`text-sm font-semibold ${
                    isActive || isDone
                      ? "text-foreground"
                      : isError
                        ? "text-destructive"
                        : "text-muted-foreground"
                  }`}
                >
                  {stage.label}
                </p>
                <p
                  className={`mt-0.5 text-xs leading-5 ${
                    isActive ? "text-foreground/70" : "text-muted-foreground"
                  }`}
                >
                  {stage.detail}
                </p>
                {isActive && (
                  <span className="mt-2 inline-block h-0.5 w-16 overflow-hidden rounded-full bg-border">
                    <span className="block h-full w-full origin-left animate-prep-progress rounded-full bg-primary" />
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {error && (
        <div className="mt-10 w-full max-w-md animate-fade-up space-y-4 rounded-xl border border-destructive/25 bg-destructive/5 px-5 py-5 text-left">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="min-w-0 flex-1 break-words text-sm leading-6 text-destructive">
              {formatPrepError(error)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" onClick={() => void run()} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/setup")}>
              Back to setup
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
