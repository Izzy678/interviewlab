import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import {
  PresenceOrb,
  StageLabel,
  Waveform,
} from "@/components/studio/StudioPrimitives";
import type { InterviewPlanData } from "@/lib/interview";

const steps = [
  "Reviewing your profile",
  "Reading role context",
  "Preparing your interviewer",
  "Opening the room",
];

export default function InterviewPlan() {
  const location = useLocation();
  const navigate = useNavigate();
  const plan = location.state?.plan as InterviewPlanData | undefined;
  const [activeStep, setActiveStep] = useState(0);
  const navigatedRef = useRef(false);

  useEffect(() => {
    if (!plan) return;

    const interval = window.setInterval(() => {
      setActiveStep((current) => Math.min(current + 1, steps.length - 1));
    }, 1050);
    const timeout = window.setTimeout(() => {
      if (navigatedRef.current) return;
      navigatedRef.current = true;
      navigate("/session/1", { state: { plan } });
    }, 4700);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [navigate, plan]);

  const enterRoom = () => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    navigate("/session/1", { state: { plan } });
  };

  if (!plan) {
    return (
      <div className="mx-auto max-w-2xl pt-12">
        <EmptyState
          title="No interview plan found"
          description="Generate an interview plan first by uploading your resume and job description in the setup page."
          action={
            <Button asChild>
              <Link to="/setup">Go to Setup</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 overflow-hidden bg-[#111210] text-[#f2f1ec]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(255,255,255,0.07),transparent_36%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-5 py-6 sm:px-10 sm:py-8">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate("/setup")}
            className="inline-flex items-center gap-2 text-xs font-medium text-white/45 transition-colors hover:text-white/80"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
          <StageLabel active className="text-white/60">
            Studio preparation
          </StageLabel>
        </div>

        <main className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-xl text-center">
            <div className="mb-8 flex justify-center">
              <PresenceOrb active size="lg" className="text-white" />
            </div>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/35">
              Your private interview room
            </p>
            <h1 className="font-heading text-3xl font-medium tracking-tight sm:text-5xl">
              Getting the room ready.
            </h1>
            <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-white/45">
              Settle in. Your interviewer will join you in a moment.
            </p>

            <div className="mx-auto mt-12 max-w-sm border-y border-white/10 py-2 text-left">
              {steps.map((step, index) => {
                const complete = index < activeStep;
                const active = index === activeStep;
                return (
                  <div
                    key={step}
                    className={`flex h-11 items-center justify-between transition-all duration-500 ${
                      index > activeStep ? "text-white/20" : "text-white/75"
                    }`}
                  >
                    <span className="text-sm">{step}</span>
                    {complete ? (
                      <Check className="h-4 w-4 text-white/45" />
                    ) : active ? (
                      <Loader2 className="h-4 w-4 animate-spin text-white/55" />
                    ) : (
                      <span className="h-1 w-1 rounded-full bg-white/20" />
                    )}
                  </div>
                );
              })}
            </div>

            <Waveform
              active
              bars={36}
              className="mx-auto mt-8 h-6 max-w-xs text-white/35"
            />
          </div>
        </main>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-5 sm:flex-row">
          <p className="text-xs text-white/30">
            You’ll enter automatically when the room is ready.
          </p>
          <button
            type="button"
            onClick={enterRoom}
            className="inline-flex items-center gap-2 text-xs font-medium text-white/55 transition-colors hover:text-white"
          >
            Enter now
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}