import { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import {
  Download,
  Loader2,
  CheckCircle2,
  TrendingUp,
  Target,
  Lightbulb,
  AlertCircle,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { EmptyState } from "@/components/common/EmptyState";
import {
  analyzeInterview,
  formatDuration,
  downloadText,
  formatTranscript,
  type InterviewAnalysis,
  type ChatMessage,
  type InterviewPlanData,
} from "@/lib/interview";

/* ── Helpers ────────────────────────────────────────────── */

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-amber-600";
  if (score >= 40) return "text-orange-600";
  return "text-destructive";
}

function MetricCard({
  label,
  score,
}: {
  label: string;
  score: number;
  icon?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-3xl font-bold ${scoreColor(score)}`}>
          {score}
        </div>
        <p className="text-xs text-muted-foreground mt-1">/ 100</p>
      </CardContent>
    </Card>
  );
}

/* ── Component ──────────────────────────────────────────── */

export default function InterviewReport() {
  const location = useLocation();
  const state = location.state as
    | {
        plan: InterviewPlanData;
        conversation: ChatMessage[];
        durationSeconds?: number;
      }
    | undefined;

  const [analysis, setAnalysis] = useState<InterviewAnalysis | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");

  useEffect(() => {
    if (!state?.plan || !state?.conversation || state.conversation.length < 2)
      return;
    setAnalysisStatus("loading");
    analyzeInterview(
      state.plan,
      state.conversation,
      state.durationSeconds,
    )
      .then((result) => {
        setAnalysis(result);
        setAnalysisStatus("ready");
      })
      .catch(() => {
        setAnalysisStatus("error");
      });
  }, [state]);

  if (!state?.plan || !state?.conversation) {
    return (
      <div className="max-w-2xl mx-auto pt-12">
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

  const { plan, conversation, durationSeconds } = state;
  const totalExchanges = Math.floor(conversation.length / 2);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-heading">
            Interview Report
          </h1>
          <p className="text-muted-foreground mt-1">
            {plan.target_role && (
              <span className="font-medium text-foreground">
                {plan.target_role}
              </span>
            )}
            {durationSeconds !== undefined && (
              <span className="ml-2">
                &middot; {formatDuration(durationSeconds)}
              </span>
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
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
      </div>

      {/* Score Overview */}
      {analysisStatus === "loading" && (
        <Card>
          <CardContent className="flex items-center justify-center gap-3 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            Analyzing your interview…
          </CardContent>
        </Card>
      )}

      {analysisStatus === "error" && (
        <Card className="border-destructive/20">
          <CardContent className="flex items-center gap-3 py-6 text-sm text-destructive">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>
              We couldn't analyze your interview right now. The transcript is
              still available below.
            </span>
          </CardContent>
        </Card>
      )}

      {analysis && (
        <>
          {/* Score cards */}
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
            <Card className="col-span-2 sm:col-span-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Overall Score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={`text-4xl font-bold ${scoreColor(analysis.overall_score)}`}
                >
                  {analysis.overall_score}
                </div>
                <p className="text-xs text-muted-foreground mt-1">/ 100</p>
              </CardContent>
            </Card>
            <MetricCard
              label="Clarity"
              score={analysis.metrics.clarity}
            />
            <MetricCard label="Depth" score={analysis.metrics.depth} />
            <MetricCard
              label="Relevance"
              score={analysis.metrics.relevance}
            />
          </div>

          {/* Summary */}
          {analysis.summary && (
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {analysis.summary}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Strengths / Improvements */}
          <div className="grid gap-6 sm:grid-cols-2">
            {analysis.strengths.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <CardTitle className="text-base">Strengths</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {analysis.strengths.map((s, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 shrink-0" />
                      <span className="text-muted-foreground">{s}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {analysis.improvements.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-amber-600" />
                    <CardTitle className="text-base">
                      Areas to Improve
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {analysis.improvements.map((s, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 shrink-0" />
                      <span className="text-muted-foreground">{s}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}

      {/* Transcript */}
      <Card>
        <CardHeader>
          <CardTitle>Transcript</CardTitle>
          <CardDescription>
            {totalExchanges > 0
              ? `${totalExchanges} exchange${totalExchanges === 1 ? "" : "s"}`
              : "Full conversation from your interview session."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {conversation.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No transcript available.
            </p>
          ) : (
            conversation.map((msg, i) => {
              const isAi = msg.role === "assistant";
              return (
                <div key={i} className="flex gap-3">
                  <div
                    className={`w-20 shrink-0 text-xs font-medium pt-1 ${
                      isAi ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {isAi ? "Interviewer" : "You"}
                  </div>
                  <div
                    className={`flex-1 rounded-lg px-4 py-3 ${
                      isAi
                        ? "bg-muted"
                        : "bg-primary/5 border border-primary/10"
                    }`}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Bottom CTA */}
      <div className="flex justify-center pb-8">
        <Button asChild variant="outline">
          <Link to="/setup">
            <Target className="h-4 w-4 mr-2" />
            Practice Again
          </Link>
        </Button>
      </div>
    </div>
  );
}