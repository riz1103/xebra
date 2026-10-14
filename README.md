# Xevra - eXamination EValuation & Result Authority

A comprehensive Next.js examination management platform where proctors can create, manage, and distribute exams, and examinees can take exams and view their results.

## Features

### Authentication
- Google SSO (Sign in with Google)
- Email/Password registration and login
- Firebase Authentication integration
- Role-based access (Admin, Proctor, Examinee)

### Proctor Dashboard
- **Exams**: Create, edit, publish, and archive exams with configurable settings
- **Question Types**: Manage question categories (Multiple Choice, True/False, etc.)
- **Exam Bundles**: Group related exams together for batch management
- **Invitations**: Send individual or group exam invitations
- **Examinee Groups**: Organize examinees into groups
- **Results**: View and analyze exam results with pass rates and scores
- **Proctor Requests** (Admin): Review and approve/reject proctor applications

### AI Exam Generation ("Generate from material")
- **Sources**: photos of book pages, handouts, or whiteboards (including phone camera capture), PDFs (text or scanned), PowerPoint (.pptx, including speaker notes), Word (.docx), text files, or pasted text
- **Reading**: text is extracted locally; photos and scanned pages are transcribed by Gemini (diagrams and tables are described in words)
- **Analysis**: detects subject, examinee level, language, and topics, then recommends the exam type (quiz, practice, long test, midterm, final, diagnostic) and size
- **Blueprint**: proctor adjusts exam type, topics, question mix and points, difficulty mix, thinking skills, reading passages, parts, timing, passing score, and question order. The time limit is estimated from the question mix
- **Question pool**: optionally generate more questions than each session uses (e.g. 100 in the pool, 40 per session). With parts, each part draws its per-session count at random so every examinee gets the same mix; without parts, the exam draws from the whole pool. Time limit and instructions follow the per-session count
- **Review**: generated questions show the correct answer, explanation, source page, and any validation issues; selected questions are added to the exam editor with exam settings filled in
- **Add to an existing exam**: on the Edit Exam page, "Generate from material" writes new questions that avoid repeating the exam's existing ones, and adds them as new parts, into an existing part, or to the exam's questions, with the items per session and time limit adjusted
- **Origin tag**: exams are tagged *AI generated*, *AI-assisted* (mixed), or *Manual*, shown on the exam list (with a filter) and details page. The backend keeps the tag current as questions are added
- **Usage budget**: requests use the main model (Gemini Flash) until this month's estimated spend reaches the backend's `AI_PRIMARY_MONTHLY_BUDGET_USD` or a proctor makes `AI_PRIMARY_DAILY_REQUESTS_PER_USER` requests in a day, then switch to the lighter model (Flash-Lite). A request that hits the main model's quota is retried on the lighter model. The generator dialog shows the active model and budget used. The spend cap set in Google AI Studio remains the hard limit
- **Saved with each question**: the explanation (`explanation`) and AI details (`metadata.ai`: difficulty, thinking skill, topic, source page, essay rubric). The API never returns these to examinees; proctors see them on the exam details and result review pages

### Examinee Experience
- **My Exams**: View pending invitations, in-progress and completed exams
- **Exam Taking**: Full exam interface with timer, question navigation, flagging, auto-save
- **My Results**: View scores, pass/fail status, and feedback
- **Become a Proctor**: Submit requests to upgrade to proctor role

### Exam Features
- Randomized or fixed question order
- Per-exam or per-question time limits
- Multiple passing conditions (percentage, points, or minimum correct items)
- Multiple choice with single or multiple correct answers
- Auto-save progress every 30 seconds
- Resume interrupted sessions
- Auto-submit on timer expiry

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **UI Components**: Radix UI primitives (shadcn/ui-style)
- **State Management**: Zustand
- **Data Fetching**: TanStack React Query
- **Forms**: React Hook Form + Zod validation
- **Auth**: Firebase Authentication
- **HTTP Client**: Axios
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Toasts**: Sonner
- **Date Formatting**: date-fns
- **Theme**: next-themes (light/dark mode)

## Getting Started

### Prerequisites
- Node.js 18+
- npm

### Setup

1. Clone the repository and install dependencies:
```bash
cd xebra
npm install
```

2. Configure environment variables in `.env.local`:
```env
NEXT_PUBLIC_API_BASE_URL=https://xebra-api.netlify.app

NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xebra-486713.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=xebra-486713
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=xebra-486713.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id
```

   To use AI exam generation, enable **Firebase AI Logic** for the project (Firebase console → AI Logic → Get started, or `npx -y firebase-tools@latest init ailogic`) and, for production, set up App Check with reCAPTCHA Enterprise and add `NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY`. The Gemini free tier allows only a few runs a day, so for regular use link a billing account to the project in Google AI Studio and set a monthly spend cap there (Dashboard → Spend). Keep the backend's `AI_PRIMARY_MONTHLY_BUDGET_USD` below that cap so the lighter model still has room. See `env.example` for optional settings.

3. Start the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── dashboard/          # Authenticated dashboard pages
│   │   ├── exams/          # Exam management (create, edit, view)
│   │   ├── questions/      # Question type management
│   │   ├── bundles/        # Exam bundle management
│   │   ├── invitations/    # Exam invitations
│   │   ├── groups/         # Examinee group management
│   │   ├── results/        # Exam results (proctor view)
│   │   ├── my-exams/       # Examinee's exam list
│   │   ├── my-results/     # Examinee's results
│   │   ├── proctor-request/    # Request proctor role
│   │   └── proctor-requests/   # Admin: manage requests
│   ├── exam/[sessionId]/   # Exam-taking interface
│   ├── login/              # Authentication page
│   └── page.tsx            # Landing page
├── components/
│   ├── layout/             # Sidebar, Header
│   └── ui/                 # Reusable UI components
├── lib/
│   ├── api.ts              # API client with all endpoints
│   ├── firebase.ts         # Firebase auth configuration
│   ├── utils.ts            # Utility functions
│   └── validations.ts      # Zod validation schemas
├── providers/              # React context providers
├── stores/                 # Zustand state stores
└── types/                  # TypeScript type definitions
```

## API Integration

The app integrates with the Xebra API at `https://xebra-api.netlify.app` with full support for:
- Authentication (Google SSO + email/password)
- Question Types CRUD
- Exam Questions CRUD
- Exams CRUD with inline question creation
- Exam Bundles CRUD
- Exam Sessions (create, resume, answer, submit)
- Exam Results (view, analyze)
- Exam Invitations (individual, group, bundle)
- Examinee Groups management
- Proctor Requests (submit, approve, reject)
