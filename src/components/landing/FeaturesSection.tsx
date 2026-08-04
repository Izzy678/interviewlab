import {
  Brain,
  MessageSquareText,
  BarChart3,
  Timer,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

const features = [
  {
    icon: Brain,
    title: "AI Interviewer",
    description:
      "Our AI asks realistic, role-specific questions that mimic real interviewers — from technical deep-dives to behavioral scenarios.",
  },
  {
    icon: MessageSquareText,
    title: "Real-Time Feedback",
    description:
      "Get instant insights on your answers — clarity, depth, structure, and confidence — as you speak.",
  },
  {
    icon: BarChart3,
    title: "Detailed Reports",
    description:
      "After each session, review a comprehensive breakdown of your performance with actionable recommendations.",
  },
  {
    icon: Timer,
    title: "Timed Practice",
    description:
      "Simulate real interview pressure with timed responses, helping you pace your answers naturally.",
  },
];

export function FeaturesSection() {
  return (
    <section className="py-20 md:py-28">
      <div className="container mx-auto px-4">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Why InterviewLab?
          </h2>
          <p className="mt-3 text-muted-foreground text-lg max-w-xl mx-auto">
            Everything you need to prepare thoroughly and perform confidently.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className="border-0 bg-muted/50 shadow-sm hover:shadow-md transition-shadow"
            >
              <CardHeader>
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-lg">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm leading-relaxed">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}