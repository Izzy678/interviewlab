import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function CtaSection() {
  return (
    <section className="py-20 md:py-28">
      <div className="container mx-auto px-4">
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/5 via-background to-primary/[0.02] px-6 py-16 text-center shadow-sm sm:px-16">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(40%_35%_at_50%_55%,oklch(0.45_0.18_260/5%),transparent)]" />
          <h2 className="text-3xl font-light tracking-tight sm:text-4xl">
            Ready to practice?
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-lg text-muted-foreground/70">
            Start a mock interview now and see where you stand. No account
            required to get started.
          </p>
          <div className="mt-8 flex justify-center">
            <Button
              asChild
              size="lg"
              className="gap-2 rounded-full px-8 text-base"
            >
              <Link to="/setup">
                Start your first interview
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}