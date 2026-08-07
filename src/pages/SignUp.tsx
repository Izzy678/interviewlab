import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/common/Brand";
import { PresenceOrb, Waveform } from "@/components/studio/StudioPrimitives";

export default function SignUp() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const err = await signUp(name, email, password);
    setSubmitting(false);

    if (err) {
      setError(err);
    } else {
      setSuccess(true);
      // If email confirmation is required, show a message
      // Otherwise redirect to dashboard
      // We'll check after a short timeout
      setTimeout(() => {
        navigate("/dashboard", { replace: true });
      }, 1000);
    }
  };

  if (success) {
    return (
      <main className="studio-grid flex min-h-screen items-center justify-center px-5">
        <div className="max-w-md text-center">
          <PresenceOrb size="lg" className="mx-auto" />
          <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
            Workspace created
          </p>
          <h1 className="mt-4 font-display text-5xl tracking-[-0.035em]">
            Welcome to InterviewLab.
          </h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Preparing your interview workspace…
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[0.95fr_1.05fr]">
      <section className="relative flex min-h-screen items-center px-5 py-10 sm:px-10 lg:px-16 xl:px-24">
        <div className="studio-grid absolute inset-0 opacity-25 lg:hidden" />
        <div className="relative mx-auto w-full max-w-md">
          <Brand className="mb-12 lg:hidden" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
            Begin with intention
          </p>
          <h1 className="mt-4 font-display text-5xl leading-none tracking-[-0.035em]">
            Create your workspace
          </h1>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            A private place to practice the conversations that matter.
          </p>

          <form onSubmit={handleSubmit} className="mt-9">
          <div className="space-y-5">
            {error && (
              <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <label
                htmlFor="name"
                className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
              >
                Full name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                required
                autoComplete="name"
                className="mt-2 flex h-12 w-full rounded-xl border border-input bg-card/70 px-4 text-sm transition-colors placeholder:text-muted-foreground/70 focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="mt-2 flex h-12 w-full rounded-xl border border-input bg-card/70 px-4 text-sm transition-colors placeholder:text-muted-foreground/70 focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="password"
                className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                required
                minLength={6}
                autoComplete="new-password"
                className="mt-2 flex h-12 w-full rounded-xl border border-input bg-card/70 px-4 text-sm transition-colors placeholder:text-muted-foreground/70 focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>
          <div className="mt-8 flex flex-col gap-5">
            <Button type="submit" size="lg" className="w-full" disabled={submitting}>
              {submitting ? "Creating account…" : "Create account"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link
                to="/signin"
                className="font-semibold text-foreground underline-offset-4 hover:underline"
              >
                Sign in
              </Link>
            </p>
          </div>
        </form>
        </div>
      </section>

      <section className="relative hidden overflow-hidden border-l border-border/70 bg-muted/35 p-12 lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div className="studio-grid absolute inset-0 opacity-50" />
        <div className="studio-noise absolute inset-0 opacity-40" />
        <div className="absolute bottom-[18%] right-[18%] h-96 w-96 rounded-full bg-primary/[0.08] blur-3xl" />
        <Brand className="relative z-10" />

        <div className="relative z-10 max-w-xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
            Practice before the pressure
          </p>
          <h2 className="mt-6 font-display text-6xl leading-[0.98] tracking-[-0.04em] xl:text-7xl">
            Make room for a better answer.
          </h2>
          <p className="mt-6 max-w-lg text-lg leading-8 text-muted-foreground">
            Rehearse the hard questions, hear yourself think, and arrive at the
            real interview already in rhythm.
          </p>
        </div>

        <div className="relative z-10 max-w-md rounded-2xl border border-border/70 bg-card/65 p-5 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <PresenceOrb size="md" />
            <div>
              <p className="text-sm font-semibold">A calmer kind of practice</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Voice-first · Role-aware · Private
              </p>
            </div>
          </div>
          <Waveform className="mt-4 justify-start text-primary" bars={24} />
        </div>
      </section>
    </main>
  );
}