import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden pb-20 pt-16 md:pt-24 lg:pt-32">
      {/* Background gradient */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(45%_40%_at_50%_60%,oklch(0.45_0.18_260/8%),transparent)]" />

      <div className="container mx-auto px-4 text-center">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
            Ace Your Next
            <span className="block text-primary mt-2">Technical Interview</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground md:text-xl max-w-2xl mx-auto">
            Practice with AI-powered mock interviews. Get real-time feedback on
            your answers, improve your communication, and walk in with
            confidence.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button asChild size="lg" className="text-base px-8">
              <Link to="/setup">Start a Mock Interview</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="text-base px-8">
              <Link to="/dashboard">View Dashboard</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}