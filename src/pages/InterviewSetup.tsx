import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

const jobLevels = ["Entry Level", "Mid Level", "Senior", "Staff", "Principal"];

export default function InterviewSetup() {
  const navigate = useNavigate();
  const [selectedLevel, setSelectedLevel] = useState("Mid Level");

  const handleStart = () => {
    // For now, navigate to a placeholder session
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
          <CardTitle>Resume</CardTitle>
          <CardDescription>
            Upload your resume so the AI can tailor questions to your experience.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed border-border rounded-lg p-12 text-center hover:border-muted-foreground/50 transition-colors cursor-pointer">
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-4" />
            <p className="text-sm font-medium">Drop your resume here</p>
            <p className="text-xs text-muted-foreground mt-1">
              PDF or DOCX, up to 5MB
            </p>
          </div>
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
            className="w-full min-h-[120px] rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
            placeholder="Paste the job description here..."
          />
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
        <Button size="lg" onClick={handleStart} className="gap-2">
          <Send className="h-4 w-4" />
          Start Interview
        </Button>
      </div>
    </div>
  );
}