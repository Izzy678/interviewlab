import {
  Brain,
  MessageSquareText,
  BarChart3,
  Timer,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
        <div className="mb-14 text-center">
          <h2 className="text-3xl font-light tracking-tight sm:text-4xl">
            Everything you need
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-lg text-muted-foreground/70">
            Thoughtfully designed to help you prepare, perform, and improve.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className="border bg-card shadow-sm transition-all duration-200 hover:shadow-md"
            >
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/5">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-base font-medium">
                  {feature.title}
                </CardTitle>
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