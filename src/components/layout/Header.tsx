import { Menu, LogOut } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";

const navLinks = [
  { label: "Dashboard", to: "/dashboard" },
  { label: "New Interview", to: "/setup" },
];

export function Header() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const initials = profile?.name
    ? profile.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() ?? "?";

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link
          to="/"
          className="flex items-center gap-2 font-bold text-xl tracking-tight"
        >
          <span className="bg-primary text-primary-foreground rounded-lg w-8 h-8 flex items-center justify-center text-sm font-bold">
            IL
          </span>
          <span className="hidden sm:inline">InterviewLab</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right section */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {profile?.name ?? user?.email}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              aria-label="Sign out"
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
          <Avatar className="h-8 w-8 cursor-pointer">
            <AvatarFallback className="text-xs bg-primary/10 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>

          {/* Mobile menu trigger */}
          <Sheet>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <nav className="flex flex-col gap-4 mt-8">
                {navLinks.map((link) => (
                  <SheetClose key={link.to} asChild>
                    <Link
                      to={link.to}
                      className="text-lg font-medium text-foreground hover:text-primary transition-colors"
                    >
                      {link.label}
                    </Link>
                  </SheetClose>
                ))}
                <hr className="my-2" />
                <SheetClose asChild>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2 text-lg font-medium text-destructive hover:text-destructive/80 transition-colors"
                  >
                    <LogOut className="h-5 w-5" />
                    Sign out
                  </button>
                </SheetClose>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}