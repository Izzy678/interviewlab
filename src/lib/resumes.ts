import { supabase } from "@/lib/supabase";
import type { ParsedResumeSummary } from "@/lib/prepareInterview";

export interface SavedResume {
  id: string;
  file_path: string;
  file_name: string;
  parsed_name: string;
  parsed_years_experience: string;
  parsed_skills: string[];
  parsed_companies: string[];
  parsed_projects: string[];
  parsed_education: string[];
  parsed_at: string | null;
}

export async function listUserResumes(
  userId: string,
  limit = 8,
): Promise<SavedResume[]> {
  const { data, error } = await supabase
    .from("resumes")
    .select(
      "id, file_path, file_name, parsed_name, parsed_years_experience, parsed_skills, parsed_companies, parsed_projects, parsed_education, parsed_at",
    )
    .eq("user_id", userId)
    .order("parsed_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message || "Failed to load saved resumes");
  }

  return (data || []) as SavedResume[];
}

export function toParsedResumeSummary(resume: SavedResume): ParsedResumeSummary {
  return {
    id: resume.id,
    parsed_name: resume.parsed_name || "",
    parsed_years_experience: resume.parsed_years_experience || "",
    parsed_skills: resume.parsed_skills || [],
    parsed_companies: resume.parsed_companies || [],
    parsed_projects: resume.parsed_projects || [],
    parsed_education: resume.parsed_education || [],
  };
}
