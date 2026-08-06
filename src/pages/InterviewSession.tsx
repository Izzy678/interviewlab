import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import {
  Mic,
  MicOff,
  PhoneOff,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Send,
  MessageSquareText,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { speak, stopSpeaking, ttsSupported } from "@/lib/tts";
import {
  fetchInterviewReply,
  formatDuration,
  type ChatMessage,
  type InterviewPlanData,
  type InterviewReply,
} from "@/lib/interview";

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

/* ── Helper Components ─────────────────────────────────── */

function SpeakingBars({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-end gap-[3px] h-4 ${
        active ? "" : "opacity-30"
      }`}
      aria-hidden="true"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`w-[3px] rounded-full bg-current origin-bottom ${
            active ? "animate-speaking motion-reduce:animate-none" : ""
          }`}
          style={{
            height: "100%",
            animationDelay: active ? `${i * 0.15}s` : "0s",
          }}
        />
      ))}
    </span>
  );
}

/* ── Main Component ─────────────────────────────────────── */

export default function InterviewSession() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const plan = location.state?.plan as InterviewPlanData | undefined;

  /* ── Core state ── */
  const [phase, setPhase] = useState<Phase>("idle");
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [lastReply, setLastReply] = useState<InterviewReply | null>(null);
  const [liveCaption, setLiveCaption] = useState("");
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
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
    startSession,
    endSession,
    startCapture,
    pauseCapture,
    clearError,
  } = useSpeechRecognition({
    onTurnComplete: handleTurnComplete,
  });

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
    // Auto-navigate to report after a brief completion moment
    window.setTimeout(() => {
      navigate(`/report/${id}`, {
        state: {
          plan,
          conversation: historyRef.current,
          durationSeconds: duration,
        },
        replace: true,
      });
    }, 3000);
  }, [endSession, navigate, plan, id, duration]);

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
      // Allow the candidate to try again
      setPhase("awaiting");
    } finally {
      busyRef.current = false;
    }
  }, [plan, appendMessage, finishInterview, startListening]);

  /* ── Begin the interview (after user clicks "Begin") ── */

  const begin = useCallback(async () => {
    if (!plan) return;
    abortedRef.current = false;
    startedAtRef.current = Date.now();
    setConfirmEnd(false);
    setDuration(0);
    setPhase("connecting");

    try {
      if (!textMode && speechSupported) {
        const ok = await startSession();
        if (!ok) {
          setTextMode(true);
          // Don't call startListening here — voice failed, text mode is now
          // set, let the greeting flow happen before prompting user.
        } else {
          // Voice ready — proceed
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
      startListening();
    } catch (err) {
      if (abortedRef.current) return;
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to start the interview. Please try again.";
      setErrorBanner(msg);
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
    window.setTimeout(() => {
      navigate(`/report/${id}`, {
        state: {
          plan,
          conversation: historyRef.current,
          durationSeconds: duration,
        },
        replace: true,
      });
    }, 3000);
  }, [confirmEnd, endSession, navigate, plan, id, duration]);

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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted p-4">
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted p-4">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="flex items-center justify-center w-20 h-20 rounded-full bg-primary/10">
                <MessageSquareText className="h-10 w-10 text-primary" />
              </div>
            </div>
            <h1 className="text-2xl font-bold tracking-tight font-heading">
              Alex — AI Interviewer
            </h1>
            <p className="text-sm text-muted-foreground">
              Simulating a real interview for{" "}
              <span className="font-medium text-foreground">
                {plan.target_role || "your target role"}
              </span>
            </p>
          </div>

          <div className="space-y-3 text-left text-sm text-muted-foreground bg-background rounded-xl border p-5">
            <div className="flex items-start gap-3">
              <Mic className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <span>
                You'll need a microphone for this session. Your speech is
                transcribed in real time.
              </span>
            </div>
            <div className="flex items-start gap-3">
              <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <span>
                The interviewer adapts to your answers — just speak naturally.
              </span>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <span>
                Once you finish, you'll get a detailed feedback report.
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <Button
              size="lg"
              onClick={begin}
              className="gap-2 w-full"
            >
              <Mic className="h-4 w-4" />
              Begin Interview
            </Button>
            <button
              type="button"
              onClick={() => {
                setTextMode((t) => !t);
              }}
              className="block mx-auto text-xs text-muted-foreground underline hover:text-foreground transition-colors cursor-pointer"
            >
              {textMode
                ? "🎤 Use microphone instead"
                : "⌨️ Prefer to type your answers?"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Ended state ── */
  if (phase === "ended") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted p-4">
        <div className="max-w-sm w-full text-center space-y-6">
          <div className="flex justify-center">
            <div className="flex items-center justify-center w-20 h-20 rounded-full bg-emerald-100">
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
            </div>
          </div>
          <h2 className="text-2xl font-bold tracking-tight font-heading">
            Interview Complete
          </h2>
          <p className="text-sm text-muted-foreground">
            Preparing your feedback report…
          </p>
          <Loader2 className="h-5 w-5 mx-auto text-primary animate-spin" />
          <div className="flex gap-3 justify-center pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/dashboard")}
            >
              Back to Dashboard
            </Button>
          </div>
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

  const [statusText] = phaseLabel[phase] ?? [
    "",
    false,
  ];

  /* ── Main session view ── */
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background via-muted/30 to-muted/50">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            {confirmEnd ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">End interview?</span>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleEnd}
                  className="h-7 text-xs"
                >
                  Yes, end
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmEnd(false)}
                  className="h-7 text-xs"
                >
                  Keep going
                </Button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmEnd(true)}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                aria-label="Exit interview"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Exit</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 text-sm">
            <span className="font-medium text-foreground hidden sm:inline">
              Alex
            </span>
            <span className="text-muted-foreground text-xs hidden sm:inline">
              {plan.target_role || "Interviewer"}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs tabular-nums font-medium text-muted-foreground">
              {formatDuration(duration)}
            </span>
          </div>

          {!confirmEnd && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleEnd}
              className="gap-1.5 text-muted-foreground hover:text-destructive"
              aria-label="End interview"
            >
              <PhoneOff className="h-4 w-4" />
              <span className="hidden sm:inline">End</span>
            </Button>
          )}
        </div>
      </header>

      {/* Status pill */}
      <div className="flex justify-center pt-3">
        <div
          className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200 ${
            phase === "listening" && speechActive
              ? "bg-emerald-100 text-emerald-700"
              : phase === "speaking"
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground"
          }`}
          aria-live="polite"
        >
          {(phase === "speaking" || phase === "thinking") && (
            <SpeakingBars
              active={phase === "speaking"}
            />
          )}
          {phase === "listening" && speechActive && (
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          )}
          {statusText}
        </div>
      </div>

      {/* Conversation area */}
      <div className="flex-1 flex flex-col px-4 py-4 max-w-2xl mx-auto w-full">
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto space-y-4 scroll-smooth"
          role="log"
          aria-live="polite"
          aria-label="Interview transcript"
        >
          {/* Previous exchanges */}
          {conversation.map((msg, i) => {
            const isAi = msg.role === "assistant";
            return (
              <div
                key={i}
                className={`flex gap-3 ${isAi ? "" : "flex-row-reverse"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    isAi
                      ? "bg-background border border-border rounded-bl-md"
                      : "bg-primary text-primary-foreground rounded-br-md"
                  }`}
                >
                  <p className="text-xs font-medium opacity-60 mb-1">
                    {isAi ? "Interviewer" : "You"}
                  </p>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                  </p>
                </div>
              </div>
            );
          })}

          {/* Current interviewer message (while speaking) */}
          {(phase === "speaking" || phase === "thinking") && lastReply && (
            <div className="flex gap-3">
              <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-background border border-primary/20 rounded-bl-md">
                <p className="text-xs font-medium text-primary mb-1">
                  Interviewer
                </p>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {lastReply.message}
                </p>
                {phase === "thinking" && (
                  <span className="inline-block ml-1 animate-pulse">
                    <span className="inline-block w-1.5 h-4 bg-primary/40 rounded-full align-middle" />
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Live caption (candidate speaking) */}
          {phase === "listening" && liveCaption && (
            <div className="flex gap-3 flex-row-reverse">
              <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-primary text-primary-foreground rounded-br-md">
                <p className="text-xs font-medium opacity-60 mb-1">You</p>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {liveCaption}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom area — controls + error */}
      <div className="px-4 pb-6 max-w-2xl mx-auto w-full space-y-3">
        {/* Error banner */}
        {errorBanner && (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2.5 text-sm text-destructive">
            <span className="text-xs">{errorBanner}</span>
            <button
              onClick={() => {
                setErrorBanner(null);
                clearError();
              }}
              className="text-xs underline hover:text-foreground shrink-0 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Voice / Text controls */}
        {phase === "listening" && (
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => {
                pauseCapture();
                setPhase("awaiting");
              }}
              className="flex items-center justify-center w-14 h-14 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-all active:scale-95 shadow-lg"
              aria-label="Stop recording"
            >
              <MicOff className="h-5 w-5" />
            </button>
            <span className="text-xs text-muted-foreground">
              Click to pause
            </span>
          </div>
        )}

        {phase === "awaiting" && (
          <div className="space-y-3">
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
                  className="flex-1 rounded-lg border border-input bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  autoFocus
                  aria-label="Type your answer"
                />
                <Button
                  onClick={sendTyped}
                  disabled={!typedDraft.trim() || busyRef.current}
                  size="icon"
                  className="shrink-0"
                  aria-label="Send answer"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <button
                  onClick={() => startListening()}
                  className="flex items-center justify-center w-14 h-14 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all active:scale-95 shadow-lg"
                  aria-label="Start speaking"
                >
                  <Mic className="h-5 w-5" />
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    Tap to speak
                  </span>
                  <button
                    onClick={() => setTextMode(true)}
                    className="text-xs text-muted-foreground underline hover:text-foreground cursor-pointer"
                  >
                    or type
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}