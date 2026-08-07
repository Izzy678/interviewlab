import { supabase } from "@/lib/supabase";

/* ── Types ──────────────────────────────────────────────── */

export interface InterviewQuestion {
  id: string;
  question: string;
  category: "recruiter" | "behavioral" | "technical" | "follow_up";
  difficulty: "easy" | "medium" | "hard";
  focus_area: string;
  expected_answer_points: string[];
  context?: string;
}

export interface InterviewPlanSection {
  title: string;
  description: string;
  questions: InterviewQuestion[];
}

export interface InterviewPlanData {
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

export interface ChatMessage {
  role: "assistant" | "user";
  content: string;
}

export type InterviewStage =
  | "greeting"
  | "introduction"
  | "background"
  | "core"
  | "follow_up"
  | "wrap_up"
  | "concluded";

export interface InterviewReply {
  message: string;
  stage: InterviewStage;
  done: boolean;
}

export interface InterviewAnalysis {
  overall_score: number;
  summary: string;
  metrics: {
    clarity: number;
    depth: number;
    relevance: number;
    communication: number;
  };
  strengths: string[];
  improvements: string[];
}

/* ── Helpers ────────────────────────────────────────────── */

/** Build a minimal plan with empty sections (used for "Skip to Interview"). */
export function emptyPlan(
  overrides?: Partial<InterviewPlanData>,
): InterviewPlanData {
  const emptySection = (
    title: string,
    description = "",
  ): InterviewPlanSection => ({
    title,
    description,
    questions: [],
  });

  return {
    candidate_name: "",
    target_role: "",
    target_seniority: "Mid Level",
    overall_difficulty: "Medium",
    sections: {
      recruiter_questions: emptySection("Recruiter / Screening Questions"),
      behavioral_questions: emptySection("Behavioral Questions"),
      technical_questions: emptySection("Technical Questions"),
      follow_up_questions: emptySection("Follow-Up Questions"),
    },
    preparation_tips: [],
    ...overrides,
  };
}

/** Format seconds → "MM:SS". */
export function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/** Download a blob of text as a file. */
export function downloadText(
  text: string,
  filename = "transcript.txt",
): void {
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Format conversation as readable text for export. */
export function formatTranscript(
  conversation: ChatMessage[],
  plan: InterviewPlanData,
  durationSeconds?: number,
): string {
  const role = plan.target_role || "Interview";
  const lines: string[] = [
    `InterviewLab — Mock Interview Transcript`,
    `Role: ${role}`,
    `Duration: ${durationSeconds ? formatDuration(durationSeconds) : "N/A"}`,
    ``,
    `─`.repeat(60),
    ``,
  ];
  for (const msg of conversation) {
    const speaker =
      msg.role === "assistant" ? "Interviewer" : "Candidate";
    lines.push(`${speaker}: ${msg.content}`);
    lines.push(``);
  }
  lines.push(`─`.repeat(60));
  return lines.join("\n");
}

/* ── API calls ──────────────────────────────────────────── */

/**
 * Call the interview-chat Edge Function to get the next interviewer utterance.
 */
export async function fetchInterviewReply(
  plan: InterviewPlanData,
  history: ChatMessage[],
): Promise<InterviewReply> {
  const { data, error } = await supabase.functions.invoke("interview-chat", {
    method: "POST",
    body: { plan, history },
  });

  if (error) {
    const payload = data as { error?: string; details?: string } | null;
    const details = [payload?.error, payload?.details]
      .filter(Boolean)
      .join(" — ");
    const base = details || error.message || "Failed to reach the interviewer.";
    const friendly = /rate.?limit|429|quota|resource.?exhausted/i.test(base)
      ? `The interviewer is temporarily rate-limited. Wait a few seconds, then tap Retry. (${base.slice(0, 160)})`
      : base;
    throw new Error(friendly);
  }
  if (!data?.message) {
    throw new Error(
      "The interviewer didn't respond. Please try again.",
    );
  }
  return data as InterviewReply;
}

/**
 * Call the analyze-interview Edge Function to get post-interview feedback.
 */
export async function analyzeInterview(
  plan: InterviewPlanData,
  conversation: ChatMessage[],
  durationSeconds?: number,
): Promise<InterviewAnalysis> {
  const { data, error } = await supabase.functions.invoke(
    "analyze-interview",
    {
      method: "POST",
      body: { plan, conversation, durationSeconds },
    },
  );

  if (error) {
    throw new Error(error.message || "Failed to analyze the interview.");
  }
  return data as InterviewAnalysis;
}