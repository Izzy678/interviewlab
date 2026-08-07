const moments = [
  {
    number: "01",
    eyebrow: "Before",
    title: "Walk in prepared",
    description:
      "Bring the role, your resume, and the context that matters. Your practice session is shaped around the conversation you are actually preparing for.",
  },
  {
    number: "02",
    eyebrow: "During",
    title: "Stay in the conversation",
    description:
      "Speak naturally with a professional interviewer who listens, follows up, and moves with your answers—not through a fixed script.",
  },
  {
    number: "03",
    eyebrow: "After",
    title: "Know what to improve",
    description:
      "Review thoughtful feedback on clarity, depth, and delivery. Return to the exact moments worth refining before the real thing.",
  },
];

export function FeaturesSection() {
  return (
    <section className="relative py-24 sm:py-32 lg:py-40">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
        <div className="grid gap-12 border-b border-border/70 pb-20 lg:grid-cols-[0.8fr_1.2fr] lg:gap-24 lg:pb-28">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
              Practice that feels real
            </p>
            <h2 className="mt-5 max-w-md font-display text-4xl leading-[1.05] tracking-[-0.035em] sm:text-5xl">
              Less performance theater. More honest preparation.
            </h2>
          </div>
          <div className="flex items-end">
            <p className="max-w-2xl text-xl leading-8 text-muted-foreground sm:text-2xl sm:leading-9">
              Confidence comes from having been in the room before. InterviewLab
              creates the space to think aloud, find your rhythm, and make every
              answer more precise.
            </p>
          </div>
        </div>

        <div className="divide-y divide-border/70">
          {moments.map((moment) => (
            <article
              key={moment.number}
              className="group grid gap-5 py-10 sm:grid-cols-[5rem_0.7fr_1.3fr] sm:gap-8 sm:py-14"
            >
              <span className="font-mono text-xs text-muted-foreground">
                {moment.number}
              </span>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                  {moment.eyebrow}
                </p>
                <h3 className="mt-2 font-display text-2xl tracking-[-0.02em] sm:text-3xl">
                  {moment.title}
                </h3>
              </div>
              <p className="max-w-xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                {moment.description}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-20 grid gap-8 rounded-[1.5rem] border border-border/70 bg-muted/35 px-6 py-8 sm:grid-cols-3 sm:px-10 sm:py-10">
          <div>
            <p className="font-display text-3xl">Voice-first</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Practice how you speak, not how you type.
            </p>
          </div>
          <div className="border-border/70 sm:border-l sm:pl-10">
            <p className="font-display text-3xl">Role-aware</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Every conversation starts with your real context.
            </p>
          </div>
          <div className="border-border/70 sm:border-l sm:pl-10">
            <p className="font-display text-3xl">Private</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              A quiet workspace built for focused rehearsal.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}