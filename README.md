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
