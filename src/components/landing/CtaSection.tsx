import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function CtaSection() {
  return (
    <section className="py-20 md:py-28">
      <div className="container mx-auto px-4">
        <div className="relative overflow-hidden rounded-2xl bg-primary px-6 py-16 text-center shadow-xl sm:px-16">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(45%_40%_at_50%_60%,oklch(1_0_0/12%),transparent)]" />
          <h2 className="text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl">
            Ready to Practice?
          </h2>
          <p className="mt-4 text-lg text-primary-foreground/80 max-w-lg mx-auto">
            Start a mock interview now and see where you stand. No account
            required to get started.
          </p>
          <div className="mt-8 flex justify-center">
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="text-base px-8 gap-2"
            >
              <Link to="/setup">
                Start Your First Interview
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}