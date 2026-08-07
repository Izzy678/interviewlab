import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import {
  Mic,
  MicOff,
  PhoneOff,
  Loader2,
  CheckCircle2,
  Send,
  RefreshCw,
  Keyboard,
  AlertCircle,
  Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { BriefingCard } from "@/components/interview/BriefingCard";
import {
  PresenceOrb,
  StageLabel,
  Waveform,
} from "@/components/studio/StudioPrimitives";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useJoinChecks, type CheckState } from "@/hooks/useJoinChecks";
import { speak, stopSpeaking, ttsSupported } from "@/lib/tts";
import {
  fetchInterviewReply,
  formatDuration,
  type ChatMessage,
  type InterviewPlanData,
  type InterviewReply,
  type InterviewStage,
} from "@/lib/interview";
import { useAuth } from "@/contexts/AuthContext";
import { saveInterviewSession } from "@/lib/sessions";

/* ── Types ─────────────────────────────────────────────── */

type Phase =
  | "idle"
  | "connecting"
  | "speaking"
  | "listening"
  | "awaiting"
  | "thinking"
  | "concluding"
  | "ended";

function formatStageProgress(
  stage: InterviewStage | undefined,
  plan: InterviewPlanData,
  userTurns: number,
): string {
  const secs = plan.sections;
  const recruiterN = secs.recruiter_questions?.questions?.length ?? 3;
  const behavioralN = secs.behavioral_questions?.questions?.length ?? 4;
  const technicalN = secs.technical_questions?.questions?.length ?? 4;
  const followUpN = secs.follow_up_questions?.questions?.length ?? 2;

  const map: Record<
    string,
    { label: string; total: number; offset: number }
  > = {
    greeting: { label: "Greeting", total: 1, offset: 0 },
    introduction: {
      label: "Introduction",
      total: Math.max(1, Math.ceil(recruiterN / 2)),
      offset: 0,
    },
    background: {
      label: "Background",
      total: Math.max(1, Math.floor(recruiterN / 2) || 1),
      offset: Math.ceil(recruiterN / 2),
    },
    core: {
      label: "Behavioral",
      total: Math.max(1, behavioralN + technicalN),
      offset: recruiterN,
    },
    follow_up: {
      label: "Follow-up",
      total: Math.max(1, followUpN),
      offset: recruiterN + behavioralN + technicalN,
    },
    wrap_up: {
      label: "Wrap-up",
      total: 1,
      offset: recruiterN + behavioralN + technicalN + followUpN,
    },
    concluded: { label: "Complete", total: 1, offset: 0 },
  };

  const info = map[stage ?? "introduction"] ?? map.introduction;
  const current = Math.max(
    1,
    Math.min(info.total, Math.max(1, userTurns - info.offset)),
  );
  return `${info.label} · ${current} of ~${info.total}`;
}

/* ── Main Component ─────────────────────────────────────── */

export default function InterviewSession() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const plan = location.state?.plan as InterviewPlanData | undefined;
  const fromPreparing = Boolean(
    (location.state as { fromPreparing?: boolean } | null)?.fromPreparing,
  );

  /* ── Core state ── */
  const [phase, setPhase] = useState<Phase>("idle");
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [lastReply, setLastReply] = useState<InterviewReply | null>(null);
  const [liveCaption, setLiveCaption] = useState("");
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [canRetryInterviewer, setCanRetryInterviewer] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [textMode, setTextMode] = useState(false);
  const [typedDraft, setTypedDraft] = useState("");
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [duration, setDuration] = useState(0);

  const historyRef = useRef<ChatMessage[]>([]);
  const busyRef = useRef(false);
  const abortedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    supported: speechSupported,
    error: speechError,
    speechActive,
    liveCaption: hookCaption,
    idleMs,
    endOfSpeechMs,
    startSession,
    endSession,
    startCapture,
    pauseCapture,
    clearError,
  } = useSpeechRecognition({
    onTurnComplete: handleTurnComplete,
  });

  const stillListening =
    phase === "listening" && !speechActive && idleMs > 3000;
  const patienceProgress = Math.min(
    1,
    Math.max(0, (idleMs - 3000) / Math.max(1, endOfSpeechMs - 3000)),
  );

  /* ── Mic + network pre-join checks ── */
  const {
    mic: joinMic,
    network: joinNetwork,
    checking: joinChecking,
    recheck: recheckJoin,
  } = useJoinChecks({ enabled: phase === "idle", includeMic: !textMode });

  const joinDisabled =
    joinChecking ||
    joinNetwork.state !== "ready" ||
    (!textMode && joinMic.state !== "ready");

  /* ── Duration timer ── */
  useEffect(() => {
    if (phase === "idle" || phase === "ended") return;
    startedAtRef.current = startedAtRef.current || Date.now();
    const t = window.setInterval(() => {
      if (startedAtRef.current) {
        setDuration(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }
    }, 1000);
    return () => window.clearInterval(t);
  }, [phase]);

  const startedAtRef = useRef<number | null>(null);

  /* ── Scroll to latest conversation ── */
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [conversation, liveCaption, phase]);

  /* ── Sync hook liveCaption ── */
  useEffect(() => {
    if (phase === "listening") setLiveCaption(hookCaption);
  }, [hookCaption, phase]);

  /* ── Error banner cleanup ── */
  useEffect(() => {
    if (speechError) setErrorBanner(speechError);
  }, [speechError]);

  /* ── Helpers ── */

  const appendMessage = useCallback((msg: ChatMessage) => {
    historyRef.current = [...historyRef.current, msg];
    setConversation(historyRef.current);
  }, []);

  const finishInterview = useCallback(() => {
    stopSpeaking();
    abortedRef.current = true;
    busyRef.current = false;
    void endSession();
    setPhase("ended");

    window.setTimeout(async () => {
      const conversation = historyRef.current;
      let reportId = id || "latest";

      if (user && plan) {
        try {
          reportId = await saveInterviewSession({
            userId: user.id,
            plan,
            conversation,
            durationSeconds: duration,
          });
        } catch (err) {
          console.error("Failed to persist interview session", err);
        }
      }

      navigate(`/report/${reportId}`, {
        state: {
          plan,
          conversation,
          durationSeconds: duration,
          sessionId: reportId,
        },
        replace: true,
      });
    }, 3000);
  }, [endSession, navigate, plan, id, duration, user]);

  const startListening = useCallback(
    (opts?: { forceText?: boolean }) => {
      if (opts?.forceText || textMode) {
        setPhase("awaiting");
        return;
      }
      setPhase("listening");
      clearError();
      startCapture();
    },
    [textMode, startCapture, clearError],
  );

  /* ── Turn callback ── */

  function handleTurnComplete(text: string, hadSpeech: boolean) {
    if (busyRef.current) return;
    const content =
      hadSpeech && text.trim() ? text.trim() : "[NO_SPEECH_DETECTED]";
    appendMessage({ role: "user", content });
    void runInterviewerTurn();
  }

  /* ── Run an interviewer turn (called after a candidate utterance) ── */

  const runInterviewerTurn = useCallback(async () => {
    if (busyRef.current || abortedRef.current) return;
    busyRef.current = true;
    setPhase("thinking");
    setErrorBanner(null);
    setCanRetryInterviewer(false);

    try {
      const reply = await fetchInterviewReply(plan!, historyRef.current);
      if (abortedRef.current) return;

      appendMessage({ role: "assistant", content: reply.message });
      setLastReply(reply);

      if (reply.done) {
        setPhase("speaking");
        if (ttsSupported()) await speak(reply.message);
        finishInterview();
        return;
      }

      setPhase("speaking");
      if (ttsSupported()) await speak(reply.message);

      if (abortedRef.current) return;
      startListening();
    } catch (err) {
      if (abortedRef.current) return;
      const msg =
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.";
      setErrorBanner(msg);
      setCanRetryInterviewer(true);
      // Allow the candidate to retry without losing their last answer
      setPhase("awaiting");
    } finally {
      busyRef.current = false;
      setRetrying(false);
    }
  }, [plan, appendMessage, finishInterview, startListening]);

  const retryInterviewer = useCallback(() => {
    if (busyRef.current || retrying) return;
    setRetrying(true);
    setErrorBanner(null);
    setCanRetryInterviewer(false);
    clearError();
    void runInterviewerTurn();
  }, [retrying, clearError, runInterviewerTurn]);

  /* ── Begin the interview (after user clicks "Begin") ── */

  const begin = useCallback(async () => {
    if (!plan) return;
    abortedRef.current = false;
    startedAtRef.current = Date.now();
    setConfirmEnd(false);
    setDuration(0);
    setPhase("connecting");

    try {
      let voiceOk = false;
      if (!textMode && speechSupported) {
        voiceOk = await startSession();
        if (!voiceOk) {
          setTextMode(true);
        }
      }
      if (abortedRef.current) return;

      busyRef.current = true;
      const reply = await fetchInterviewReply(plan, []);
      if (abortedRef.current) return;

      appendMessage({ role: "assistant", content: reply.message });
      setLastReply(reply);

      if (reply.done) {
        setPhase("speaking");
        if (ttsSupported()) await speak(reply.message);
        finishInterview();
        return;
      }

      setPhase("speaking");
      if (ttsSupported()) await speak(reply.message);

      if (abortedRef.current) return;
      startListening(voiceOk ? undefined : { forceText: true });
    } catch (err) {
      if (abortedRef.current) return;
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to start the interview. Please try again.";
      setErrorBanner(msg);
      setCanRetryInterviewer(true);
      setPhase("awaiting");
    } finally {
      busyRef.current = false;
    }
  }, [
    plan,
    textMode,
    speechSupported,
    startSession,
    appendMessage,
    finishInterview,
    startListening,
  ]);

  /* ── Manual end ── */

  const handleEnd = useCallback(() => {
    if (!confirmEnd) {
      setConfirmEnd(true);
      return;
    }
    abortedRef.current = true;
    stopSpeaking();
    void endSession();
    setPhase("ended");
    window.setTimeout(async () => {
      const conversation = historyRef.current;
      let reportId = id || "latest";

      if (user && plan) {
        try {
          reportId = await saveInterviewSession({
            userId: user.id,
            plan,
            conversation,
            durationSeconds: duration,
          });
        } catch (err) {
          console.error("Failed to persist interview session", err);
        }
      }

      navigate(`/report/${reportId}`, {
        state: {
          plan,
          conversation,
          durationSeconds: duration,
          sessionId: reportId,
        },
        replace: true,
      });
    }, 3000);
  }, [confirmEnd, endSession, navigate, plan, id, duration, user]);

  /* ── Text mode send ── */

  const sendTyped = useCallback(() => {
    const text = typedDraft.trim();
    if (!text || busyRef.current) return;
    if (phase !== "awaiting") return;
    setTypedDraft("");
    appendMessage({ role: "user", content: text });
    void runInterviewerTurn();
  }, [typedDraft, phase, appendMessage, runInterviewerTurn]);

  /* ── Cleanup ── */

  useEffect(() => {
    return () => {
      abortedRef.current = true;
      stopSpeaking();
      void endSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ════════════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════════════ */

  if (!plan) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <EmptyState
          title="No interview data"
          description="Go to setup to prepare your interview plan first."
          action={
            <Button asChild>
              <a href="/setup">Go to Setup</a>
            </Button>
          }
        />
      </div>
    );
  }

  /* ── Idle overlay (start screen) ── */
  if (phase === "idle") {
    const hasBriefing = Boolean(
      plan.briefing &&
        (plan.briefing.focus_skills.length > 0 || plan.briefing.resume_gap),
    );

    /* ── Helper: render one check row ── */
    const CheckRow = ({
      icon,
      state,
      label,
      error,
      quiet,
    }: {
      icon: React.ReactNode;
      state: CheckState;
      label: string;
      error?: string;
      quiet?: boolean;
    }) => (
      <div className="flex items-start gap-3 rounded-lg border border-white/[0.07] bg-white/[0.03] px-4 py-3 text-left">
        <span className="mt-0.5 shrink-0 text-white/40" aria-hidden>
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white/80">{label}</p>
          {state === "ready" && !quiet && (
            <p className="text-xs text-emerald-400/70">Ready</p>
          )}
          {state === "ready" && quiet && (
            <p className="text-xs text-amber-400/70">
              Connected — no sound detected. Check your mic is unmuted.
            </p>
          )}
          {state === "checking" && (
            <p className="text-xs text-white/35">Checking…</p>
          )}
          {state === "error" && error && (
            <div className="mt-1 space-y-2">
              <p className="text-xs leading-5 text-red-300">{error}</p>
              <button
                type="button"
                onClick={recheckJoin}
                className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-red-300 underline transition-colors hover:text-white"
              >
                <RefreshCw className="h-3 w-3" />
                Re-check
              </button>
            </div>
          )}
        </div>
        <span className="mt-0.5 shrink-0" aria-hidden>
          {state === "checking" ? (
            <Loader2 className="h-4 w-4 animate-spin text-white/35" />
          ) : state === "ready" ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-400" />
          )}
        </span>
      </div>
    );

    return (
      <div
        className={`fixed inset-0 z-40 overflow-y-auto bg-[#111210] p-5 text-[#f2f1ec] ${
          fromPreparing ? "animate-fade-in" : ""
        }`}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(255,255,255,0.075),transparent_34%)]" />
        <div className="relative flex min-h-full items-center justify-center">
          <div className="w-full max-w-lg text-center">
            <StageLabel active className="mb-10 text-white/50">
            Room ready
          </StageLabel>
          <div className="mb-7 flex justify-center">
            <PresenceOrb active size="lg" />
          </div>
          <h1 className="font-heading text-3xl font-medium tracking-tight sm:text-4xl">
            Alexa is ready to meet you.
          </h1>
          <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-white/45">
            {plan.target_role || "Your role"} interview · Speak naturally and
            take your time.
          </p>
          <Waveform
            active={false}
            className="mx-auto mb-6 mt-10 max-w-xs text-white/45"
          />

          {/* ── Pre-join briefing card ── */}
          {hasBriefing && (
            <div className="mb-8 flex justify-center">
              <BriefingCard
                role={plan.target_role}
                briefing={plan.briefing!}
              />
            </div>
          )}

          {/* ── Check panel ── */}
          <div
            className="mx-auto mb-8 max-w-xs space-y-2"
            aria-live="polite"
            aria-atomic="true"
          >
            {!textMode && (
              <CheckRow
                icon={<Mic className="h-4 w-4" />}
                state={joinMic.state}
                label="Microphone"
                error={joinMic.error}
                quiet={joinMic.quiet}
              />
            )}
            <CheckRow
              icon={<Wifi className="h-4 w-4" />}
              state={joinNetwork.state}
              label="Network"
              error={joinNetwork.error}
            />
          </div>

          <div className="mx-auto max-w-xs space-y-3">
            {joinChecking && (
              <p className="text-xs text-white/30">
                Running pre-join checks…
              </p>
            )}
            <Button
              size="lg"
              onClick={begin}
              disabled={joinDisabled}
              className="h-12 w-full gap-2 rounded-full bg-[#f2f1ec] text-[#111210] hover:bg-white disabled:opacity-40"
            >
              {joinChecking ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking…
                </>
              ) : !textMode && joinMic.state === "error" ? (
                <>
                  <Mic className="h-4 w-4" />
                  Can't join with mic
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4" />
                  Join interview
                </>
              )}
            </Button>
            <button
              type="button"
              onClick={() => setTextMode((t) => !t)}
              className="mx-auto inline-flex cursor-pointer items-center gap-2 text-xs text-white/40 transition-colors hover:text-white/75"
            >
              <Keyboard className="h-3.5 w-3.5" />
              {textMode
                ? "Use microphone instead"
                : "Use text instead"}
            </button>
          </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Ended state ── */
  if (phase === "ended") {
    return (
      <div className="fixed inset-0 z-40 flex min-h-screen items-center justify-center bg-[#111210] p-4 text-[#f2f1ec]">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5">
              <CheckCircle2 className="h-7 w-7 text-white/70" />
            </div>
          </div>
          <h2 className="font-heading text-3xl font-medium tracking-tight">
            Conversation complete.
          </h2>
          <p className="text-sm text-white/45">
            Your interviewer is preparing thoughtful feedback.
          </p>
          <Loader2 className="mx-auto h-4 w-4 animate-spin text-white/40" />
        </div>
      </div>
    );
  }

  /* ── Phase labels ── */
  const phaseLabel = {
    connecting: ["Connecting to your interviewer…", false],
    speaking: ["Interviewer is speaking…", true],
    listening: [
      speechActive ? "You're speaking…" : "Listening…",
      speechActive,
    ],
    awaiting: ["Your turn — type your answer", false],
    thinking: ["Thinking…", false],
    concluding: ["Wrapping up…", false],
    ended: ["Interview complete", false],
  } as const;

  const [statusText] = phaseLabel[phase] ?? ["", false];
  const userTurns = conversation.filter((m) => m.role === "user").length;
  const stageProgress = formatStageProgress(
    lastReply?.stage,
    plan,
    Math.max(1, userTurns),
  );

  /* ── Main session view ── */
  return (
    <div className="fixed inset-0 z-40 flex min-h-screen flex-col overflow-hidden bg-[#111210] text-[#f2f1ec]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.045),transparent_34%)]" />
      <header className="relative z-30 border-b border-white/[0.07] bg-[#111210]/80 backdrop-blur-md">
        <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-4 sm:px-7">
          <div className="flex min-w-0 items-center gap-2.5">
            <PresenceOrb
              active={phase === "speaking" || phase === "thinking"}
              size="sm"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white/85">Alexa</p>
              <p className="truncate text-[10px] text-white/30">{statusText}</p>
            </div>
          </div>

          <div className="hidden items-center gap-5 sm:flex">
            <StageLabel active className="text-white/45">
              {stageProgress}
            </StageLabel>
            <span className="text-[11px] tabular-nums text-white/30">
              {formatDuration(duration)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {confirmEnd ? (
              <>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleEnd}
                  className="h-8 text-xs"
                >
                  End now
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmEnd(false)}
                  className="h-8 text-xs text-white/45 hover:bg-white/10 hover:text-white"
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleEnd}
                className="gap-1.5 text-white/30 hover:bg-white/10 hover:text-white/80"
                aria-label="End interview"
              >
                <PhoneOff className="h-3.5 w-3.5" />
                <span className="text-xs">End</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="relative mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col px-5 sm:px-8">
        <div
          ref={scrollRef}
          className="flex-1 space-y-0 overflow-y-auto py-10 scroll-smooth [scrollbar-width:none] sm:py-14"
          role="log"
          aria-live="polite"
          aria-label="Interview transcript"
        >
          {conversation.map((msg, i) => {
            const isAi = msg.role === "assistant";
            const isRecent = i >= conversation.length - 2;
            return (
              <div
                key={i}
                className={`max-w-2xl border-t border-white/[0.06] py-7 first:border-t-0 first:pt-0 transition-opacity ${
                  isRecent ? "opacity-100" : "opacity-55"
                }`}
              >
                <p
                  className={`mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                    isAi ? "text-white/30" : "text-white/20"
                  }`}
                >
                  {isAi ? "Alexa" : "You"}
                </p>
                <p
                  className={`whitespace-pre-wrap leading-relaxed ${
                    isAi
                      ? "font-heading text-xl text-white/90 sm:text-2xl"
                      : "text-sm text-white/45 sm:text-[15px]"
                  }`}
                >
                  {msg.content}
                </p>
              </div>
            );
          })}

          {phase === "thinking" && (
            <div className="max-w-2xl border-t border-white/[0.06] py-7">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30">
                Alexa
              </p>
              <div className="flex items-center gap-3 text-white/40">
                <Waveform active bars={16} className="h-5 justify-start" />
                <span className="text-xs">Considering your answer</span>
              </div>
            </div>
          )}

          {phase === "listening" && liveCaption && (
            <div className="max-w-2xl border-t border-white/[0.06] py-7 opacity-100">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/25">
                You · Live
              </p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/55 sm:text-[15px]">
                {liveCaption}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="relative border-t border-white/[0.07] bg-[#151614]/95 px-4 py-3.5">
        <div className="mx-auto w-full max-w-2xl space-y-3">
        {errorBanner && (
          <div className="flex items-start justify-between gap-3 rounded-lg border border-red-400/20 bg-red-400/5 px-4 py-2.5 text-sm text-red-200">
            <span className="text-xs leading-relaxed flex-1">{errorBanner}</span>
            <div className="flex items-center gap-2 shrink-0">
              {canRetryInterviewer && (
                <button
                  onClick={retryInterviewer}
                  disabled={retrying || phase === "thinking"}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-red-100 px-2.5 py-1 text-xs font-medium text-red-950 hover:bg-white disabled:opacity-50"
                  aria-label="Retry interviewer"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${retrying ? "animate-spin" : ""}`}
                  />
                  {retrying ? "Retrying…" : "Retry"}
                </button>
              )}
              <button
                onClick={() => {
                  setErrorBanner(null);
                  setCanRetryInterviewer(false);
                  clearError();
                }}
                className="cursor-pointer text-xs text-white/45 underline hover:text-white"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {phase === "listening" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <Waveform
                    active={speechActive}
                    className="h-7 justify-start text-white/60"
                    bars={24}
                  />
                  <span className="hidden text-xs text-white/35 sm:inline">
                    {speechActive
                      ? "Capturing your answer"
                      : stillListening
                        ? "Still listening…"
                        : "Listening"}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  pauseCapture();
                  setPhase("awaiting");
                }}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/55 transition-all hover:bg-white/10 active:scale-95"
                aria-label="Stop recording"
              >
                <MicOff className="h-4 w-4" />
              </button>
            </div>
            {stillListening && (
              <div
                className="h-0.5 overflow-hidden rounded-full bg-white/10 motion-safe:transition-opacity"
                aria-hidden
              >
                <div
                  className="h-full rounded-full bg-white/35 transition-[width] duration-500 ease-out motion-reduce:transition-none"
                  style={{ width: `${patienceProgress * 100}%` }}
                />
              </div>
            )}
          </div>
        )}

        {phase === "awaiting" && (
          <div>
            {textMode ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={typedDraft}
                  onChange={(e) => setTypedDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendTyped();
                    }
                  }}
                  placeholder="Type your answer…"
                  className="flex-1 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm text-white placeholder:text-white/25 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
                  autoFocus
                  aria-label="Type your answer"
                />
                <Button
                  onClick={sendTyped}
                  disabled={!typedDraft.trim() || busyRef.current}
                  size="icon"
                  className="shrink-0 rounded-full bg-white text-black hover:bg-white/90"
                  aria-label="Send answer"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-white/65">Your turn</p>
                  <p className="text-xs text-white/30">Take a moment when you need it.</p>
                </div>
                <button
                  onClick={() => startListening()}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f2f1ec] text-[#111210] transition-all hover:bg-white active:scale-95"
                  aria-label="Start speaking"
                >
                  <Mic className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setTextMode(true)}
                  className="text-xs text-white/35 underline hover:text-white/70"
                >
                  Type instead
                </button>
              </div>
            )}
          </div>
        )}
        {(phase === "connecting" || phase === "speaking") && (
          <div className="flex h-10 items-center justify-between">
            <div className="flex items-center gap-3">
              <Waveform
                active={phase === "speaking"}
                bars={28}
                className="h-7 justify-start text-white/60"
              />
              <span className="text-xs text-white/35">{statusText}</span>
            </div>
            <span className="text-[11px] tabular-nums text-white/25 sm:hidden">
              {formatDuration(duration)}
            </span>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}