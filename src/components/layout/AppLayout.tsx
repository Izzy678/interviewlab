import { Outlet } from "react-router-dom";
import {
  AppSidebar,
  useSidebarCollapsed,
} from "@/components/layout/AppSidebar";
import { cn } from "@/lib/utils";

export default function AppLayout() {
  const { collapsed, toggleCollapsed } = useSidebarCollapsed();

  return (
    <div className="relative min-h-screen bg-background">
      <AppSidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      <div
        className={cn(
          "transition-[padding] duration-200 ease-out",
          collapsed ? "lg:pl-[72px]" : "lg:pl-60",
        )}
      >
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
