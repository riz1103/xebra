# Xebra / Xevra — Future Features

Living roadmap for work we can pick up over time. Update status when something ships, stalls, or starts.

**Repos**

| Label | Meaning |
|-------|---------|
| `done` | Shipped and usable in prod (front + back as needed) |
| `ongoing` | Actively being built or iteratively improved |
| `inc` | Partially built — stubs, backend-only, UI-only, or missing polish |
| `not-started` | Idea only; no meaningful implementation yet |

**How to use**

1. Pick an item marked `inc` or `not-started`.
2. Note the **Where** paths before coding.
3. When done, set status to `done` and add a short **Notes** line (date optional).
4. Prefer finishing `inc` items before starting brand-new ones in the same area.

**Repos**

- Frontend: `e:\xebra` (Next.js)
- Backend: `F:\Project Xebra` (Express / Netlify Functions)

---

## 1. Core platform (shipped baseline)

These are the foundation; keep listed so we don’t re-propose them.

| Status | Feature | Notes | Where |
|--------|---------|-------|-------|
| `done` | Auth: Google SSO + email/password | Firebase Auth | FE login; BE `authRoutes` |
| `done` | Roles: examinee / proctor / admin | Proctor upgrade requests | dashboard + BE |
| `done` | Exam CRUD, publish, archive, duplicate, sample | Statuses draft → active → completed/archived | `/dashboard/exams` |
| `done` | Question types + layouts | MC, T/F, multi-answer, ID, essay, ordering, matching, audio, hotspot | FE layouts; admin question types |
| `done` | Multi-part exams | Per-part timers / pass rules / draws | exam editor + sessions |
| `done` | Scheduling + max attempts + expiry | `scheduledStartTime` / `scheduledEndTime` | invitations / exam settings |
| `done` | Invitations (individual, group, bundle) | EmailJS | `/dashboard/invitations` |
| `done` | Groups + join codes | | `/dashboard/groups`, `/dashboard/join` |
| `done` | Exam taking: timer, flag, autosave, resume, auto-submit | | `/exam/[sessionId]` |
| `done` | Scoring methods + essay grading + reconciliations | | results + BE scoring |
| `done` | Item analysis + result review / slip | | `/dashboard/results` |
| `done` | Certificates + public verify | | `/verify/[code]` |
| `done` | Study report / study topics | | my-results |
| `done` | Question bank + reading phrases | Personal / org | `/dashboard/question-bank` |
| `done` | Organizations + departments + shared banks/exams | | `/dashboard/organizations` |
| `done` | Exam collaborators + audit log | | exam detail / BE collaborators |
| `done` | Bundles | | `/dashboard/bundles` |
| `done` | AI generate-from-material + usage budgets | Gemini; origin tags | exam generator components |
| `done` | Practice quizzes from material / history | Client AI | `/dashboard/practice` |
| `done` | Live monitor: extend time / force-submit | | `/dashboard/exams/[id]/live` |
| `done` | Integrity event logging (tab/blur/copy/paste/fullscreen) | Events recorded; deeper UX still open | `integrity-logger.ts` |
| `done` | Webhooks (result events) | Working path | settings + BE `webhookRoutes` |
| `done` | i18n strings (EN / Filipino / Spanish-ish) + light/dark | | FE |
| `done` | Accommodations (`timeMultiplier`) | | exam/session settings |

---

## 2. Integrations & billing

| Status | Feature | Notes | Where |
|--------|---------|-------|-------|
| `inc` | Integrations status UI | Shows configured vs not; Connect actions hit stubs | FE `IntegrationsSettings`; BE `integrationsController` |
| `inc` | PayMongo QR Ph (30-day plans and extra AI requests) | Checkout, status poll, and webhook are wired. A payment covers 30 days; paying again renews it. Needs `PAYMONGO_*` env on the API and a dashboard webhook before it can charge | `POST /api/integrations/paymongo/checkout` |
| `not-started` | Invoices, seat limits, plan expiry | QR Ph upgrade stays until an admin changes it | — |
| `not-started` | Paid AI budget top-ups | Plans upgrade via QR Ph; extra quota packs do not | BE `ai-usage` |
| `inc` | Web push subscribe API | Saves subscription when VAPID set; sending/scheduling limited under Netlify | `push/subscribe`, SW push listener |
| `not-started` | Reliable reminder / result push delivery | Needs worker or external push sender | — |
| `inc` | Google Classroom connect | Stub 501 | `google-classroom/connect` |
| `inc` | LTI 1.3 launch | Stub 501 | `lti/launch` |
| `inc` | Google Sheets sync | Stub 501; webhooks are the interim | `google-sheets/sync` |
| `inc` | Facebook login | Backend route exists; no FE button | `POST /api/auth/login/facebook`; FE login |

---

## 3. Proctor & authoring

| Status | Feature | Notes | Where |
|--------|---------|-------|-------|
| `not-started` | Rubric-assisted essay grading (AI draft + human confirm) | Rubric already stored on AI essays (`metadata.ai`) | result review / grades API |
| `not-started` | Question versioning / bank change history | Exam audit log exists; bank versions do not | question-bank |
| `not-started` | Cross-org / public template marketplace | Sample/duplicate exams exist for owners | exams sample/duplicate |
| `not-started` | Richer retake policies (cooldown, best-of-N, forced new draw) | Max attempts exists | exam settings + sessions |
| `not-started` | Printable / offline paper exam packs from bank | | question-bank export |
| `not-started` | Bulk CSV invite + mass extend / force-submit | Live actions are per-session today | invitations + live |
| `not-started` | New question layouts beyond current set | Admin binds types; layouts need FE code | question layouts |
| `inc` | Backend README / feature guides sync | README still describes a thin API; FE guides in backend repo are outdated | `F:\Project Xebra\README.md`, `FRONTEND_*.md` |

---

## 4. Examinee & learning

| Status | Feature | Notes | Where |
|--------|---------|-------|-------|
| `not-started` | Adaptive practice from weak study-report topics | Study report exists; practice doesn’t feed on it yet | practice + study-report |
| `not-started` | Spaced email/push reminders before scheduled exams | Prefs exist; schedulers limited on serverless | notification prefs + cron |
| `not-started` | Peer review / formative self-assessment modes | | new exam mode |
| `inc` | Answer review / explanation UX | Works when exam allows; polish + consistency TBD | post-submit review |
| `inc` | Android examinee app | Expo app in `mobile/`: email sign-in, invitations, exam taking, results, and group join codes. Authoring stays on the website | `mobile/` |
| `not-started` | Mobile-first exam-taking UX pass | Functional; optimize for phones | `/exam/[sessionId]` |
| `not-started` | Accessibility pass (exam UI: focus, contrast, screen readers) | | exam + dashboard |

---

## 5. Integrity & proctoring (deeper)

| Status | Feature | Notes | Where |
|--------|---------|-------|-------|
| `inc` | Integrity event capture | Tab hide, blur, copy/paste, fullscreen exit | `src/lib/integrity-logger.ts` |
| `not-started` | Integrity dashboard (per session / cohort risk scores) | Events stored; analysis UI thin | live + results integrity |
| `not-started` | Webcam / face presence (optional, consent-based) | Sensitive; product + legal review first | — |
| `not-started` | Lockdown / fullscreen enforcement policy per exam | Partial signals only | exam settings |
| `not-started` | IP / device fingerprint summaries for proctors | | sessions |

---

## 6. Platform quality & ops

| Status | Feature | Notes | Where |
|--------|---------|-------|-------|
| `not-started` | Automated API / integration tests | `npm test` placeholder on backend | BE package.json |
| `not-started` | Frontend e2e (Playwright/Cypress) for take-exam happy path | | FE |
| `inc` | Session / notification schedulers on Netlify | Limited or disabled under serverless | BE cron / Netlify |
| `inc` | API docs (`docs.html`) accuracy | Some routes/roles drift (e.g. firebase-config, scoring-methods) | `src/public/docs.html` |
| `not-started` | Observability (error tracking, AI cost dashboards beyond budgets) | AI budget exists | — |

---

## Suggested pickup order (when unsure)

1. **PayMongo QR Ph go-live** (`inc`) — set prices, secret key, and the webhook, then a proctor can pay  
2. **Facebook SSO in login UI** (`inc`) — small, completes existing BE  
3. **Adaptive practice from study reports** (`not-started`) — high examinee value on existing data  
4. **Google Sheets or Classroom** (`inc`) — school distribution  
5. **Integrity dashboard** (`not-started`) — builds on logged events  
6. **Rubric-assisted essay grading** (`not-started`) — builds on stored rubrics  

---

## Changelog (doc)

| Date | Change |
|------|--------|
| 2026-04-16 | Initial inventory from current FE + BE codebase |
| 2026-10-20 | Replaced Stripe Checkout with PayMongo QR Ph (code wired; env and webhook still required to charge) |
| 2026-10-20 | QR Ph plans last 30 days and can be renewed; extra AI request packs are 10/₱30, 25/₱75, and 50/₱150; free quota default is 8 |
| 2026-10-20 | Added an Expo Android examinee app under `mobile/` |

When you implement something, add a row here and flip the table status above.
