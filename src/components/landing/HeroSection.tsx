import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  PresenceOrb,
  StageLabel,
  Waveform,
} from "@/components/studio/StudioPrimitives";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export function HeroSection() {
  const { user } = useAuth();

  return (
    <section className="relative isolate overflow-hidden border-b border-border/70 pb-20 pt-12 sm:pb-28 sm:pt-16 lg:pb-32 lg:pt-20">
      <div className="studio-grid absolute inset-0 -z-20 opacity-50" />
      <div className="studio-noise absolute inset-0 -z-10 opacity-40" />
      <div className="absolute -right-40 top-0 -z-10 h-[34rem] w-[34rem] rounded-full bg-primary/[0.07] blur-3xl" />
      <div className="absolute left-[8%] top-24 -z-10 h-1.5 w-1.5 animate-drift rounded-full bg-primary/30" />
      <div className="absolute right-[12%] top-20 -z-10 h-1 w-1 animate-drift rounded-full bg-foreground/20 [animation-delay:1.5s]" />

      <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 sm:px-8 lg:grid-cols-[0.72fr_1.28fr] lg:gap-12 lg:px-12">
        <div className="max-w-xl animate-fade-up">
          <p className="mb-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
            Your private interview studio
          </p>
          <h1 className="font-display text-balance text-[3.1rem] leading-[0.95] tracking-[-0.045em] sm:text-6xl lg:text-[4.6rem]">
            Practice the interview before it matters.
          </h1>
          <p className="mt-7 max-w-md text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
            Step into realistic, voice-first interviews shaped around your
            experience and the role you want.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg" className="group">
              <Link to={user ? "/setup" : "/signup"}>
                Enter the room
                <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="lg" className="text-muted-foreground">
              <Link to={user ? "/dashboard" : "/signup"}>
                {user ? "Open workspace" : "Create workspace"}
              </Link>
            </Button>
          </div>
          <p className="mt-5 text-xs text-muted-foreground">
            Focused practice. Private by design. Ready when you are.
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-3xl animate-fade-up [animation-delay:180ms]">
          <div className="absolute -inset-10 -z-10 rounded-full bg-primary/[0.07] blur-3xl" />
          <div className="studio-shadow overflow-hidden rounded-[1.75rem] border border-border/80 bg-card/95 backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-border/70 px-5 py-4 sm:px-7">
              <div className="flex items-center gap-3">
                <span className="h-2 w-2 animate-breathe rounded-full bg-primary shadow-[0_0_12px_var(--color-primary)]" />
                <div>
                  <p className="text-sm font-semibold tracking-tight">
                    Product leadership interview
                  </p>
                  <p className="text-[11px] text-muted-foreground">Live with Alexa</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm tabular-nums">18:42</p>
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  remaining
                </p>
              </div>
            </div>

            <div className="grid min-h-[32rem] sm:grid-cols-[0.72fr_1.28fr]">
              <div className="flex flex-col items-center justify-between border-b border-border/70 bg-muted/35 px-5 py-8 text-center sm:border-b-0 sm:border-r sm:px-6">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Interviewer
                  </p>
                  <h2 className="mt-1 font-display text-2xl">Alexa</h2>
                </div>
                <div className="my-7">
                  <PresenceOrb size="lg" />
                  <p className="mt-5 flex items-center justify-center gap-2 text-xs font-medium">
                    <span className="h-1.5 w-1.5 animate-breathe rounded-full bg-primary" />
                    Speaking
                  </p>
                </div>
                <Waveform className="w-full text-primary" bars={22} />
              </div>

              <div className="flex flex-col px-5 py-6 sm:px-7">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border/70 pb-4">
                  <StageLabel>Introduction</StageLabel>
                  <StageLabel active>Experience</StageLabel>
                  <StageLabel>Scenario</StageLabel>
                </div>

                <div className="flex-1 space-y-8 py-7">
                  <div className="animate-fade-up">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
                      Alexa · interviewer
                    </p>
                    <p className="mt-2 font-display text-xl leading-snug tracking-[-0.01em] sm:text-2xl">
                      Tell me about a time you had to change direction after
                      learning something unexpected from customers.
                    </p>
                  </div>
                  <div className="animate-fade-up border-l border-primary/30 pl-4 text-sm leading-6 text-muted-foreground [animation-delay:400ms]">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground">
                      You · listening
                    </p>
                    <p className="mt-2">
                      We were two weeks from launch when our beta cohort showed
                      us that the problem was not discovery, but trust…
                      <span className="ml-1 inline-block h-4 w-px animate-breathe bg-primary align-middle" />
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-border/70 bg-background/70 px-4 py-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="h-2 w-2 rounded-full border border-primary bg-primary/20" />
                    Listening when you&apos;re ready
                  </div>
                  <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    Response 02
                  </span>
                </div>
              </div>
            </div>
          </div>
          <p className="mt-4 text-center text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            A preview of your live interview room
          </p>
        </div>
      </div>
    </section>
  );
}
