import { useState, useRef, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  Upload,
  Send,
  Link,
  FileText,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Briefcase,
  GraduationCap,
  Star,
  Building2,
  FolderGit2,
  User,
  Sparkles,
  ListChecks,
  TrendingUp,
  Wand2,
  Globe,
  Cpu,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

interface ParsedResume {
  id: string;
  parsed_name: string;
  parsed_years_experience: string;
  parsed_skills: string[];
  parsed_companies: string[];
  parsed_projects: string[];
  parsed_education: string[];
}

interface ParsedJobDescription {
  role: string;
  seniority: string;
  required_skills: string[];
  nice_to_have_skills: string[];
  responsibilities: string[];
}

type UploadStatus = "idle" | "uploading" | "parsing" | "success" | "error";
type JdStatus = "idle" | "analyzing" | "success" | "error";
type UrlStatus = "idle" | "importing" | "success" | "error";

interface JobUrlResult {
  jobDescription: string;
  companyName: string;
  companyOverview: string;
  techStack: string[];
  parsed: ParsedJobDescription;
}

export default function InterviewSetup() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [jobUrl, setJobUrl] = useState("");
  const [jobDescription, setJobDescription] = useState("");

  // Resume state
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [uploadError, setUploadError] = useState("");
  const [parsedResume, setParsedResume] = useState<ParsedResume | null>(null);
  const [fileName, setFileName] = useState("");

  // JD analysis state
  const [jdStatus, setJdStatus] = useState<JdStatus>("idle");
  const [jdError, setJdError] = useState("");
  const [parsedJd, setParsedJd] = useState<ParsedJobDescription | null>(null);

  // Job URL import state
  const [urlStatus, setUrlStatus] = useState<UrlStatus>("idle");
  const [urlError, setUrlError] = useState("");
  const [urlResult, setUrlResult] = useState<JobUrlResult | null>(null);

  // Plan generation state
  const [planStatus, setPlanStatus] = useState<"idle" | "generating" | "error">("idle");
  const [planError, setPlanError] = useState("");

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (file.type !== "application/pdf") {
      setUploadError("Only PDF files are accepted.");
      setUploadStatus("error");
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("File is too large. Maximum size is 5MB.");
      setUploadStatus("error");
      return;
    }

    setFileName(file.name);
    setUploadStatus("uploading");
    setUploadError("");

    try {
      if (!user) throw new Error("You must be signed in to upload a resume.");

      // Upload to Supabase Storage
      const filePath = `${user.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("resumes")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Call the Edge Function to parse
      setUploadStatus("parsing");

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) throw new Error("No auth session found.");

      const response = await fetch(
        "https://edbytsuykbezfvniwdyd.supabase.co/functions/v1/parse-resume",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            filePath,
            fileName: file.name,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.details || result.error || "Failed to parse resume");
      }

      setParsedResume(result.resume);
      setUploadStatus("success");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      setUploadError(message);
      setUploadStatus("error");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const input = fileInputRef.current;
      if (input) {
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        handleFileSelect({ target: { files: dt.files } } as ChangeEvent<HTMLInputElement>);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const resetUpload = () => {
    setUploadStatus("idle");
    setUploadError("");
    setParsedResume(null);
    setFileName("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleAnalyzeJobDescription = async () => {
    const text = jobDescription.trim();
    if (!text) return;

    setJdStatus("analyzing");
    setJdError("");

    try {
      if (!user) throw new Error("You must be signed in to analyze a job description.");

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("No auth session found.");

      const response = await fetch(
        "https://edbytsuykbezfvniwdyd.supabase.co/functions/v1/parse-job-description",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ rawText: text }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.details || result.error || "Failed to analyze job description");
      }

      setParsedJd(result.parsed);
      setJdStatus("success");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      setJdError(message);
      setJdStatus("error");
    }
  };

  const resetJdAnalysis = () => {
    setJdStatus("idle");
    setJdError("");
    setParsedJd(null);
  };

  const handleImportFromUrl = async () => {
    const url = jobUrl.trim();
    if (!url) return;

    setUrlStatus("importing");
    setUrlError("");

    try {
      if (!user) throw new Error("You must be signed in to import a job URL.");

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("No auth session found.");

      const response = await fetch(
        "https://edbytsuykbezfvniwdyd.supabase.co/functions/v1/fetch-job-url",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ url }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.details || result.error || "Failed to import job URL");
      }

      const data = result as JobUrlResult;

      // Populate the job description textarea
      setJobDescription(data.jobDescription || "");

      // Store the full URL result for display
      setUrlResult(data);

      // Auto-populate JD analysis if the parsed fields are available
      if (data.parsed && (data.parsed.role || data.parsed.required_skills.length > 0)) {
        setParsedJd(data.parsed);
        setJdStatus("success");
      }

      setUrlStatus("success");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      setUrlError(message);
      setUrlStatus("error");
    }
  };

  const resetUrlImport = () => {
    setUrlStatus("idle");
    setUrlError("");
    setUrlResult(null);
  };

  const handleGeneratePlan = async () => {
    setPlanStatus("generating");
    setPlanError("");

    try {
      if (!user) throw new Error("You must be signed in to generate an interview plan.");

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("No auth session found.");

      const resumeData = parsedResume
        ? {
            parsed_name: parsedResume.parsed_name,
            parsed_years_experience: parsedResume.parsed_years_experience,
            parsed_skills: parsedResume.parsed_skills,
            parsed_companies: parsedResume.parsed_companies,
            parsed_projects: parsedResume.parsed_projects,
            parsed_education: parsedResume.parsed_education,
          }
        : undefined;

      const jobData = parsedJd
        ? {
            role: parsedJd.role,
            seniority: parsedJd.seniority,
            required_skills: parsedJd.required_skills,
            nice_to_have_skills: parsedJd.nice_to_have_skills,
            responsibilities: parsedJd.responsibilities,
          }
        : undefined;

      const response = await fetch(
        "https://edbytsuykbezfvniwdyd.supabase.co/functions/v1/generate-interview-plan",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            resumeData,
            jobData,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.details || result.error || "Failed to generate interview plan");
      }

      navigate("/plan", { state: { plan: result, fromSetup: true } });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      setPlanError(message);
      setPlanStatus("error");
    }
  };

  const handleStart = () => {
    // Build a minimal plan so the interviewer can improvise questions from
    // the resume + job description context without a full generated plan.
    const fallbackPlan = {
      candidate_name: parsedResume?.parsed_name || "",
      target_role: parsedJd?.role || "",
      target_seniority: parsedJd?.seniority || "Mid Level",
      overall_difficulty: "Medium",
      sections: {
        recruiter_questions: {
          title: "Recruiter / Screening Questions",
          description: "",
          questions: [],
        },
        behavioral_questions: {
          title: "Behavioral Questions",
          description: "",
          questions: [],
        },
        technical_questions: {
          title: "Technical Questions",
          description: "",
          questions: [],
        },
        follow_up_questions: {
          title: "Follow-Up Questions",
          description: "",
          questions: [],
        },
      },
      preparation_tips: [],
    };
    navigate("/session/1", { state: { plan: fallbackPlan } });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Setup Interview</h1>
        <p className="text-muted-foreground mt-1">
          Configure your mock interview and start practicing.
        </p>
      </div>

      {/* Resume Upload */}
      <Card>
        <CardHeader>
          <CardTitle>
            Resume
            {uploadStatus === "success" && (
              <span className="ml-2 inline-flex items-center gap-1 text-sm font-normal text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
                Parsed
              </span>
            )}
          </CardTitle>
          <CardDescription>
            Upload your resume so the AI can tailor questions to your
            experience.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {uploadStatus === "idle" || uploadStatus === "error" ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-lg p-12 text-center hover:border-muted-foreground/50 transition-colors cursor-pointer"
            >
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm font-medium">
                Drop your resume here or click to browse
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                PDF only, up to 5MB
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleFileSelect}
              />
              {uploadError && (
                <div className="mt-4 flex items-center justify-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {uploadError}
                </div>
              )}
            </div>
          ) : uploadStatus === "uploading" || uploadStatus === "parsing" ? (
            <div className="border-2 border-border rounded-lg p-12 text-center">
              <Loader2 className="h-8 w-8 mx-auto text-primary mb-4 animate-spin" />
              <p className="text-sm font-medium">
                {uploadStatus === "uploading"
                  ? "Uploading resume..."
                  : "Parsing resume with AI..."}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{fileName}</p>
            </div>
          ) : uploadStatus === "success" && parsedResume ? (
            <div className="space-y-4">
              {/* File info bar */}
              <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-3">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">{fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      Parsed successfully
                    </p>
                  </div>
                </div>
                <button
                  onClick={resetUpload}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Upload different
                </button>
              </div>

              {/* Parsed data summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {parsedResume.parsed_name && (
                  <div className="flex items-start gap-2 rounded-lg border bg-background p-3">
                    <User className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Name</p>
                      <p className="text-sm font-medium truncate">
                        {parsedResume.parsed_name}
                      </p>
                    </div>
                  </div>
                )}
                {parsedResume.parsed_years_experience && (
                  <div className="flex items-start gap-2 rounded-lg border bg-background p-3">
                    <Briefcase className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Experience</p>
                      <p className="text-sm font-medium truncate">
                        {parsedResume.parsed_years_experience}
                      </p>
                    </div>
                  </div>
                )}
                {parsedResume.parsed_skills &&
                  parsedResume.parsed_skills.length > 0 && (
                    <div className="flex items-start gap-2 rounded-lg border bg-background p-3 sm:col-span-2">
                      <Star className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground mb-1">
                          Skills
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {parsedResume.parsed_skills.map((skill, i) => (
                            <span
                              key={i}
                              className="inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                {parsedResume.parsed_companies &&
                  parsedResume.parsed_companies.length > 0 && (
                    <div className="flex items-start gap-2 rounded-lg border bg-background p-3">
                      <Building2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">
                          Companies
                        </p>
                        <ul className="text-sm">
                          {parsedResume.parsed_companies.map((c, i) => (
                            <li key={i} className="truncate">
                              {c}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                {parsedResume.parsed_education &&
                  parsedResume.parsed_education.length > 0 && (
                    <div className="flex items-start gap-2 rounded-lg border bg-background p-3">
                      <GraduationCap className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">
                          Education
                        </p>
                        <ul className="text-sm">
                          {parsedResume.parsed_education.map((e, i) => (
                            <li key={i} className="truncate">
                              {e}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                {parsedResume.parsed_projects &&
                  parsedResume.parsed_projects.length > 0 && (
                    <div className="flex items-start gap-2 rounded-lg border bg-background p-3 sm:col-span-2">
                      <FolderGit2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">
                          Projects
                        </p>
                        <ul className="text-sm list-disc list-inside">
                          {parsedResume.parsed_projects.map((p, i) => (
                            <li key={i} className="truncate">
                              {p}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Job Description */}
      <Card>
        <CardHeader>
          <CardTitle>
            Job Description
            {jdStatus === "success" && (
              <span className="ml-2 inline-flex items-center gap-1 text-sm font-normal text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
                Analyzed
              </span>
            )}
          </CardTitle>
          <CardDescription>
            Paste the job description you're preparing for.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            className="w-full min-h-[120px] rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
            placeholder="Paste the job description here..."
          />

          {jdStatus === "analyzing" ? (
            <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 text-primary animate-spin" />
              Analyzing job description with AI...
            </div>
          ) : jdStatus === "error" ? (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{jdError}</span>
            </div>
          ) : null}

          {jdStatus === "success" && parsedJd ? (
            <div className="space-y-4">
              {/* Analyzed data summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {parsedJd.role && (
                  <div className="flex items-start gap-2 rounded-lg border bg-background p-3">
                    <Briefcase className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Role</p>
                      <p className="text-sm font-medium truncate">
                        {parsedJd.role}
                      </p>
                    </div>
                  </div>
                )}
                {parsedJd.seniority && (
                  <div className="flex items-start gap-2 rounded-lg border bg-background p-3">
                    <TrendingUp className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Seniority</p>
                      <p className="text-sm font-medium truncate">
                        {parsedJd.seniority}
                      </p>
                    </div>
                  </div>
                )}
                {parsedJd.required_skills &&
                  parsedJd.required_skills.length > 0 && (
                    <div className="flex items-start gap-2 rounded-lg border bg-background p-3 sm:col-span-2">
                      <Star className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground mb-1">
                          Required Skills
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {parsedJd.required_skills.map((skill, i) => (
                            <span
                              key={i}
                              className="inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                {parsedJd.nice_to_have_skills &&
                  parsedJd.nice_to_have_skills.length > 0 && (
                    <div className="flex items-start gap-2 rounded-lg border bg-background p-3 sm:col-span-2">
                      <Sparkles className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground mb-1">
                          Nice-to-have Skills
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {parsedJd.nice_to_have_skills.map((skill, i) => (
                            <span
                              key={i}
                              className="inline-block rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                {parsedJd.responsibilities &&
                  parsedJd.responsibilities.length > 0 && (
                    <div className="flex items-start gap-2 rounded-lg border bg-background p-3 sm:col-span-2">
                      <ListChecks className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground mb-1">
                          Responsibilities
                        </p>
                        <ul className="text-sm list-disc list-inside space-y-0.5">
                          {parsedJd.responsibilities.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
              </div>
              <button
                onClick={resetJdAnalysis}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Analyze again
              </button>
            </div>
          ) : (
            <Button
              onClick={handleAnalyzeJobDescription}
              disabled={!jobDescription.trim()}
              className="gap-2"
            >
              <Wand2 className="h-4 w-4" />
              Analyze Job Description
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Job Posting URL */}
      <Card>
        <CardHeader>
          <CardTitle>
            Job Posting URL
            {urlStatus === "success" && (
              <span className="ml-2 inline-flex items-center gap-1 text-sm font-normal text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
                Imported
              </span>
            )}
          </CardTitle>
          <CardDescription>
            Paste a job posting URL and the AI will fetch the details
            automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* URL Input + Import Button */}
          {(urlStatus === "idle" || urlStatus === "error") && (
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="url"
                  value={jobUrl}
                  onChange={(e) => setJobUrl(e.target.value)}
                  placeholder="https://example.com/jobs/software-engineer"
                  className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <Button
                onClick={handleImportFromUrl}
                disabled={!jobUrl.trim()}
                className="gap-2 shrink-0"
              >
                <Globe className="h-4 w-4" />
                Import
              </Button>
            </div>
          )}

          {/* URL error */}
          {urlStatus === "error" && urlError && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{urlError}</span>
              </div>
              <button
                onClick={() => setUrlStatus("idle")}
                className="text-xs underline hover:text-foreground shrink-0"
              >
                Try again
              </button>
            </div>
          )}

          {/* Importing state */}
          {urlStatus === "importing" && (
            <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 text-primary animate-spin" />
              <span>Fetching job details from URL...</span>
            </div>
          )}

          {/* Import results */}
          {urlStatus === "success" && urlResult && (
            <div className="space-y-3">
              {/* Company info */}
              {urlResult.companyName && (
                <div className="flex items-start gap-2 rounded-lg border bg-background p-3">
                  <Building2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">Company</p>
                    <p className="text-sm font-medium">{urlResult.companyName}</p>
                    {urlResult.companyOverview && (
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {urlResult.companyOverview}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Tech stack */}
              {urlResult.techStack.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg border bg-background p-3">
                  <Cpu className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground mb-1.5">
                      Tech Stack
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {urlResult.techStack.map((tech, i) => (
                        <span
                          key={i}
                          className="inline-block rounded-full bg-primary/5 border border-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={resetUrlImport}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Import different URL
                </button>
                {urlResult.jobDescription && (
                  <span className="text-xs text-muted-foreground">
                    Job description filled in below
                  </span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generate Interview Plan */}
      <Card>
        <CardHeader>
          <CardTitle>
            Interview Plan
            {planStatus === "generating" && (
              <span className="ml-2 inline-flex items-center gap-1 text-sm font-normal text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </span>
            )}
          </CardTitle>
          <CardDescription>
            Generate a tailored interview plan with questions based on your
            resume and job description.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Plan generation error */}
          {planStatus === "error" && planError && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{planError}</span>
            </div>
          )}

          {/* Generating state */}
          {planStatus === "generating" ? (
            <div className="rounded-lg border bg-muted/40 p-8 text-center">
              <Loader2 className="h-8 w-8 mx-auto text-primary mb-4 animate-spin" />
              <p className="text-sm font-medium">
                Generating your interview plan...
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                The AI is creating recruiter, behavioral, technical, and
                follow-up questions tailored to your profile.
              </p>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                size="lg"
                onClick={handleGeneratePlan}
                disabled={
                  !parsedResume && !parsedJd
                }
                className="gap-2 flex-1"
              >
                <BookOpen className="h-4 w-4" />
                Generate Interview Plan
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={handleStart}
                disabled={
                  !parsedResume && !parsedJd
                }
                className="gap-2"
              >
                <Send className="h-4 w-4" />
                Skip to Interview
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}