import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function CtaSection() {
  return (
    <section className="px-5 pb-24 sm:px-8 sm:pb-32 lg:px-12">
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-foreground px-6 py-20 text-background sm:px-12 sm:py-24 lg:px-20">
        <div className="studio-grid absolute inset-0 opacity-[0.06]" />
        <div className="absolute -right-28 -top-28 h-80 w-80 rounded-full bg-primary/30 blur-3xl" />
        <div className="relative grid items-end gap-10 lg:grid-cols-[1fr_auto]">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-background/55">
              Your next interview starts here
            </p>
            <h2 className="mt-5 font-display text-4xl leading-[1.02] tracking-[-0.035em] sm:text-6xl">
              Make the real conversation feel familiar.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-background/65">
              Set up a focused practice session in minutes and enter the room
              with a clearer story, a steadier voice, and fewer surprises.
            </p>
          </div>
          <Button
            asChild
            size="lg"
            className="group w-full bg-background text-foreground hover:bg-background/90 lg:w-auto"
          >
            <Link to="/setup">
              Enter the room
              <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}