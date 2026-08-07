import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

type Stage = "connecting" | "planning" | "ready";

export default function PreparingRoom() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const interviewId = searchParams.get("id");
  const mounted = useRef(true);
  const [stage, setStage] = useState<Stage>("connecting");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

  // Simulate the preparation pipeline
  useEffect(() => {
    const steps: { label: Stage; duration: number; target: number }[] = [
      { label: "connecting", duration: 1200, target: 33 },
      { label: "planning", duration: 1800, target: 75 },
      { label: "ready", duration: 800, target: 100 },
    ];

    let stepIndex = 0;
    let startTime = Date.now();

    const tick = () => {
      if (!mounted.current) return;

      const step = steps[stepIndex];
      if (!step) return;

      const elapsed = Date.now() - startTime;
      const pct = Math.min(elapsed / step.duration, 1);
      const eased = 1 - Math.pow(1 - pct, 3); // ease-out cubic
      const currentProgress = Math.round(
        (stepIndex > 0 ? steps[stepIndex - 1].target : 0) +
          eased * (step.target - (stepIndex > 0 ? steps[stepIndex - 1].target : 0))
      );
      setProgress(Math.min(currentProgress, 100));
      setStage(step.label);

      if (pct < 1) {
        requestAnimationFrame(tick);
      } else {
        stepIndex++;
        if (stepIndex < steps.length) {
          startTime = Date.now();
          requestAnimationFrame(tick);
        } else {
          // All done — navigate to session
          const sessionId = interviewId || crypto.randomUUID();
          navigate(`/session/${sessionId}`, { replace: true });
        }
      }
    };

    requestAnimationFrame(tick);
  }, [navigate, interviewId]);

  const stageMessages: Record<Stage, { icon: string; title: string; description: string }> = {
    connecting: {
      icon: "📡",
      title: "Connecting to studio",
      description: "Waking up the AI interviewer and establishing a secure connection\u2026",
    },
    planning: {
      icon: "🧠",
      title: "Preparing your interview",
      description: "Analysing the role and tailoring questions to your background\u2026",
    },
    ready: {
      icon: "🎙️",
      title: "Almost ready",
      description: "Your private interview room is ready\u2014get comfortable.",
    },
  };

  const current = stageMessages[stage];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        {/* Animated icon */}
        <div className="mb-6">
          <span className="inline-block text-4xl transition-all duration-500">
            {stage === "ready" ? "🎙️" : "📡"}
          </span>
        </div>

        {/* Stage title */}
        <h1 className="mb-2 text-xl font-semibold tracking-tight">
          {current.title}
        </h1>
        <p className="mb-8 text-sm text-muted-foreground">
          {current.description}
        </p>

        {/* Progress bar */}
        <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <p className="text-xs text-muted-foreground/60">{progress}%</p>
      </div>
    </div>
  );
}