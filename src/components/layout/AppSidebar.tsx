import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Plus,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { Brand } from "@/components/common/Brand";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "interviewlab.sidebar.collapsed";

const navItems = [
  { label: "Workspace", to: "/dashboard", icon: LayoutDashboard },
  { label: "New interview", to: "/setup", icon: Plus },
];

function SidebarNav({
  collapsed,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const location = useLocation();

  return (
    <nav className="flex flex-col gap-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active =
          item.to === "/dashboard"
            ? location.pathname === "/dashboard"
            : location.pathname === item.to ||
              location.pathname.startsWith(item.to + "/");
        return (
          <Link
            key={item.to}
            to={item.to}
            title={collapsed ? item.label : undefined}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-colors",
              collapsed ? "justify-center px-2" : "px-3",
              active
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  return {
    collapsed,
    setCollapsed,
    toggleCollapsed: () => setCollapsed((value) => !value),
  };
}

export function AppSidebar({
  collapsed,
  onToggleCollapsed,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
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
    <>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border bg-card py-5 transition-[width] duration-200 ease-out lg:flex",
          collapsed ? "w-[72px] px-2.5" : "w-60 px-4",
        )}
      >
        <div
          className={cn(
            "mb-6 flex items-center",
            collapsed ? "flex-col gap-3" : "justify-between gap-2 px-1",
          )}
        >
          <Brand to="/dashboard" compact={collapsed} />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="h-8 w-8 shrink-0 text-muted-foreground"
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
        </div>

        <SidebarNav collapsed={collapsed} />

        <div
          className={cn(
            "mt-auto space-y-3 border-t border-border pt-4",
            collapsed && "flex flex-col items-center",
          )}
        >
          <div
            className={cn(
              "flex items-center gap-3",
              collapsed ? "justify-center" : "px-2",
            )}
            title={collapsed ? profile?.name || user?.email || "Account" : undefined}
          >
            <Avatar className="h-8 w-8 border border-border">
              <AvatarFallback className="bg-muted text-[11px] font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {profile?.name || "Your workspace"}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {user?.email}
                </p>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size={collapsed ? "icon" : "sm"}
            onClick={handleSignOut}
            title={collapsed ? "Sign out" : undefined}
            aria-label="Sign out"
            className={cn(
              "text-muted-foreground",
              !collapsed && "w-full justify-start gap-2",
            )}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && "Sign out"}
          </Button>
        </div>
      </aside>

      <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur-xl lg:hidden">
        <Brand to="/dashboard" />
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 bg-background p-5">
            <Brand to="/dashboard" className="mb-8" />
            <SidebarNav />
            <div className="mt-8 border-t border-border pt-4">
              <p className="text-sm font-medium">{profile?.name ?? "Workspace"}</p>
              <p className="mt-1 text-xs text-muted-foreground">{user?.email}</p>
              <SheetClose asChild>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="mt-4 flex items-center gap-2 text-sm font-medium text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </SheetClose>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
