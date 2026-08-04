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
        <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
          <span className="bg-primary text-primary-foreground rounded-lg w-8 h-8 flex items-center justify-center text-sm font-bold">
            IL
          </span>
          <span className="hidden sm:inline">InterviewLab</span>
        </div>
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
              <Button asChild>
                <Link to="/signup">Get started</Link>
              </Button>
            </>
          )}
        </nav>
      </header>
      <HeroSection />
      <FeaturesSection />
      <CtaSection />
      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        &copy; {new Date().getFullYear()} InterviewLab. All rights reserved.
      </footer>
    </div>
  );
}