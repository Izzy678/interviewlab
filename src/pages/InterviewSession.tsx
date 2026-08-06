import { useState, useRef, useCallback, useEffect } from "react";
import { useParams, useLocation, useNavigate, Link } from "react-router-dom";
import {
  Mic,
  Square,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  CheckCircle2,
  Timer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/common/EmptyState";
import { supabase } from "@/lib/supabase";

/* ── Types ─────────────────────────────────────────────── */

interface InterviewQuestion {
  id: string;
  question: string;
  category: "recruiter" | "behavioral" | "technical" | "follow_up";
  difficulty: "easy" | "medium" | "hard";
  focus_area: string;
  expected_answer_points: string[];
  context?: string;
}

interface InterviewPlanSection {
  title: string;
  description: string;
  questions: InterviewQuestion[];
}

interface InterviewPlanData {
  candidate_name: string;
  target_role: string;
  target_seniority: string;
  overall_difficulty: string;
  sections: {
    recruiter_questions: InterviewPlanSection;
    behavioral_questions: InterviewPlanSection;
    technical_questions: InterviewPlanSection;
    follow_up_questions: InterviewPlanSection;
  };
  preparation_tips: string[];
}

/* ── Helpers ────────────────────────────────────────────── */

const difficultyColors: Record<string, string> = {
  easy: "bg-emerald-100 text-emerald-700 border-emerald-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  hard: "bg-orange-100 text-orange-700 border-orange-200",
};

const categoryLabels: Record<string, string> = {
  recruiter: "Recruiter / Screening",
  behavioral: "Behavioral",
  technical: "Technical",
  follow_up: "Follow-Up",
};

const categoryIndicatorColors: Record<string, string> = {
  recruiter: "bg-sky-500",
  behavioral: "bg-violet-500",
  technical: "bg-emerald-500",
  follow_up: "bg-amber-500",
};

function flattenQuestions(plan: InterviewPlanData): InterviewQuestion[] {
  const order: (keyof InterviewPlanData["sections"])[] = [
    "recruiter_questions",
    "behavioral_questions",
    "technical_questions",
    "follow_up_questions",
  ];
  const all: InterviewQuestion[] = [];
  for (const key of order) {
    all.push(...plan.sections[key].questions);
  }
  return all;
}

/* ── Speech recognition types (Speechmatics WebSocket) ── */

interface SpeechmaticsAlternative {
  content: string;
  confidence?: number;
}

interface SpeechmaticsResult {
  alternatives: SpeechmaticsAlternative[];
  start_time: number;
  end_time: number;
  type: "word" | "punctuation";
}

interface SpeechmaticsMessage {
  message: string;
  results?: SpeechmaticsResult[];
  channel?: string;
}

/* ── Custom hook: Speechmatics-powered recognition ────── */

function useSpeechRecognition() {
  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const finalTranscriptRef = useRef("");
  const interimTranscriptRef = useRef("");

  /* Speechmatics works in any modern browser with mic + WebSocket support */
  const supported =
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia;

  const stopAudioCapture = useCallback(() => {
    /* Disconnect & close audio graph */
    if (processorRef.current && sourceRef.current) {
      try {
        processorRef.current.disconnect();
        sourceRef.current.disconnect();
      } catch { /* already disconnected */ }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    processorRef.current = null;
    sourceRef.current = null;
  }, []);

  const closeWs = useCallback(() => {
    if (wsRef.current) {
      try {
        /* Signal end-of-stream before closing */
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({ message: "EndOfStream", last_seq_no: null }),
          );
        }
      } catch { /* ignore */ }
      try {
        wsRef.current.close();
      } catch { /* ignore */ }
      wsRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    closeWs();
    stopAudioCapture();
    setIsListening(false);
    /* Merge any remaining interim into final */
    if (interimTranscriptRef.current) {
      finalTranscriptRef.current +=
        (finalTranscriptRef.current ? " " : "") + interimTranscriptRef.current;
      setTranscript(finalTranscriptRef.current);
      interimTranscriptRef.current = "";
    }
  }, [closeWs, stopAudioCapture]);

  const reset = useCallback(() => {
    stop();
    finalTranscriptRef.current = "";
    interimTranscriptRef.current = "";
    setTranscript("");
    setError(null);
  }, [stop]);

  const start = useCallback(async () => {
    if (!supported) {
      setError("Voice input is not available in this browser.");
      return;
    }

    /* Clean up any previous session */
    reset();
    finalTranscriptRef.current = "";
    interimTranscriptRef.current = "";

    try {
      /* 1. Fetch a temporary Speechmatics JWT from our edge function */
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;
      if (!accessToken) {
        setError("You must be signed in to use voice input.");
        return;
      }

      const tokenRes = await supabase.functions.invoke("speechmatics-token", {
        method: "POST",
      });

      if (tokenRes.error) {
        setError(
          `Failed to get speech token: ${tokenRes.error.message || "Unknown error"}`,
        );
        return;
      }

      const { token } = tokenRes.data as { token: string };
      if (!token) {
        setError("Failed to get speech token — empty response.");
        return;
      }

      /* 2. Open WebSocket to Speechmatics EU region */
      const ws = new WebSocket(`wss://eu.rt.speechmatics.com/v2?jwt=${token}`);
      wsRef.current = ws;

      ws.onopen = async () => {
        /* 3. Send StartRecognition message */
        const startMsg = {
          message: "StartRecognition",
          audio_format: {
            type: "raw",
            encoding: "pcm_s16le",
            sample_rate: 16000,
            channels: 1,
          },
          transcription_config: {
            language: "en",
            max_delay: 2,
            enable_partials: true,
          },
        };
        ws.send(JSON.stringify(startMsg));

        /* 4. Start microphone capture */
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              sampleRate: 48000,
              channelCount: 1,
              echoCancellation: true,
              noiseSuppression: true,
            },
          });
          streamRef.current = stream;

          const audioCtx = new AudioContext({ sampleRate: 48000 });
          audioCtxRef.current = audioCtx;

          const source = audioCtx.createMediaStreamSource(stream);
          sourceRef.current = source;

          const processor = audioCtx.createScriptProcessor(4096, 1, 1);
          processorRef.current = processor;

          const targetSampleRate = 16000;

          processor.onaudioprocess = (event) => {
            const input = event.inputBuffer.getChannelData(0);
            const inputLen = input.length;
            const inputRate = audioCtx.sampleRate;

            /* Downsample to 16kHz */
            const ratio = inputRate / targetSampleRate;
            const outputLen = Math.floor(inputLen / ratio);
            const output = new Float32Array(outputLen);

            for (let i = 0; i < outputLen; i++) {
              const srcIdx = Math.round(i * ratio);
              output[i] = input[Math.min(srcIdx, inputLen - 1)];
            }

            /* Convert Float32 [-1..1] to PCM S16LE */
            const pcm = new Int16Array(outputLen);
            for (let i = 0; i < outputLen; i++) {
              const s = Math.max(-1, Math.min(1, output[i]));
              pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }

            /* Send binary audio data if WebSocket is open */
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(pcm.buffer);
            }
          };

          source.connect(processor);
          processor.connect(audioCtx.destination);

          setIsListening(true);
          setError(null);
        } catch (micErr) {
          const msg =
            micErr instanceof Error ? micErr.message : "Microphone access denied";
          setError(msg);
          ws.close();
        }
      };

      ws.onmessage = (event) => {
        try {
          if (typeof event.data !== "string") return;

          const msg: SpeechmaticsMessage = JSON.parse(event.data);

          if (msg.message === "AddPartialTranscript" && msg.results) {
            /* Build interim text from partial results */
            const text = msg.results
              .filter((r) => r.type !== "punctuation")
              .map((r) => r.alternatives?.[0]?.content || "")
              .join(" ");

            interimTranscriptRef.current = text;
            if (text) {
              setTranscript(
                finalTranscriptRef.current
                  ? finalTranscriptRef.current + " " + text
                  : text,
              );
            } else {
              setTranscript(finalTranscriptRef.current);
            }
          } else if (msg.message === "AddTranscript" && msg.results) {
            /* Append final transcript */
            const text = msg.results
              .filter((r) => r.type !== "punctuation")
              .map((r) => r.alternatives?.[0]?.content || "")
              .join(" ");

            if (text) {
              finalTranscriptRef.current +=
                (finalTranscriptRef.current ? " " : "") + text;
            }
            interimTranscriptRef.current = "";
            setTranscript(finalTranscriptRef.current);
          } else if (msg.message === "EndOfTranscript") {
            /* Server confirmed end — no action needed */
          }
        } catch { /* ignore parse errors */ }
      };

      ws.onerror = () => {
        setError("Speech recognition connection failed.");
        setIsListening(false);
        stopAudioCapture();
      };

      ws.onclose = () => {
        setIsListening(false);
        stopAudioCapture();
      };

      setTranscript("");
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to start speech recognition";
      setError(msg);
      setIsListening(false);
    }
  }, [supported, reset, stopAudioCapture]);

  useEffect(() => {
    return () => {
      closeWs();
      stopAudioCapture();
    };
  }, [closeWs, stopAudioCapture]);

  return { transcript, isListening, error, supported, start, stop, reset };
}

/* ── Component ──────────────────────────────────────────── */

export default function InterviewSession() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const plan = location.state?.plan as InterviewPlanData | undefined;

  const {
    transcript,
    isListening,
    error: speechError,
    supported: speechSupported,
    start: startListening,
    stop: stopListening,
    reset: resetSpeech,
  } = useSpeechRecognition();

  /* Flatten questions */
  const questions = plan ? flattenQuestions(plan) : [];
  const totalQuestions = questions.length;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState<Record<number, string>>({});

  const currentQuestion = questions[currentIndex] ?? null;

  /* Update the response for current question when speech transcript changes */
  useEffect(() => {
    if (isListening && transcript) {
      setResponses((prev) => ({ ...prev, [currentIndex]: transcript }));
    }
  }, [transcript, isListening, currentIndex]);

  const currentResponse = responses[currentIndex] || "";

  const handleTextChange = (value: string) => {
    setResponses((prev) => ({ ...prev, [currentIndex]: value }));
  };

  const handleNext = () => {
    if (currentIndex < totalQuestions - 1) {
      if (isListening) stopListening();
      resetSpeech();
      setCurrentIndex((i) => i + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      if (isListening) stopListening();
      resetSpeech();
      setCurrentIndex((i) => i - 1);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      resetSpeech();
      startListening();
    }
  };

  /* ── Empty state ── */
  if (!plan) {
    return (
      <div className="max-w-2xl mx-auto pt-12">
        <EmptyState
          title="No interview session data"
          description="Generate and review an interview plan first, then start your session from there."
          action={
            <Button asChild>
              <Link to="/setup">Go to Setup</Link>
            </Button>
          }
        />
      </div>
    );
  }

  /* ── Finished state ── */
  if (currentIndex >= totalQuestions && totalQuestions > 0) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 text-center pt-12">
        <div className="flex justify-center">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
        </div>
        <h2 className="text-2xl font-bold tracking-tight">
          Interview Complete!
        </h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          You answered all {totalQuestions} questions. Your responses have been
          saved for this session. View the report to see your feedback.
        </p>
        <div className="flex items-center justify-center gap-3 pt-4">
          <Button variant="outline" onClick={() => navigate("/dashboard")}>
            Go to Dashboard
          </Button>
          <Button asChild>
            <Link to={`/report/${id}`}>View Report</Link>
          </Button>
        </div>
      </div>
    );
  }

  /* ── Main session UI ── */

  const progressPct =
    totalQuestions > 0 ? ((currentIndex + 1) / totalQuestions) * 100 : 0;

  const currentCategory = currentQuestion?.category || "technical";
  const categoryColor =
    categoryIndicatorColors[currentCategory] || "bg-primary";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div className="h-4 w-px bg-border" />
          <div>
            <h1 className="text-lg font-bold tracking-tight leading-tight">
              Interview Session
            </h1>
            {plan.target_role && (
              <p className="text-xs text-muted-foreground">
                {plan.target_role}
              </p>
            )}
          </div>
        </div>
        <Button
          variant="destructive"
          size="sm"
          className="gap-2"
          onClick={() => navigate("/dashboard")}
        >
          <Square className="h-3.5 w-3.5 fill-current" />
          End Session
        </Button>
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Question {currentIndex + 1} of {totalQuestions}
          </span>
          <span className="font-medium">{Math.round(progressPct)}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Current Question */}
      {currentQuestion && (
        <>
          {/* Question card */}
          <Card className="border-primary/20">
            <CardContent className="p-6 space-y-4">
              {/* Category + Difficulty badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    difficultyColors[currentQuestion.difficulty] ||
                    "bg-gray-100 text-gray-700 border-gray-200"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${categoryColor}`}
                  />
                  {categoryLabels[currentQuestion.category] ||
                    currentQuestion.category}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-muted text-muted-foreground border-border capitalize">
                  {currentQuestion.difficulty}
                </span>
              </div>

              {/* Question text */}
              <div>
                <p className="text-lg font-semibold leading-relaxed">
                  {currentQuestion.question}
                </p>
                {currentQuestion.focus_area && (
                  <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1.5">
                    <Timer className="h-3.5 w-3.5" />
                    Focus: {currentQuestion.focus_area}
                  </p>
                )}
              </div>

              {/* Answer tips (collapsed) */}
              {currentQuestion.expected_answer_points.length > 0 && (
                <details className="group">
                  <summary className="text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors list-none flex items-center gap-1.5">
                    <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
                    {currentQuestion.expected_answer_points.length} key points
                    to cover
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {currentQuestion.expected_answer_points.map((point, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-xs text-muted-foreground"
                      >
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/50 mt-1.5 shrink-0" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </CardContent>
          </Card>

          {/* Voice controls */}
          <div className="flex items-center justify-center gap-4">
            <Button
              variant={isListening ? "default" : "outline"}
              size="lg"
              className={`rounded-full h-14 w-14 transition-all duration-200 ${
                isListening
                  ? "bg-destructive hover:bg-destructive/90 scale-110 shadow-lg shadow-destructive/25"
                  : ""
              }`}
              onClick={toggleListening}
              aria-label={
                isListening ? "Stop recording" : "Start voice response"
              }
            >
              {isListening ? (
                <Square className="h-5 w-5 fill-current" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </Button>
            {isListening && (
              <span className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
                <span className="inline-block w-2 h-2 rounded-full bg-destructive" />
                Listening...
              </span>
            )}
            {!speechSupported && (
              <p className="text-xs text-muted-foreground">
                Voice input not available in this browser. Type your response
                below.
              </p>
            )}
          </div>

          {/* Speech error */}
          {speechError && (
            <div className="flex items-center justify-center gap-2 text-xs text-destructive">
              <span>{speechError}</span>
              <button
                onClick={() => resetSpeech()}
                className="underline hover:text-foreground"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Transcript / Answer area */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="response-textarea"
                  className="text-sm font-medium"
                >
                  Your Response
                  {currentResponse && (
                    <span className="ml-2 text-xs text-muted-foreground font-normal">
                      ({currentResponse.split(" ").filter(Boolean).length}{" "}
                      words)
                    </span>
                  )}
                </label>
                {isListening && (
                  <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Transcribing speech...
                  </span>
                )}
              </div>
              <textarea
                id="response-textarea"
                value={currentResponse}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder={
                  isListening
                    ? "Speak now — your words will appear here..."
                    : "Type your answer here, or use the mic button above to speak..."
                }
                className="w-full min-h-[120px] rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
              />
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              className="gap-1.5"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>

            <span className="text-xs text-muted-foreground">
              {currentIndex + 1} / {totalQuestions}
            </span>

            {currentIndex < totalQuestions - 1 ? (
              <Button onClick={handleNext} className="gap-1.5">
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={() => setCurrentIndex(totalQuestions)}
                className="gap-1.5"
              >
                <CheckCircle2 className="h-4 w-4" />
                Finish Session
              </Button>
            )}
          </div>

          {/* Answer progress dots */}
          <details className="text-center">
            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
              Response progress —{" "}
              {Object.keys(responses).length} of {totalQuestions} answered
            </summary>
            <div className="flex justify-center gap-1 pt-2">
              {questions.map((_, i) => (
                <span
                  key={i}
                  className={`inline-block w-2.5 h-2.5 rounded-full transition-colors ${
                    responses[i]
                      ? "bg-primary"
                      : i === currentIndex
                        ? "bg-primary/40 ring-2 ring-primary/30"
                        : "bg-muted-foreground/20"
                  }`}
                  title={`Question ${i + 1}${responses[i] ? " ✓ answered" : ""}`}
                />
              ))}
            </div>
          </details>
        </>
      )}
    </div>
  );
}