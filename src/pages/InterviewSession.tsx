import { useParams } from "react-router-dom";
import { Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function InterviewSession() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Interview</h1>
          <p className="text-sm text-muted-foreground">
            Session #{id} — In Progress
          </p>
        </div>
        <Button variant="destructive" className="gap-2">
          <Square className="h-4 w-4 fill-current" />
          End Session
        </Button>
      </div>

      {/* Chat area */}
      <Card className="min-h-[400px] flex flex-col">
        <CardContent className="flex-1 p-6 space-y-4">
          {/* AI Message */}
          <div className="flex gap-3 items-start">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                AI
              </AvatarFallback>
            </Avatar>
            <div className="bg-muted rounded-lg px-4 py-3 max-w-[80%]">
              <p className="text-sm">
                Welcome to your interview! I'll be asking you a series of questions
                related to the role you're preparing for. Take your time with each
                response. Let's start with a warm-up: tell me a bit about yourself.
              </p>
            </div>
          </div>

          {/* Placeholder for user messages */}
          <div className="flex gap-3 items-start justify-end">
            <div className="bg-primary text-primary-foreground rounded-lg px-4 py-3 max-w-[80%]">
              <p className="text-sm">
                Your responses will appear here...
              </p>
            </div>
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="text-xs">JD</AvatarFallback>
            </Avatar>
          </div>
        </CardContent>
      </Card>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        <Button
          variant="outline"
          size="lg"
          className="rounded-full h-14 w-14"
        >
          <Mic className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}