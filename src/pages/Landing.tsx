import { HeroSection } from "@/components/landing/HeroSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { CtaSection } from "@/components/landing/CtaSection";

import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/common/Brand";

export default function Landing() {
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen overflow-hidden bg-background text-foreground">
      <header className="relative z-20 mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-12">
        <Brand />
        <nav className="flex items-center gap-1.5" aria-label="Main navigation">
          {loading ? null : user ? (
            <Button asChild size="sm">
              <Link to="/dashboard">Open workspace</Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/signin">Sign in</Link>
              </Button>
              <Button size="sm" asChild>
                <Link to="/signup">Get started</Link>
              </Button>
            </>
          )}
        </nav>
      </header>
      <HeroSection />
      <FeaturesSection />
      <CtaSection />
      <footer className="border-t border-border/70 px-5 py-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <Brand />
          <p>&copy; {new Date().getFullYear()} InterviewLab. Practice with intention.</p>
        </div>
      </footer>
    </div>
  );
}