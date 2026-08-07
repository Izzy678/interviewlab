import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, FileText, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { formatDuration } from "@/lib/interview";
import {
  fetchSession,
  listUserSessions,
  type SessionListItem,
} from "@/lib/sessions";
import { listUserResumes, type SavedResume } from "@/lib/resumes";

function formatSessionDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

export default function Dashboard() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const firstName = profile?.name?.trim().split(/\s+/)[0];

  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [resumes, setResumes] = useState<SavedResume[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [practiceId, setPracticeId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setSessions([]);
      setResumes([]);
      setStatus("ready");
      return;
    }

    let cancelled = false;
    setStatus("loading");

    Promise.all([
      listUserSessions(user.id).catch(() => [] as SessionListItem[]),
      listUserResumes(user.id).catch(() => [] as SavedResume[]),
    ])
      .then(([sessionRows, resumeRows]) => {
        if (cancelled) return;
        setSessions(sessionRows);
        setResumes(resumeRows);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const stats = useMemo(() => {
    const scored = sessions.filter((s) => s.overall_score != null);
    const avg =
      scored.length > 0
        ? Math.round(
            scored.reduce((sum, s) => sum + (s.overall_score || 0), 0) /
              scored.length,
          )
        : null;
    return {
      sessions: sessions.length,
      resumes: resumes.length,
      avgScore: avg,
      lastRole: sessions[0]?.target_role || null,
    };
  }, [sessions, resumes]);

  const handlePracticeAgain = async (sessionId: string) => {
    setPracticeId(sessionId);
    try {
      const row = await fetchSession(sessionId);
      if (!row?.plan_data) throw new Error("Missing plan");
      navigate(`/session/${crypto.randomUUID()}`, {
        state: { plan: row.plan_data },
      });
    } catch {
      navigate(`/report/${sessionId}`);
    } finally {
      setPracticeId(null);
    }
  };

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Workspace
        </p>
        <h1 className="mt-1 font-display text-3xl tracking-tight sm:text-4xl">
          {firstName ? `Hi, ${firstName}` : "Your workspace"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Review past sessions, reuse a resume, or start a new interview from
          the sidebar.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Sessions", value: String(stats.sessions) },
          { label: "Saved resumes", value: String(stats.resumes) },
          {
            label: "Avg. score",
            value: stats.avgScore != null ? String(stats.avgScore) : "—",
          },
          {
            label: "Last role",
            value: stats.lastRole || "—",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-border bg-card px-4 py-4"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {stat.label}
            </p>
            <p className="mt-2 truncate font-display text-2xl tracking-tight">
              {stat.value}
            </p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(260px,0.9fr)]">
        <section className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold">Recent sessions</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Open a report or practice the same role again
            </p>
          </div>

          {status === "loading" && (
            <div className="flex items-center gap-2 px-5 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          )}

          {status === "error" && (
            <div className="px-5 py-8 text-sm text-muted-foreground">
              Couldn&apos;t load history. Make sure the{" "}
              <code className="text-xs">interview_sessions</code> table exists.
            </div>
          )}

          {status === "ready" && sessions.length === 0 && (
            <div className="px-5 py-10">
              <p className="text-sm font-medium">No sessions yet</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Start from <span className="font-medium text-foreground">New interview</span>{" "}
                in the sidebar. Completed sessions will appear here.
              </p>
            </div>
          )}

          {status === "ready" && sessions.length > 0 && (
            <ul className="divide-y divide-border">
              {sessions.map((session) => (
                <li
                  key={session.id}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {session.target_role || "Practice interview"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatSessionDate(session.created_at)}
                      {session.target_seniority
                        ? ` · ${session.target_seniority}`
                        : ""}
                      {session.duration_seconds != null
                        ? ` · ${formatDuration(session.duration_seconds)}`
                        : ""}
                      {session.overall_score != null
                        ? ` · ${session.overall_score}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/report/${session.id}`}>Report</Link>
                    </Button>
                    <Button
                      size="sm"
                      disabled={practiceId === session.id}
                      onClick={() => void handlePracticeAgain(session.id)}
                      className="gap-1.5"
                    >
                      {practiceId === session.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3.5 w-3.5" />
                      )}
                      Practice
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside>
          <section className="rounded-xl border border-border bg-card">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold">Saved resumes</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Available when you start a new interview
              </p>
            </div>
            {status === "loading" ? (
              <div className="flex items-center gap-2 px-5 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading…
              </div>
            ) : resumes.length === 0 ? (
              <div className="px-5 py-8">
                <p className="text-sm text-muted-foreground">
                  No resumes saved yet. You can upload one during setup.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {resumes.slice(0, 5).map((resume) => (
                  <li key={resume.id} className="flex items-center gap-3 px-5 py-3.5">
                    <FileText className="h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {resume.parsed_name || resume.file_name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {resume.file_name}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {resumes.length > 0 && (
              <div className="border-t border-border px-5 py-3">
                <Link
                  to="/setup#resume"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  Use in new interview
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
