import { useLocation, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Send,
  Target,
  BookOpen,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Sparkles,
  FileText,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { EmptyState } from "@/components/common/EmptyState";
import { useState } from "react";

interface InterviewQuestion {
  id: string;
  question: string;
  category: "recruiter" | "behavioral" | "technical" | "follow_up";
  difficulty: "easy" | "medium" | "hard";
  focus_area: string;
  expected_answer_points: string[];
  context?: string;
}

interface InterviewPlanSection {
  title: string;
  description: string;
  questions: InterviewQuestion[];
}

interface InterviewPlanData {
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

const difficultyColors: Record<string, string> = {
  Easy: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Medium: "bg-amber-100 text-amber-700 border-amber-200",
  Hard: "bg-orange-100 text-orange-700 border-orange-200",
  "Very Hard": "bg-red-100 text-red-700 border-red-200",
};

const sectionIcons: Record<string, typeof BookOpen> = {
  recruiter_questions: FileText,
  behavioral_questions: Lightbulb,
  technical_questions: BarChart3,
  follow_up_questions: Target,
};

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const color =
    difficultyColors[difficulty] || "bg-gray-100 text-gray-700 border-gray-200";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${color}`}
    >
      {difficulty}
    </span>
  );
}

function QuestionCard({
  question,
  index,
}: {
  question: InterviewQuestion;
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border bg-background overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-muted/40 transition-colors"
      >
        <span className="flex items-center justify-center shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium leading-relaxed">
              {question.question}
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <DifficultyBadge difficulty={question.difficulty} />
              {expanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
            </div>
          </div>
          {question.focus_area && (
            <p className="text-xs text-muted-foreground mt-1">
              Focus: {question.focus_area}
            </p>
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-0 space-y-3 border-t border-border/50">
          {question.context && (
            <div className="mt-3 flex items-start gap-2 rounded-md bg-blue-50 border border-blue-100 px-3 py-2">
              <Sparkles className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-700 leading-relaxed">
                {question.context}
              </p>
            </div>
          )}

          {question.expected_answer_points.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
                Key points to cover
              </p>
              <ul className="space-y-1">
                {question.expected_answer_points.map((point, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-xs text-muted-foreground"
                  >
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/50 mt-1.5 shrink-0" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PlanSection({
  section,
  sectionKey,
}: {
  section: InterviewPlanSection;
  sectionKey: string;
}) {
  const IconComponent = sectionIcons[sectionKey] || BookOpen;
  const [collapsed, setCollapsed] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-3">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10">
              <IconComponent className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">{section.title}</CardTitle>
              {section.description && (
                <CardDescription>{section.description}</CardDescription>
              )}
            </div>
          </div>
          {collapsed ? (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          )}
        </button>
      </CardHeader>
      {!collapsed && (
        <CardContent className="space-y-3">
          {section.questions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No questions generated for this section.
            </p>
          ) : (
            section.questions.map((q, i) => (
              <QuestionCard key={q.id || i} question={q} index={i} />
            ))
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default function InterviewPlan() {
  const location = useLocation();
  const navigate = useNavigate();
  const plan = location.state?.plan as InterviewPlanData | undefined;
  const fromSetup = location.state?.fromSetup === true;

  const totalQuestions = plan
    ? Object.values(plan.sections).reduce(
        (sum, s) => sum + s.questions.length,
        0,
      )
    : 0;

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
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Back + Start row */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        {fromSetup && (
          <Button
            onClick={() => navigate("/session/1")}
            className="gap-2"
          >
            <Send className="h-4 w-4" />
            Start Interview
          </Button>
        )}
      </div>

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold tracking-tight">
            Interview Plan
          </h1>
          <DifficultyBadge difficulty={plan.overall_difficulty} />
        </div>
        <p className="text-muted-foreground">
          {plan.target_role && (
            <span className="font-medium text-foreground">
              {plan.target_role}
            </span>
          )}
          {plan.candidate_name && (
            <span>
              {" "}— prepared for {plan.candidate_name}
            </span>
          )}
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Questions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{totalQuestions}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all sections
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Seniority</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{plan.target_seniority}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Target level for this role
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Difficulty</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{plan.overall_difficulty}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Based on experience vs. requirements
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Preparation Tips */}
      {plan.preparation_tips.length > 0 && (
        <Card className="border-primary/20 bg-primary/[0.03]">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Preparation Tips</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {plan.preparation_tips.map((tip, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm leading-relaxed"
                >
                  <span className="inline-flex items-center justify-center shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-muted-foreground">{tip}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Question Sections */}
      <div className="space-y-6">
        <PlanSection
          section={plan.sections.recruiter_questions}
          sectionKey="recruiter_questions"
        />
        <PlanSection
          section={plan.sections.behavioral_questions}
          sectionKey="behavioral_questions"
        />
        <PlanSection
          section={plan.sections.technical_questions}
          sectionKey="technical_questions"
        />
        <PlanSection
          section={plan.sections.follow_up_questions}
          sectionKey="follow_up_questions"
        />
      </div>

      {/* Bottom CTA */}
      <div className="flex justify-center pb-8">
        {fromSetup ? (
          <Button
            size="lg"
            onClick={() => navigate("/session/1")}
            className="gap-2"
          >
            <Send className="h-4 w-4" />
            Start Interview with This Plan
          </Button>
        ) : (
          <Button asChild variant="outline">
            <Link to="/setup">
              <FileText className="h-4 w-4 mr-2" />
              Create a New Plan
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}