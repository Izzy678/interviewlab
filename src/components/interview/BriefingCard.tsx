import { FileText, Lightbulb, Target, Zap } from "lucide-react";
import type { InterviewBriefing } from "@/lib/interview";

interface BriefingCardProps {
  role: string;
  briefing: InterviewBriefing;
}

export function BriefingCard({ role, briefing }: BriefingCardProps) {
  const { focus_skills, resume_gap } = briefing;

  return (
    <div className="animate-fade-up w-full max-w-xs space-y-3 text-left">
      {/* Card header */}
      <div className="flex items-center gap-2">
        <span
          className="flex h-5 w-5 items-center justify-center rounded-full bg-white/5"
          aria-hidden
        >
          <FileText className="h-2.5 w-2.5 text-white/40" />
        </span>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
          Alexa&apos;s notes on you
        </p>
      </div>

      {/* Focus skills */}
      <div className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-4 py-3">
        <div className="flex items-start gap-2.5">
          <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400/60" aria-hidden />
          <div className="min-w-0">
            <p className="text-xs font-medium text-white/70">Focus areas</p>
            <p className="mt-1 text-[11px] leading-5 text-white/45">
              {focus_skills.length > 0 ? (
                focus_skills.map((skill, i) => (
                  <span key={skill}>
                    {i > 0 && <span className="mx-1 text-white/20">·</span>}
                    <span className="font-medium text-white/60">{skill}</span>
                  </span>
                ))
              ) : (
                <span className="italic">{role || "this role"}</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Resume–JD gap */}
      {resume_gap && (
        <div className="rounded-lg border border-amber-500/15 bg-amber-500/5 px-4 py-3">
          <div className="flex items-start gap-2.5">
            <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400/60" aria-hidden />
            <div className="min-w-0">
              <p className="text-xs font-medium text-white/70">Gap to watch</p>
              <p className="mt-1 text-[11px] leading-5 text-white/45">
                <span className="font-medium text-amber-300/80">{resume_gap.skill}</span>
                {" — "}
                {resume_gap.note}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Bottom hint */}
      <div className="flex items-center gap-1.5 px-0.5">
        <Lightbulb className="h-3 w-3 text-white/25" aria-hidden />
        <p className="text-[10px] leading-relaxed text-white/25">
          Alexa tailored this interview based on your prep materials.
        </p>
      </div>
    </div>
  );
}