import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export function Brand({
  to = "/",
  compact = false,
  className,
}: {
  to?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "group inline-flex items-center gap-2.5 text-foreground",
        className,
      )}
      aria-label="InterviewLab home"
    >
      <span className="relative grid h-7 w-7 place-items-center rounded-full border border-foreground/20 bg-foreground text-background">
        <span className="h-2 w-2 rounded-full bg-background transition-transform duration-500 group-hover:scale-125" />
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border-2 border-background bg-primary" />
      </span>
      {!compact && (
        <span className="text-[15px] font-semibold tracking-[-0.02em]">
          InterviewLab
        </span>
      )}
    </Link>
  );
}
