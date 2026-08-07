import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Mic } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden pb-24 pt-16 md:pt-28 lg:pt-36">
      {/* Soft background glow */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(35%_35%_at_50%_55%,oklch(0.45_0.18_260/6%),transparent)]" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(25%_25%_at_70%_30%,oklch(0.45_0.18_260/3%),transparent)]" />

      <div className="container mx-auto px-4 text-center">
        {/* Voice-first pill badge */}
        <div className="mx-auto flex w-fit items-center gap-2 rounded-full border bg-background/50 px-4 py-1.5 text-sm text-muted-foreground shadow-sm backdrop-blur-sm">
          <Mic className="h-3.5 w-3.5" />
          <span>Voice-first interview practice</span>
        </div>

        <div className="mx-auto mt-8 max-w-4xl">
          <h1 className="text-balance text-4xl font-light tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
            Speak with
            <span className="mt-2 block font-medium text-primary">confidence.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-balance text-lg leading-relaxed text-muted-foreground/80 md:text-xl">
            Practice with AI-powered mock interviews that listen. Refine your
            answers, improve your delivery, and walk into every conversation
            prepared.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="rounded-full px-8 text-base"
            >
              <Link to="/setup">Start a mock interview</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="rounded-full px-8 text-base"
            >
              <Link to="/dashboard">View dashboard</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}