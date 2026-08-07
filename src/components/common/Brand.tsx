import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface BrandProps {
  /** When `true`, hides the wordmark — shows only the badge mark */
  compact?: boolean;
  /** When `true`, renders as a plain `<span>` instead of a link */
  noLink?: boolean;
  /** Additional classes on the root element */
  className?: string;
}

/**
 * Compact InterviewLab mark + wordmark.
 *
 * Use in the header, session top-bar, sign-in pages, or anywhere the
 * brand needs to appear.  The badge mark is always visible; the wordmark
 * collapses on small screens or when `compact` is set.
 */
export function Brand({ compact = false, noLink = false, className }: BrandProps) {
  const content = (
    <>
      <span
        className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground text-sm font-bold shrink-0 select-none"
        aria-hidden="true"
      >
        IL
      </span>
      <span
        className={cn(
          "font-bold text-xl tracking-tight select-none",
          compact && "hidden",
        )}
      >
        InterviewLab
      </span>
    </>
  );

  if (noLink) {
    return (
      <span
        className={cn("inline-flex items-center gap-2", className)}
        aria-label="InterviewLab"
      >
        {content}
      </span>
    );
  }

  return (
    <Link
      to="/"
      className={cn(
        "inline-flex items-center gap-2 transition-opacity duration-150 hover:opacity-80",
        className,
      )}
      aria-label="InterviewLab — Home"
    >
      {content}
    </Link>
  );
}