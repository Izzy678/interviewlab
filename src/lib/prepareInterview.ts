import { supabase } from "@/lib/supabase";
import type { InterviewPlanData } from "@/lib/interview";
import { emptyPlan } from "@/lib/interview";

export type PrepStageId =
  | "parse_resume"
  | "fetch_job"
  | "analyze_job"
  | "create_plan";

export type PrepStageStatus = "pending" | "active" | "done" | "error" | "skipped";

export interface PrepStage {
  id: PrepStageId;
  label: string;
  detail: string;
  status: PrepStageStatus;
}

export interface SetupPayload {
  resumeFilePath?: string;
  resumeFileName?: string;
  /** When set, skip re-parsing and reuse stored resume fields. */
  parsedResume?: ParsedResumeSummary;
  jobUrl?: string;
  jobDescription?: string;
}

export interface ParsedResumeSummary {
  id?: string;
  parsed_name: string;
  parsed_years_experience: string;
  parsed_skills: string[];
  parsed_companies: string[];
  parsed_projects: string[];
  parsed_education: string[];
}

export interface ParsedJobSummary {
  role: string;
  seniority: string;
  required_skills: string[];
  nice_to_have_skills: string[];
  responsibilities: string[];
}

const MIN_STAGE_MS = 1400;

export function buildPrepStages(payload: SetupPayload): PrepStage[] {
  const stages: PrepStage[] = [];

  if (payload.resumeFilePath && !payload.parsedResume) {
    stages.push({
      id: "parse_resume",
      label: "Parsing resume",
      detail: "Reading your experience into the room",
      status: "pending",
    });
  } else if (payload.parsedResume) {
    stages.push({
      id: "parse_resume",
      label: "Loading resume",
      detail: "Reusing your saved experience profile",
      status: "pending",
    });
  }

  if (payload.jobUrl?.trim()) {
    stages.push({
      id: "fetch_job",
      label: "Fetching job posting",
      detail: "Opening the opportunity you shared",
      status: "pending",
    });
  }

  if (payload.jobUrl?.trim() || payload.jobDescription?.trim()) {
    stages.push({
      id: "analyze_job",
      label: "Analyzing job description",
      detail: "Understanding the role and expectations",
      status: "pending",
    });
  }

  stages.push({
    id: "create_plan",
    label: "Creating interview plan",
    detail: "Shaping the conversation ahead",
    status: "pending",
  });

  return stages;
}

async function invokeFunction<T>(
  name: string,
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });

  if (error) {
    let details = error.message || `Failed calling ${name}`;
    const context = (error as { context?: Response }).context;
    if (context && typeof context.json === "function") {
      try {
        const payload = await context.json();
        if (payload?.error) {
          details = payload.details
            ? `${payload.error}: ${payload.details}`
            : payload.error;
        }
      } catch {
        // keep generic
      }
    } else if (data && typeof data === "object" && "error" in data) {
      const payload = data as { error?: string; details?: string };
      details = payload.details
        ? `${payload.error}: ${payload.details}`
        : payload.error || details;
    }
    throw new Error(details);
  }

  if (data && typeof data === "object" && "error" in data && (data as { error?: string }).error) {
    const payload = data as { error?: string; details?: string };
    throw new Error(
      payload.details ? `${payload.error}: ${payload.details}` : payload.error || "Request failed",
    );
  }

  return data as T;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withMinDuration<T>(promise: Promise<T>, minMs = MIN_STAGE_MS): Promise<T> {
  const started = Date.now();
  const result = await promise;
  const elapsed = Date.now() - started;
  if (elapsed < minMs) await sleep(minMs - elapsed);
  return result;
}

export type PrepProgressHandler = (stages: PrepStage[], activeId: PrepStageId | null) => void;

export async function runInterviewPreparation(
  payload: SetupPayload,
  onProgress: PrepProgressHandler,
): Promise<InterviewPlanData> {
  const stages = buildPrepStages(payload);
  let resume: ParsedResumeSummary | null = null;
  let job: ParsedJobSummary | null = null;
  let jobText = payload.jobDescription?.trim() || "";

  const setStatus = (
    id: PrepStageId,
    status: PrepStageStatus,
    detail?: string,
  ) => {
    const next = stages.map((stage) =>
      stage.id === id
        ? { ...stage, status, ...(detail ? { detail } : {}) }
        : stage,
    );
    stages.splice(0, stages.length, ...next);
    onProgress(
      stages.map((s) => ({ ...s })),
      status === "active" ? id : null,
    );
  };

  try {
    if (payload.parsedResume) {
      const r = payload.parsedResume;
      const skillHint = (r.parsed_skills || []).slice(0, 3).join(" · ");
      setStatus(
        "parse_resume",
        "active",
        r.parsed_name
          ? `Loading ${r.parsed_name}${skillHint ? ` · ${skillHint}` : ""}`
          : "Reusing your saved experience profile",
      );
      await sleep(900);
      resume = payload.parsedResume;
      setStatus(
        "parse_resume",
        "done",
        r.parsed_name
          ? `Ready with ${r.parsed_name}'s profile`
          : "Resume context loaded",
      );
    } else if (payload.resumeFilePath) {
      setStatus("parse_resume", "active");
      const result = await withMinDuration(
        invokeFunction<{ resume: ParsedResumeSummary }>("parse-resume", {
          filePath: payload.resumeFilePath,
          fileName: payload.resumeFileName || "resume.pdf",
        }),
      );
      resume = result.resume;
      const skillHint = (resume.parsed_skills || []).slice(0, 3).join(" · ");
      setStatus(
        "parse_resume",
        "done",
        resume.parsed_name
          ? `Matched ${resume.parsed_name}${skillHint ? ` · ${skillHint}` : ""}`
          : "Experience profile ready",
      );
    }

    if (payload.jobUrl?.trim()) {
      setStatus(
        "fetch_job",
        "active",
        `Opening ${payload.jobUrl.trim().replace(/^https?:\/\//, "").slice(0, 48)}…`,
      );
      const result = await withMinDuration(
        invokeFunction<{
          jobDescription?: string;
          parsed?: ParsedJobSummary;
        }>("fetch-job-url", { url: payload.jobUrl.trim() }),
      );
      if (result.jobDescription?.trim()) {
        jobText = result.jobDescription.trim();
      }
      if (result.parsed && (result.parsed.role || result.parsed.required_skills?.length)) {
        job = result.parsed;
      }
      setStatus(
        "fetch_job",
        "done",
        job?.role ? `Fetched posting for ${job.role}` : "Posting retrieved",
      );
    }

    if (payload.jobUrl?.trim() || payload.jobDescription?.trim()) {
      setStatus(
        "analyze_job",
        "active",
        job?.role
          ? `Understanding ${job.role}${job.seniority ? ` · ${job.seniority}` : ""}`
          : "Understanding the role and expectations",
      );
      if (job) {
        await sleep(MIN_STAGE_MS);
      } else if (jobText) {
        const result = await withMinDuration(
          invokeFunction<{ parsed: ParsedJobSummary }>("parse-job-description", {
            rawText: jobText,
          }),
        );
        job = result.parsed;
      } else {
        await sleep(MIN_STAGE_MS);
      }
      const focus = (job?.required_skills || []).slice(0, 3).join(" · ");
      setStatus(
        "analyze_job",
        "done",
        job?.role
          ? `Focused on ${job.role}${focus ? ` · ${focus}` : ""}`
          : "Role context ready",
      );
    }

    const planHint =
      job?.role ||
      resume?.parsed_name ||
      "your conversation";
    setStatus(
      "create_plan",
      "active",
      `Shaping Alexa’s plan for ${planHint}`,
    );
    const resumeData = resume
      ? {
          parsed_name: resume.parsed_name,
          parsed_years_experience: resume.parsed_years_experience,
          parsed_skills: resume.parsed_skills,
          parsed_companies: resume.parsed_companies,
          parsed_projects: resume.parsed_projects,
          parsed_education: resume.parsed_education,
        }
      : undefined;
    const jobData = job
      ? {
          role: job.role,
          seniority: job.seniority,
          required_skills: job.required_skills,
          nice_to_have_skills: job.nice_to_have_skills,
          responsibilities: job.responsibilities,
        }
      : undefined;

    const plan = await withMinDuration(
      invokeFunction<InterviewPlanData>("generate-interview-plan", {
        resumeData,
        jobData,
      }),
    );
    setStatus(
      "create_plan",
      "done",
      plan.target_role
        ? `Interview plan ready for ${plan.target_role}`
        : "Interview strategy ready",
    );

    return {
      ...emptyPlan(),
      ...plan,
      candidate_name: plan.candidate_name || resume?.parsed_name || "",
      target_role: plan.target_role || job?.role || "",
      target_seniority: plan.target_seniority || job?.seniority || "Mid Level",
    };
  } catch (err) {
    const active = stages.find((s) => s.status === "active");
    if (active) setStatus(active.id, "error");
    throw err;
  }
}
