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

/* ── Speech recognition types (browser API) ────────────── */

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechRecognitionResult[];
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: { transcript: string };
}

/* ── Custom hook: Speech Recognition ───────────────────── */

function useSpeechRecognition() {
  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<ReturnType<typeof createRecognition> | null>(null);

  const supported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const createRecognition = () => {
    const SpeechRecognitionAPI =
      (window as unknown as Record<string, new () => unknown>).SpeechRecognition ||
      (window as unknown as Record<string, new () => unknown>).webkitSpeechRecognition;
    return new (SpeechRecognitionAPI as new () => {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      onresult: ((event: SpeechRecognitionEventLike) => void) | null;
      onerror: ((event: { error: string }) => void) | null;
      onend: (() => void) | null;
      start: () => void;
      stop: () => void;
    })();
  };

  const start = useCallback(() => {
    if (!supported) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    const recognition = createRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interimText += result[0].transcript;
        }
      }
      setTranscript((prev) => {
        const base = finalText
          ? prev + (prev && !prev.endsWith(" ") ? " " : "") + finalText
          : prev;
        return interimText ? base + (base ? " " : "") + interimText : base;
      });
    };

    recognition.onerror = (event: { error: string }) => {
      if (event.error === "no-speech") return;
      setError(`Recognition error: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    setTranscript("");
    setError(null);
    setIsListening(true);
    recognition.start();
  }, [supported]);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const reset = useCallback(() => {
    stop();
    setTranscript("");
    setError(null);
  }, [stop]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

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