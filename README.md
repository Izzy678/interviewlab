# InterviewLab

**Practice the interview before it matters.**

A voice-first mock interview platform that uses real-time speech transcription (Speechmatics) and AI-powered conversations (Gemini) to simulate realistic job interviews. Upload your resume, paste a job description, and step into a private voice studio for live practice — then get a detailed report with feedback and model answers.

## Architecture

```
┌────────────────────────────────────────────────────────┐
│              React SPA (Vite + Tailwind v4)            │
│  ┌─────────────┐ ┌──────────────┐ ┌─────────────────┐ │
│  │  Landing     │ │ Auth Pages   │ │  Dashboard      │ │
│  │  (public)    │ │ (public)     │ │  (protected)    │ │
│  ├─────────────┤ ├──────────────┤ ├─────────────────┤ │
│  │ Setup / Plan │ │ Voice Studio  │ │  Report         │ │
│  │ (resume+JD) │ │ (live chat)   │ │  (feedback)     │ │
│  └─────────────┘ └──────────────┘ └─────────────────┘ │
│                Supabase SDK (auth, storage, functions) │
└────────────────────────┬───────────────────────────────┘
                         │
             Supabase Project (interviewlab)
   ┌─────────────────────┼─────────────────────────┐
   │                     │                         │
   ▼                     ▼                         ▼
┌──────────┐    ┌──────────────┐       ┌────────────────────┐
│  Auth    │    │   Storage    │       │   Edge Functions   │
│ (email/  │    │   (resumes   │       │                    │
│  passwd) │    │    bucket)   │       │  parse-resume      │
│          │    │              │       │  interview-chat    │
│          │    │              │       │  analyze-interview │
│          │    │              │       │  speechmatics-token│
│          │    │              │       │  generate-model-   │
│          │    │              │       │    answers          │
│          │    │              │       │  generate-interview │
│          │    │              │       │    -plan            │
│          │    │              │       │  parse-job-         │
│          │    │              │       │    description      │
│          │    │              │       │  fetch-job-url      │
│          │    │              │       └────┬───────────────┘
│          │    │              │            │
└──────────┘    └──────────────┘            ▼
                                    Google Gemini API
                                    (conversation, analysis,
                                     resume parsing, model
                                     answers, plan generation)
```

## Tech Stack

| Category               | Choice                                           |
|------------------------|--------------------------------------------------|
| **Framework**          | React 18 + TypeScript + Vite 7                   |
| **Styling**            | Tailwind CSS v4 + shadcn/ui (Radix primitives)  |
| **Routing**            | React Router v7                                  |
| **Icons**              | lucide-react                                     |
| **Backend / Auth**     | Supabase (auth, storage, edge functions)         |
| **AI / LLM**           | Google Gemini (gemini-3.1-flash-lite)            |
| **Speech-to-Text**     | Speechmatics (real-time streaming)               |
| **PDF Reports**        | @react-pdf/renderer                              |
| **SVG assets**         | vite-plugin-svgr                                 |

## Routes

| Path              | Page              | Auth Required | Layout       |
|-------------------|-------------------|---------------|--------------|
| `/`               | Landing           | No            | Full-bleed   |
| `/signin`         | Sign In           | No            | Auth layout  |
| `/signup`         | Sign Up           | No            | Auth layout  |
| `/dashboard`      | Dashboard         | Yes           | AppLayout    |
| `/setup`          | Interview Setup   | Yes           | AppLayout    |
| `/plan`           | Interview Plan    | Yes           | AppLayout    |
| `/preparing`      | Preparing Room    | Yes           | AppLayout    |
| `/session/:id`    | Interview Session | Yes           | Full-screen  |
| `/report/:id`     | Interview Report  | Yes           | AppLayout    |

## Features

- **Resume Upload & Parsing** — Drag-and-drop PDF upload → Gemini extracts experience, skills, education
- **Job Description Import** — Paste text or submit a URL (auto-fetched via Edge Function)
- **Interview Plan Generation** — AI creates a tailored question set (screening, behavioral, technical, follow-ups)
- **Live Voice Studio** — Real-time Speechmatics transcription + Gemini-powered AI interviewer
- **Post-Interview Report** — Score, transcript, per-question feedback, and AI-generated model answers
- **PDF Export** — Download interview reports as PDF documents

## Getting Started

### Prerequisites

- Node.js 20+
- A Supabase project with the [interviewlab](https://supabase.com) project linked
- API keys for Google Gemini and Speechmatics (see [Secrets](#secrets))

### Installation

```bash
# 1. Clone the repository
git clone <repo-url>
cd interviewlab

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev
```

The app is available at `http://localhost:5173`.

### Available Scripts

| Script        | Description                        |
|---------------|------------------------------------|
| `npm run dev`  | Start Vite development server      |
| `npm run build`| Production build to `dist/`        |
| `npm run preview`| Preview the production build locally |

## Secrets

The following secrets are stored in **Supabase Edge Function secrets** (not in `.env` files). Set them via the [Supabase dashboard](https://supabase.com/dashboard/project/edbytsuykbezfvniwdyd/settings/secrets):

| Secret Name                | Required By                  | Description                        |
|----------------------------|------------------------------|------------------------------------|
| `GEMINI_API_KEY`           | All AI functions             | Google Gemini API key              |
| `SPEECHMATICS_API_KEY`     | `speechmatics-token`         | Speechmatics permanent API key     |

These are read inside Supabase Edge Functions via `Deno.env.get("SECRET_NAME")` and never exposed to the client.

## Edge Functions

All backend logic runs as Supabase Edge Functions (Deno) in `supabase/functions/`:

| Function                     | Purpose                                                 |
|------------------------------|---------------------------------------------------------|
| `parse-resume`               | Extract structured fields from a PDF resume via Gemini  |
| `parse-job-description`      | Parse a pasted job description into structured form     |
| `fetch-job-url`              | Fetch and extract job description from a URL            |
| `generate-interview-plan`    | Build a full question plan from resume + JD data        |
| `generate-model-answers`     | Generate ideal answer text for each question            |
| `interview-chat`             | Live AI interviewer conversation (Gemini streaming)     |
| `analyze-interview`          | Score and analyze a completed interview transcript      |
| `speechmatics-token`         | Issue short-lived JWT tokens for real-time transcription|

All functions authenticate via the caller's Supabase JWT and include CORS headers for browser access.

## Database

Key Supabase tables (populated by migrations):

| Table       | Purpose                                      |
|-------------|----------------------------------------------|
| `profiles`  | User profiles linked to `auth.users`         |
| `resumes`   | Parsed resume data (owned by user, RLS)      |
| `sessions`  | Interview sessions with plan references       |

RLS policies enforce that users can only access their own data.

## Design System

The project uses a consistent design system defined in [`docs/design-system/MASTER.md`](./docs/design-system/MASTER.md). Key tokens:

- **Neutral palette** — slate/gray with indigo accent (`--color-primary`)
- **Typography** — DM Sans (headings) + Inter (body)
- **Glassmorphism** — subtle backdrop blur and soft shadows on cards
- **Responsive** — mobile-first, nav collapses to drawer on small screens

## Deployment

The production build is generated via:

```bash
npm run build
```

Output goes to `dist/`. Deploy the `dist/` directory to any static host (Vercel, Netlify, Cloudflare Pages, etc.). Ensure the SPA fallback is configured to serve `index.html` for all routes (e.g., `_redirects` on Netlify or a `vercel.json` rewrite).

Supabase Edge Functions are deployed via the [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase functions deploy <function-name> --project-ref edbytsuykbezfvniwdyd
```

## Project Structure

```
src/
├── components/
│   ├── ui/                   # shadcn/ui primitives (button, card, avatar, etc.)
│   ├── layout/               # AppLayout, AppSidebar, Header
│   ├── auth/                 # ProtectedRoute, Auth forms
│   ├── common/               # Brand, EmptyState, shared components
│   ├── landing/              # HeroSection, FeaturesSection, CtaSection
│   ├── interview/            # BriefingCard and interview-specific UI
│   └── studio/               # Voice studio primitives (mic, waveform)
├── contexts/
│   └── AuthContext.tsx        # Supabase auth state provider
├── hooks/
│   ├── useSpeechRecognition.ts   # Browser speech recognition hook
│   └── useJoinChecks.ts          # Join/session validation hook
├── lib/
│   ├── utils.ts              # cn() helper (shadcn/ui)
│   ├── supabase.ts           # Supabase client singleton
│   ├── tts.ts                # Text-to-speech utilities
│   ├── interview.ts          # Interview state helpers
│   ├── sessions.ts           # Session management helpers
│   ├── resumes.ts            # Resume data helpers
│   └── exportPdf.tsx         # PDF report generation
├── pages/
│   ├── Landing.tsx           # Marketing page
│   ├── SignIn.tsx / SignUp.tsx
│   ├── Dashboard.tsx
│   ├── InterviewSetup.tsx    # Resume + JD intake
│   ├── InterviewPlan.tsx     # Plan review & confirmation
│   ├── PreparingRoom.tsx     # Pre-interview setup
│   ├── InterviewSession.tsx  # Live voice interview
│   └── InterviewReport.tsx   # Post-interview feedback
├── App.tsx                   # BrowserRouter + route definitions
├── main.tsx                  # Entry point
└── index.css                 # Tailwind imports + @theme tokens
```

## License

Private / internal use.