import { supabase } from "@/lib/supabase";
import type {
  ChatMessage,
  InterviewAnalysis,
  InterviewPlanData,
} from "@/lib/interview";

export interface InterviewSessionRow {
  id: string;
  user_id: string;
  target_role: string;
  target_seniority: string;
  candidate_name: string;
  plan_data: InterviewPlanData;
  conversation: ChatMessage[];
  duration_seconds: number | null;
  analysis: InterviewAnalysis | null;
  created_at: string;
  completed_at: string | null;
}

export interface SessionListItem {
  id: string;
  target_role: string;
  target_seniority: string;
  candidate_name: string;
  duration_seconds: number | null;
  overall_score: number | null;
  created_at: string;
  completed_at: string | null;
}

export async function saveInterviewSession(input: {
  userId: string;
  plan: InterviewPlanData;
  conversation: ChatMessage[];
  durationSeconds?: number;
}): Promise<string> {
  const { data, error } = await supabase
    .from("interview_sessions")
    .insert({
      user_id: input.userId,
      target_role: input.plan.target_role || "",
      target_seniority: input.plan.target_seniority || "",
      candidate_name: input.plan.candidate_name || "",
      plan_data: input.plan,
      conversation: input.conversation,
      duration_seconds: input.durationSeconds ?? null,
      completed_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message || "Failed to save interview session");
  }
  return data.id as string;
}

export async function updateSessionAnalysis(
  sessionId: string,
  analysis: InterviewAnalysis,
): Promise<void> {
  const { error } = await supabase
    .from("interview_sessions")
    .update({ analysis })
    .eq("id", sessionId);

  if (error) {
    throw new Error(error.message || "Failed to save interview analysis");
  }
}

export async function fetchSession(
  sessionId: string,
): Promise<InterviewSessionRow | null> {
  const { data, error } = await supabase
    .from("interview_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to load interview session");
  }
  return data as InterviewSessionRow | null;
}

export async function listUserSessions(
  userId: string,
  limit = 20,
): Promise<SessionListItem[]> {
  const { data, error } = await supabase
    .from("interview_sessions")
    .select(
      "id, target_role, target_seniority, candidate_name, duration_seconds, analysis, created_at, completed_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message || "Failed to load interview history");
  }

  return (data || []).map((row) => ({
    id: row.id,
    target_role: row.target_role || "",
    target_seniority: row.target_seniority || "",
    candidate_name: row.candidate_name || "",
    duration_seconds: row.duration_seconds,
    overall_score:
      row.analysis && typeof row.analysis === "object"
        ? ((row.analysis as InterviewAnalysis).overall_score ?? null)
        : null,
    created_at: row.created_at,
    completed_at: row.completed_at,
  }));
}
