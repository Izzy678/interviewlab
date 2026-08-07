import { HeroSection } from "@/components/landing/HeroSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { CtaSection } from "@/components/landing/CtaSection";

import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

export default function Landing() {
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen">
      <header className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link
          to="/"
          className="flex items-center gap-2 text-xl font-semibold tracking-tight"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            IL
          </span>
          <span className="hidden sm:inline">InterviewLab</span>
        </Link>
        <nav className="flex items-center gap-3">
          {loading ? null : user ? (
            <Button asChild>
              <Link to="/dashboard">Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link to="/signin">Sign in</Link>
              </Button>
              <Button asChild className="rounded-full">
                <Link to="/signup">Get started</Link>
              </Button>
            </>
          )}
        </nav>
      </header>
      <HeroSection />
      <FeaturesSection />
      <CtaSection />
      <footer className="border-t py-6 text-center text-sm text-muted-foreground/60">
        &copy; {new Date().getFullYear()} InterviewLab. All rights reserved.
      </footer>
    </div>
  );
}