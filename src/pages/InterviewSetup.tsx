import { useState, useRef, useEffect, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  Upload,
  Link,
  FileText,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  DoorOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { SetupPayload, ParsedResumeSummary } from "@/lib/prepareInterview";
import {
  listUserResumes,
  toParsedResumeSummary,
  type SavedResume,
} from "@/lib/resumes";

type UploadStatus = "idle" | "uploading" | "ready" | "error";

export default function InterviewSetup() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentStep, setCurrentStep] = useState(0);

  const [jobUrl, setJobUrl] = useState("");
  const [jobDescription, setJobDescription] = useState("");

  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [uploadError, setUploadError] = useState("");
  const [fileName, setFileName] = useState("");
  const [resumeFilePath, setResumeFilePath] = useState("");
  const [parsedResume, setParsedResume] = useState<ParsedResumeSummary | null>(
    null,
  );
  const [savedResumes, setSavedResumes] = useState<SavedResume[]>([]);
  const [resumesLoading, setResumesLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setSavedResumes([]);
      return;
    }
    let cancelled = false;
    setResumesLoading(true);
    listUserResumes(user.id)
      .then((rows) => {
        if (!cancelled) setSavedResumes(rows);
      })
      .catch(() => {
        if (!cancelled) setSavedResumes([]);
      })
      .finally(() => {
        if (!cancelled) setResumesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (window.location.hash === "#resume") {
      setCurrentStep(0);
    }
  }, []);

  const hasContext =
    Boolean(resumeFilePath) ||
    Boolean(jobUrl.trim()) ||
    Boolean(jobDescription.trim());

  const selectSavedResume = (resume: SavedResume) => {
    setResumeFilePath(resume.file_path);
    setFileName(resume.file_name || "resume.pdf");
    setParsedResume(toParsedResumeSummary(resume));
    setUploadStatus("ready");
    setUploadError("");
  };

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      setUploadError("Only PDF files are accepted.");
      setUploadStatus("error");
      return;
    }

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

      const filePath = `${user.id}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("resumes").upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

      if (error) throw error;

      setResumeFilePath(filePath);
      setParsedResume(null);
      setUploadStatus("ready");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setUploadError(message);
      setUploadStatus("error");
      setResumeFilePath("");
      setParsedResume(null);
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
    setFileName("");
    setResumeFilePath("");
    setParsedResume(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleEnterRoom = () => {
    if (!hasContext) return;
    const payload: SetupPayload = {
      resumeFilePath: resumeFilePath || undefined,
      resumeFileName: fileName || undefined,
      parsedResume: parsedResume || undefined,
      jobUrl: jobUrl.trim() || undefined,
      jobDescription: jobDescription.trim() || undefined,
    };
    navigate("/preparing", { state: payload });
  };

  const steps = ["Resume", "Target role", "Interview settings", "Ready"];
  const canMoveForward =
    currentStep === 0 ? uploadStatus !== "uploading" : true;

  const rolePreview =
    jobUrl.trim() ||
    (jobDescription.trim()
      ? jobDescription.trim().slice(0, 80) + (jobDescription.trim().length > 80 ? "…" : "")
      : "");

  return (
    <div className="mx-auto max-w-5xl pb-16">
      <header className="mb-10 max-w-2xl">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Preparation room
        </p>
        <h1 className="font-display text-4xl leading-tight tracking-tight sm:text-5xl">
          Set the context. Enter with purpose.
        </h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
          Gather what your interviewer needs. When you enter the room, we&apos;ll
          prepare everything under the hood—then you connect and begin.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-14">
        <nav aria-label="Preparation progress">
          <ol className="grid grid-cols-4 border-y border-border lg:block lg:border-y-0 lg:border-l">
            {steps.map((step, index) => {
              const isActive = index === currentStep;
              const isComplete = index < currentStep;
              return (
                <li key={step}>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(index)}
                    className={`group flex w-full min-w-0 items-center gap-3 border-primary py-4 text-left transition-colors lg:-ml-px lg:border-l-2 lg:px-5 ${
                      isActive ? "lg:border-primary" : "lg:border-transparent"
                    }`}
                    aria-current={isActive ? "step" : undefined}
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                        isActive
                          ? "border-primary bg-primary text-primary-foreground"
                          : isComplete
                            ? "border-primary/30 bg-accent text-accent-foreground"
                            : "border-border text-muted-foreground"
                      }`}
                    >
                      {isComplete ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}
                    </span>
                    <span
                      className={`hidden text-sm lg:block ${
                        isActive ? "font-semibold text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {step}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="mt-6 hidden space-y-5 pl-5 lg:block">
            {currentStep > 0 && (
              <button type="button" onClick={() => setCurrentStep(0)} className="block w-full text-left">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Resume
                </span>
                <span className="mt-1 block truncate text-sm font-medium">
                  {fileName || "Skipped for now"}
                </span>
              </button>
            )}
            {currentStep > 1 && (
              <button type="button" onClick={() => setCurrentStep(1)} className="block w-full text-left">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Target
                </span>
                <span className="mt-1 block truncate text-sm font-medium">
                  {rolePreview || "Open context"}
                </span>
              </button>
            )}
          </div>
        </nav>

        <main className="min-w-0">
          <div className="hairline studio-shadow overflow-hidden rounded-xl bg-card">
            <div className="border-b border-border px-6 py-6 sm:px-9 sm:py-8">
              <p className="text-xs font-medium text-muted-foreground">
                Step {currentStep + 1} of {steps.length}
              </p>
              <h2 className="font-display mt-2 text-3xl tracking-tight">
                {currentStep === 0 && "Bring your experience into the room"}
                {currentStep === 1 && "Define the conversation ahead"}
                {currentStep === 2 && "Review what travels with you"}
                {currentStep === 3 && "Your preparation room is ready"}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                {currentStep === 0 &&
                  "A resume gives your interviewer the detail needed to ask grounded, relevant questions."}
                {currentStep === 1 &&
                  "Share a posting URL or paste the description. We'll fetch and analyze it when you enter."}
                {currentStep === 2 &&
                  "Confirm the context. Nothing is locked—you can step back and adjust anytime."}
                {currentStep === 3 &&
                  "When you enter, we'll parse your resume, study the role, and build the interview plan."}
              </p>
            </div>

            <div className="min-h-[380px] px-6 py-7 sm:px-9 sm:py-9">
              {currentStep === 0 && (
                <div id="resume" className="space-y-6 animate-fade-up">
                  {(resumesLoading || savedResumes.length > 0) &&
                    (uploadStatus === "idle" || uploadStatus === "error") && (
                      <section className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold">Saved resumes</p>
                          {resumesLoading && (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                          )}
                        </div>
                        <ul className="space-y-2">
                          {savedResumes.map((resume) => (
                            <li key={resume.id}>
                              <button
                                type="button"
                                onClick={() => selectSavedResume(resume)}
                                className="flex w-full items-center gap-3 rounded-xl border border-border bg-background/60 px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/30"
                              >
                                <FileText className="h-4 w-4 shrink-0 text-primary" />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-medium">
                                    {resume.parsed_name || resume.file_name}
                                  </span>
                                  <span className="block truncate text-xs text-muted-foreground">
                                    {resume.file_name}
                                    {resume.parsed_years_experience
                                      ? ` · ${resume.parsed_years_experience}`
                                      : ""}
                                  </span>
                                </span>
                                <span className="shrink-0 text-xs font-medium text-primary">
                                  Use
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                        <div className="flex items-center gap-4 pt-1">
                          <span className="h-px flex-1 bg-border" />
                          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                            or upload new
                          </span>
                          <span className="h-px flex-1 bg-border" />
                        </div>
                      </section>
                    )}

                  {uploadStatus === "idle" || uploadStatus === "error" ? (
                    <div
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      onClick={() => fileInputRef.current?.click()}
                      className="group cursor-pointer rounded-xl border border-dashed border-input bg-background/50 px-6 py-14 text-center transition-colors hover:border-primary/50 hover:bg-accent/30"
                    >
                      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card">
                        <Upload className="h-5 w-5 text-primary" />
                      </span>
                      <p className="mt-5 text-sm font-semibold">
                        Drop your resume here or choose a file
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        PDF only · Maximum 5MB
                      </p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        onChange={handleFileSelect}
                      />
                      {uploadError && (
                        <div className="mt-5 flex items-center justify-center gap-2 text-sm text-destructive">
                          <AlertCircle className="h-4 w-4" />
                          {uploadError}
                        </div>
                      )}
                    </div>
                  ) : uploadStatus === "uploading" ? (
                    <div className="rounded-xl border border-border bg-muted/30 px-6 py-14 text-center">
                      <Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" />
                      <p className="mt-5 text-sm font-semibold">Bringing your resume in…</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{fileName}</p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/25 px-5 py-5">
                      <div className="flex min-w-0 items-center gap-3">
                        <FileText className="h-5 w-5 shrink-0 text-primary" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {parsedResume?.parsed_name || fileName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {parsedResume
                              ? "Saved resume selected — ready for the room"
                              : "Ready — we'll read it when you enter the room"}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={resetUpload}
                        className="shrink-0 text-xs font-medium text-primary hover:underline"
                      >
                        Replace
                      </button>
                    </div>
                  )}
                </div>
              )}

              {currentStep === 1 && (
                <div className="space-y-8 animate-fade-up">
                  <section>
                    <label htmlFor="job-url" className="text-sm font-semibold">
                      Job posting URL
                    </label>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Optional. We&apos;ll fetch the posting during preparation.
                    </p>
                    <div className="relative mt-3">
                      <Link className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        id="job-url"
                        type="url"
                        value={jobUrl}
                        onChange={(e) => setJobUrl(e.target.value)}
                        placeholder="https://company.com/jobs/role"
                        className="w-full rounded-lg border border-input bg-background py-2.5 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    </div>
                  </section>

                  <div className="flex items-center gap-4">
                    <span className="h-px flex-1 bg-border" />
                    <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                      or paste manually
                    </span>
                    <span className="h-px flex-1 bg-border" />
                  </div>

                  <section>
                    <label htmlFor="job-description" className="text-sm font-semibold">
                      Job description
                    </label>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Paste responsibilities and requirements if you don&apos;t have a URL.
                    </p>
                    <textarea
                      id="job-description"
                      value={jobDescription}
                      onChange={(e) => setJobDescription(e.target.value)}
                      className="mt-3 min-h-[150px] w-full resize-y rounded-lg border border-input bg-background px-3.5 py-3 text-sm leading-6 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      placeholder="Paste the responsibilities, requirements, and role details here..."
                    />
                  </section>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-7 animate-fade-up">
                  <div className="rounded-xl border border-border bg-muted/25 p-5 sm:p-6">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Context in the room
                    </p>
                    <dl className="mt-5 grid gap-5 sm:grid-cols-2">
                      <div>
                        <dt className="text-xs text-muted-foreground">Resume</dt>
                        <dd className="mt-1 text-sm font-medium">
                          {fileName || "Not provided"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Target role</dt>
                        <dd className="mt-1 text-sm font-medium">
                          {jobUrl.trim()
                            ? "Job URL provided"
                            : jobDescription.trim()
                              ? "Description provided"
                              : "Not provided"}
                        </dd>
                      </div>
                    </dl>
                    {(jobUrl.trim() || jobDescription.trim()) && (
                      <p className="mt-5 line-clamp-3 text-xs leading-5 text-muted-foreground">
                        {jobUrl.trim() || jobDescription.trim()}
                      </p>
                    )}
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    On the next step you&apos;ll enter the room. We&apos;ll prepare the
                    interviewer from this context before you connect your speakers.
                  </p>
                </div>
              )}

              {currentStep === 3 && (
                <div className="animate-fade-up space-y-7">
                  <div className="rounded-xl border border-border bg-muted/25 p-5 sm:p-6">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Room briefing
                    </p>
                    <div className="mt-5 grid gap-5 sm:grid-cols-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Experience</p>
                        <p className="mt-1 text-sm font-medium">
                          {fileName || "Not provided"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Opportunity</p>
                        <p className="mt-1 text-sm font-medium">
                          {jobUrl.trim()
                            ? "Fetch from URL"
                            : jobDescription.trim()
                              ? "From pasted description"
                              : "Not provided"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {!hasContext && (
                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      Add a resume or target role before entering the interview.
                    </div>
                  )}

                  <Button
                    size="lg"
                    onClick={handleEnterRoom}
                    disabled={!hasContext}
                    className="w-full gap-2 sm:w-auto"
                  >
                    <DoorOpen className="h-4 w-4" />
                    Enter the room
                  </Button>
                </div>
              )}
            </div>

            {currentStep < 3 && (
              <div className="flex items-center justify-between border-t border-border bg-muted/20 px-6 py-4 sm:px-9">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setCurrentStep((step) => Math.max(0, step - 1))}
                  disabled={currentStep === 0}
                  className="gap-1.5"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={() => setCurrentStep((step) => Math.min(3, step + 1))}
                  disabled={!canMoveForward}
                  className="gap-1.5"
                >
                  {currentStep === 0 && !resumeFilePath
                    ? "Continue without resume"
                    : currentStep === 1 && !jobUrl.trim() && !jobDescription.trim()
                      ? "Continue without role"
                      : "Continue"}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
