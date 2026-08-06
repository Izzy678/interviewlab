import { useLocation, useNavigate, Link } from "react-router-dom";
import {
  Mic,
  Sparkles,
  Briefcase,
  Gauge,
  UserRound,
  Lock,
  ArrowRight,
  MessageCircle,
  Flag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/common/EmptyState";
import type { InterviewPlanData } from "@/lib/interview";

const steps = [
  {
    icon: UserRound,
    title: "Meet your interviewer",
    desc: "A warm greeting and introduction to settle in.",
  },
  {
    icon: MessageCircle,
    title: "Quick warm-up chat",
    desc: "A light conversation about you and your background.",
  },
  {
    icon: Briefcase,
    title: "Role-specific questions",
    desc: "Questions tailored to your profile and the target role.",
  },
  {
    icon: Flag,
    title: "Wrap-up & report",
    desc: "The interviewer closes the session and your feedback report is prepared.",
  },
];

export default function InterviewPlan() {
  const location = useLocation();
  const navigate = useNavigate();
  const plan = location.state?.plan as InterviewPlanData | undefined;

  if (!plan) {
    return (
      <div className="max-w-2xl mx-auto pt-12">
        <EmptyState
          title="No interview plan found"
          description="Generate an interview plan first by uploading your resume and job description in the setup page."
          action={
            <Button asChild>
              <Link to="/setup">Go to Setup</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="flex justify-center">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10">
            <Mic className="h-8 w-8 text-primary" />
          </div>
        </div>
        <h1 className="text-3xl font-bold tracking-tight font-heading">
          Your interview is ready
        </h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Your personalized interview plan is set. Let's get you into the
          interview room.
        </p>
      </div>

      {/* Meta chips */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {plan.target_role && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
            <Briefcase className="h-3.5 w-3.5" />
            {plan.target_role}
          </span>
        )}
        {plan.target_seniority && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
            <Gauge className="h-3.5 w-3.5" />
            {plan.target_seniority}
          </span>
        )}
        {plan.overall_difficulty && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-700 px-3 py-1.5 text-xs font-medium">
            <Sparkles className="h-3.5 w-3.5" />
            {plan.overall_difficulty}
          </span>
        )}
      </div>

      {/* What happens now */}
      <Card className="border-primary/10">
        <CardContent className="p-6 space-y-5">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            Here's what to expect
          </h2>
          <div className="space-y-4">
            {steps.map((step, i) => (
              <div key={i} className="flex items-start gap-4">
                <div className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 shrink-0">
                  <step.icon className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Privacy note */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Lock className="h-3 w-3" />
        <span>
          Your interview plan stays private — it guides your interviewer behind
          the scenes, so you can focus on a natural conversation.
        </span>
      </div>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row items-center gap-3 justify-center">
        <Button
          size="lg"
          onClick={() =>
            navigate("/session/1", { state: { plan } })
          }
          className="gap-2 w-full sm:w-auto"
        >
          <Mic className="h-4 w-4" />
          Enter Interview Room
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={() => navigate("/setup")}
          className="gap-2 w-full sm:w-auto"
        >
          <ArrowRight className="h-4 w-4" />
          Start Over
        </Button>
      </div>
    </div>
  );
}