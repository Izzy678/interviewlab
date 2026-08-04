import { useParams } from "react-router-dom";
import { Download, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

export default function InterviewReport() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Interview Report</h1>
          <p className="text-muted-foreground mt-1">
            Session #{id} — Completed
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Share2 className="h-4 w-4" />
            Share
          </Button>
        </div>
      </div>

      {/* Score Overview */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Overall Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-primary">—</div>
            <p className="text-xs text-muted-foreground mt-1">Score pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Clarity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">—</div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting analysis</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Depth</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">—</div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting analysis</p>
          </CardContent>
        </Card>
      </div>

      {/* Transcript */}
      <Card>
        <CardHeader>
          <CardTitle>Transcript</CardTitle>
          <CardDescription>
            The full conversation from your interview session.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <div className="w-12 shrink-0 text-xs font-medium text-muted-foreground pt-1">
                  Q{i}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="bg-muted rounded-lg px-4 py-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      Interviewer
                    </p>
                    <p className="text-sm">Question text will appear here...</p>
                  </div>
                  <div className="bg-primary/5 rounded-lg px-4 py-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      Your Answer
                    </p>
                    <p className="text-sm">Your response will appear here...</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Feedback */}
      <Card>
        <CardHeader>
          <CardTitle>Feedback</CardTitle>
          <CardDescription>
            AI-generated insights to help you improve.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Detailed feedback will appear here after you complete an interview session.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}