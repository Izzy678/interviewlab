import { useState, type FormEvent } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/common/Brand";
import { PresenceOrb, Waveform } from "@/components/studio/StudioPrimitives";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname: string } })?.from
    ?.pathname || "/dashboard";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const err = await signIn(email, password);
    setSubmitting(false);

    if (err) {
      setError(err);
    } else {
      navigate(from, { replace: true });
    }
  };

  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden border-r border-border/70 bg-muted/35 p-12 lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div className="studio-grid absolute inset-0 opacity-50" />
        <div className="studio-noise absolute inset-0 opacity-40" />
        <div className="absolute left-[22%] top-[30%] h-80 w-80 rounded-full bg-primary/[0.08] blur-3xl" />
        <Brand className="relative z-10" />

        <div className="relative z-10 max-w-xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
            Your interview workspace
          </p>
          <h1 className="mt-6 font-display text-6xl leading-[0.98] tracking-[-0.04em] xl:text-7xl">
            Return to the room with purpose.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-muted-foreground">
            Your practice, transcripts, and feedback are waiting—ready for the
            next conversation.
          </p>
        </div>

        <div className="relative z-10 flex max-w-md items-center gap-5 rounded-2xl border border-border/70 bg-card/65 p-5 backdrop-blur-sm">
          <PresenceOrb size="md" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">Studio ready</span>
              <span className="text-muted-foreground">Private session</span>
            </div>
            <Waveform className="mt-2 justify-start text-primary" bars={18} />
          </div>
        </div>
      </section>

      <section className="relative flex min-h-screen items-center px-5 py-10 sm:px-10 lg:px-16 xl:px-24">
        <div className="studio-grid absolute inset-0 opacity-25 lg:hidden" />
        <div className="relative mx-auto w-full max-w-md">
          <Brand className="mb-16 lg:hidden" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
            Welcome back
          </p>
          <h2 className="mt-4 font-display text-5xl tracking-[-0.035em]">
            Sign in
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Continue to your interview workspace.
          </p>

          <form onSubmit={handleSubmit} className="mt-10">
          <div className="space-y-5">
            {error && (
              <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
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
                placeholder="Enter your password"
                required
                minLength={6}
                autoComplete="current-password"
                className="mt-2 flex h-12 w-full rounded-xl border border-input bg-card/70 px-4 text-sm transition-colors placeholder:text-muted-foreground/70 focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>
          <div className="mt-8 flex flex-col gap-5">
            <Button type="submit" size="lg" className="w-full" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link
                to="/signup"
                className="font-semibold text-foreground underline-offset-4 hover:underline"
              >
                Sign up
              </Link>
            </p>
          </div>
        </form>
        </div>
      </section>
    </main>
  );
}