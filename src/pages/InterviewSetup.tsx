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

const jobLevels = ["Entry Level", "Mid Level", "Senior", "Staff", "Principal"];

interface ParsedResume {
  id: string;
  parsed_name: string;
  parsed_years_experience: string;
  parsed_skills: string[];
  parsed_companies: string[];
  parsed_projects: string[];
  parsed_education: string[];
}

type UploadStatus = "idle" | "uploading" | "parsing" | "success" | "error";

export default function InterviewSetup() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedLevel, setSelectedLevel] = useState("Mid Level");
  const [jobUrl, setJobUrl] = useState("");
  const [jobDescription, setJobDescription] = useState("");

  // Resume state
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [uploadError, setUploadError] = useState("");
  const [parsedResume, setParsedResume] = useState<ParsedResume | null>(null);
  const [fileName, setFileName] = useState("");

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
        throw new Error(result.error || "Failed to parse resume");
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

  const handleStart = () => {
    navigate("/session/1");
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
          <CardTitle>Job Description</CardTitle>
          <CardDescription>
            Paste the job description you're preparing for.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            className="w-full min-h-[120px] rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
            placeholder="Paste the job description here..."
          />
        </CardContent>
      </Card>

      {/* Job URL */}
      <Card>
        <CardHeader>
          <CardTitle>Job Posting URL</CardTitle>
          <CardDescription>
            Optional — link to the job posting so the AI can pull in more
            context.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="url"
              value={jobUrl}
              onChange={(e) => setJobUrl(e.target.value)}
              placeholder="https://example.com/jobs/software-engineer"
              className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        </CardContent>
      </Card>

      {/* Job Level */}
      <Card>
        <CardHeader>
          <CardTitle>Target Level</CardTitle>
          <CardDescription>
            Select the seniority level you're interviewing for.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {jobLevels.map((level) => (
              <button
                key={level}
                onClick={() => setSelectedLevel(level)}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                  selectedLevel === level
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:border-primary/50"
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Start Button */}
      <div className="flex justify-end">
        <Button
          size="lg"
          onClick={handleStart}
          className="gap-2"
        >
          <Send className="h-4 w-4" />
          Start Interview
        </Button>
      </div>
    </div>
  );
}