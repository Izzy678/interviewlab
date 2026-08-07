import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams, Link } from "react-router-dom";
import {
  Download,
  Loader2,
  CheckCircle2,
  TrendingUp,
  Target,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { StageLabel } from "@/components/studio/StudioPrimitives";
import {
  analyzeInterview,
  formatDuration,
  downloadText,
  formatTranscript,
  type InterviewAnalysis,
  type ChatMessage,
  type InterviewPlanData,
} from "@/lib/interview";
import {
  fetchSession,
  updateSessionAnalysis,
} from "@/lib/sessions";

type ReportState = {
  plan: InterviewPlanData;
  conversation: ChatMessage[];
  durationSeconds?: number;
  sessionId?: string;
};

export default function InterviewReport() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const routeState = location.state as ReportState | undefined;

  const [plan, setPlan] = useState<InterviewPlanData | null>(
    routeState?.plan ?? null,
  );
  const [conversation, setConversation] = useState<ChatMessage[]>(
    routeState?.conversation ?? [],
  );
  const [durationSeconds, setDurationSeconds] = useState<number | undefined>(
    routeState?.durationSeconds,
  );
  const [sessionId, setSessionId] = useState<string | undefined>(
    routeState?.sessionId || (id && id !== "1" && id !== "latest" ? id : undefined),
  );
  const [loadStatus, setLoadStatus] = useState<
    "ready" | "loading" | "missing"
  >(routeState?.plan ? "ready" : "loading");

  const [analysis, setAnalysis] = useState<InterviewAnalysis | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");

  useEffect(() => {
    if (routeState?.plan && routeState.conversation) {
      setPlan(routeState.plan);
      setConversation(routeState.conversation);
      setDurationSeconds(routeState.durationSeconds);
      if (routeState.sessionId) setSessionId(routeState.sessionId);
      setLoadStatus("ready");
      return;
    }

    if (!id || id === "1" || id === "latest") {
      setLoadStatus("missing");
      return;
    }

    let cancelled = false;
    setLoadStatus("loading");
    fetchSession(id)
      .then((row) => {
        if (cancelled) return;
        if (!row) {
          setLoadStatus("missing");
          return;
        }
        setPlan(row.plan_data);
        setConversation(row.conversation || []);
        setDurationSeconds(row.duration_seconds ?? undefined);
        setSessionId(row.id);
        if (row.analysis) {
          setAnalysis(row.analysis);
          setAnalysisStatus("ready");
        }
        setLoadStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setLoadStatus("missing");
      });

    return () => {
      cancelled = true;
    };
  }, [id, routeState]);

  useEffect(() => {
    if (loadStatus !== "ready" || !plan || conversation.length < 2) return;
    if (analysisStatus === "ready" || analysisStatus === "loading") return;

    setAnalysisStatus("loading");
    analyzeInterview(plan, conversation, durationSeconds)
      .then(async (result) => {
        setAnalysis(result);
        setAnalysisStatus("ready");
        if (sessionId) {
          try {
            await updateSessionAnalysis(sessionId, result);
          } catch (err) {
            console.error("Failed to persist analysis", err);
          }
        }
      })
      .catch(() => {
        setAnalysisStatus("error");
      });
  }, [
    loadStatus,
    plan,
    conversation,
    durationSeconds,
    sessionId,
    analysisStatus,
  ]);

  const handlePracticeAgain = () => {
    if (!plan) {
      navigate("/setup");
      return;
    }
    navigate(`/session/${crypto.randomUUID()}`, { state: { plan } });
  };

  if (loadStatus === "loading") {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading your report…</p>
      </div>
    );
  }

  if (loadStatus === "missing" || !plan) {
    return (
      <div className="mx-auto max-w-2xl pt-12">
        <EmptyState
          title="No interview data"
          description="Complete an interview session first to see your report here."
          action={
            <Button asChild>
              <Link to="/setup">Start an Interview</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const totalExchanges = Math.floor(conversation.length / 2);

  return (
    <div className="mx-auto max-w-5xl pb-16">
      <header className="flex items-start justify-between border-b border-border/70 pb-8">
        <div className="max-w-2xl">
          <StageLabel active>Interviewer feedback</StageLabel>
          <h1 className="mt-5 font-heading text-4xl font-medium tracking-tight sm:text-5xl">
            A thoughtful review of your conversation.
          </h1>
          <p className="mt-4 text-sm text-muted-foreground">
            {plan.target_role || "Practice interview"}
            {durationSeconds !== undefined &&
              ` · ${formatDuration(durationSeconds)}`}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 gap-2 rounded-full"
          onClick={() => {
            downloadText(
              formatTranscript(conversation, plan, durationSeconds),
              `interview-${plan.target_role || "transcript"}.txt`,
            );
          }}
        >
          <Download className="h-4 w-4" />
          Export
        </Button>
      </header>

      {analysisStatus === "loading" && (
        <div className="flex min-h-[420px] flex-col items-center justify-center gap-5 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-muted/30">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
          <div>
            <p className="font-heading text-xl">Reviewing the conversation</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Turning your interview into useful, specific feedback.
            </p>
          </div>
        </div>
      )}

      {analysisStatus === "error" && (
        <div className="my-10 flex items-center gap-3 border-y border-destructive/20 py-5 text-sm text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>
            We couldn&apos;t analyze your interview right now. The transcript is
            still available below.
          </span>
        </div>
      )}

      {analysis && (
        <div className="animate-in fade-in duration-700">
          {analysis.summary && (
            <section className="grid gap-8 border-b border-border/70 py-12 md:grid-cols-[180px_1fr] md:py-16">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                From your interviewer
              </p>
              <blockquote className="max-w-3xl font-heading text-2xl leading-relaxed tracking-tight text-foreground sm:text-3xl">
                “{analysis.summary}”
              </blockquote>
            </section>
          )}

          <section className="grid gap-12 border-b border-border/70 py-12 sm:grid-cols-2 md:py-16">
            {analysis.strengths.length > 0 && (
              <div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <h2 className="text-sm font-semibold">What came through well</h2>
                </div>
                <div className="mt-7 space-y-6">
                  {analysis.strengths.map((s, i) => (
                    <div key={i} className="flex items-start gap-4">
                      <span className="pt-0.5 font-heading text-sm tabular-nums text-muted-foreground/50">
                        0{i + 1}
                      </span>
                      <p className="text-sm leading-6 text-muted-foreground">{s}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {analysis.improvements.length > 0 && (
              <div>
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-4 w-4 text-amber-600" />
                  <h2 className="text-sm font-semibold">Where to focus next</h2>
                </div>
                <div className="mt-7 space-y-6">
                  {analysis.improvements.map((s, i) => (
                    <div key={i} className="flex items-start gap-4">
                      <span className="pt-0.5 font-heading text-sm tabular-nums text-muted-foreground/50">
                        0{i + 1}
                      </span>
                      <p className="text-sm leading-6 text-muted-foreground">{s}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="border-b border-border/70 py-10">
            <p className="mb-7 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Conversation signals
            </p>
            <div className="grid grid-cols-2 gap-y-8 sm:grid-cols-5">
              {[
                ["Overall", analysis.overall_score],
                ["Clarity", analysis.metrics.clarity],
                ["Depth", analysis.metrics.depth],
                ["Relevance", analysis.metrics.relevance],
                ["Communication", analysis.metrics.communication],
              ].map(([label, score]) => (
                <div
                  key={label as string}
                  className="border-l border-border pl-4 first:border-l-0 first:pl-0"
                >
                  <p className="font-heading text-3xl tabular-nums">{score as number}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{label as string}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      <details className="group border-b border-border/70 py-8">
        <summary className="flex cursor-pointer list-none items-center justify-between">
          <div>
            <h2 className="font-heading text-xl">Conversation transcript</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {totalExchanges > 0
                ? `${totalExchanges} exchange${totalExchanges === 1 ? "" : "s"}`
                : "Full conversation from your interview session."}
            </p>
          </div>
          <span className="text-xs text-muted-foreground group-open:hidden">View</span>
          <span className="hidden text-xs text-muted-foreground group-open:inline">
            Close
          </span>
        </summary>
        <div className="mt-10 space-y-8">
          {conversation.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No transcript available.
            </p>
          ) : (
            conversation.map((msg, i) => {
              const isAi = msg.role === "assistant";
              return (
                <div key={i} className="grid gap-2 sm:grid-cols-[120px_1fr]">
                  <div className="pt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {isAi ? "Interviewer" : "You"}
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-7 text-foreground/75">
                    {msg.content}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </details>

      <div className="flex flex-wrap justify-center gap-3 pt-10">
        <Button onClick={handlePracticeAgain} className="rounded-full gap-2">
          <RotateCcw className="h-4 w-4" />
          Practice this role again
        </Button>
        <Button asChild variant="outline" className="rounded-full">
          <Link to="/setup">
            <Target className="h-4 w-4 mr-2" />
            New interview
          </Link>
        </Button>
      </div>
    </div>
  );
}
