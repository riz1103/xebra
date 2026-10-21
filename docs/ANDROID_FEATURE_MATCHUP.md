# Android feature matchup

This is the parity list between the website (`src/`) and the Android app (`mobile/`). The live site is [https://xevra.concepcion-digital-solutions.com/](https://xevra.concepcion-digital-solutions.com/). Both clients call `https://xebra-api.netlify.app`.

The phone app is a separate Expo project. A change under `src/` does not appear on Android until the same behavior is added under `mobile/` and this file is updated. `mobile/Xevra.apk` is a built snapshot; source edits are not on a phone until that APK is rebuilt and reinstalled.

`docs/FUTURE_FEATURES.md` still says authoring stays on the website. That note is outdated. This file is the parity list: website features belong on Android too.

## How to use this file

When a website feature is added or changed:

1. Find the row below, or add one. Use the next free id (`F-031`, then `F-032`, …).
2. Implement the same behavior in `mobile/`, using the website page as the spec and the API the website already calls.
3. Set **Status** to `matched` only when a phone user can finish the same task. Use `partial` when the screen exists but a named behavior is still absent, and list that behavior in **Gap**. Use `missing` when there is no Android screen.
4. Put the Android files in **Android**. Leave **Gap** empty when status is `matched`.

Do not follow `mobile/AGENTS.md` for navigation. That file is the Expo template. This app uses React Navigation. Screens are `mobile/src/screens/`. Routes are `mobile/src/navigation.ts`. API calls go through `mobile/src/api.ts`.

## Status counts

| Status | Count |
|--------|------:|
| matched | 11 |
| partial | 1 |
| missing | 18 |

## Matchup

| ID | Feature | Web | Android | Status | Gap |
|----|---------|-----|---------|--------|-----|
| F-001 | Email sign-in and registration, plus Continue with Google | `src/app/login/page.tsx` | `mobile/src/screens/LoginScreen.tsx`, `mobile/src/auth.tsx` | matched | |
| F-002 | Sign out | header account menu | `mobile/src/screens/ProfileScreen.tsx` | matched | |
| F-003 | Landing page | `src/app/page.tsx` | — | missing | |
| F-004 | Certificate verification | `src/app/verify/[code]/page.tsx` | — | missing | |
| F-005 | Shared exam link | `src/app/exams/[examId]/page.tsx`, `src/app/dashboard/my-exams/page.tsx` | `mobile/src/screens/ExamEntryScreen.tsx`, `mobile/src/links.ts`, `mobile/App.tsx` | matched | |
| F-006 | Dashboard overview | `src/app/dashboard/page.tsx` | — | missing | |
| F-007 | My exams | `src/app/dashboard/my-exams/page.tsx` | `mobile/src/screens/HomeScreen.tsx` | matched | |
| F-008 | Take an exam | `src/app/exam/[sessionId]/page.tsx` | `mobile/src/screens/ExamScreen.tsx`, `mobile/src/components/QuestionCard.tsx`, `mobile/src/math-text.tsx`, `mobile/src/integrity.ts` | matched | |
| F-009 | My results | `src/app/dashboard/my-results/page.tsx`, `src/app/dashboard/my-results/[id]/page.tsx`, `src/app/dashboard/results/[resultId]/review/page.tsx` | `mobile/src/screens/HomeScreen.tsx`, `mobile/src/screens/ResultScreen.tsx` | matched | |
| F-010 | Result certificate | `src/app/dashboard/my-results/[id]/certificate/page.tsx` | — | missing | |
| F-011 | Practice | `src/app/dashboard/practice/page.tsx` | — | missing | |
| F-012 | Join a group | `src/app/dashboard/join/page.tsx` | `mobile/src/screens/HomeScreen.tsx` | matched | |
| F-013 | Become a proctor | `src/app/dashboard/proctor-request/page.tsx` | — | missing | |
| F-014 | Exams list | `src/app/dashboard/exams/page.tsx` | — | missing | |
| F-015 | Create and edit an exam | `src/app/dashboard/exams/create/page.tsx`, `src/app/dashboard/exams/[id]/edit/page.tsx`, `src/app/dashboard/exams/[id]/page.tsx` | — | missing | Includes generate-from-material |
| F-016 | Live session monitoring | `src/app/dashboard/exams/[id]/live/page.tsx` | — | missing | |
| F-017 | Question bank | `src/app/dashboard/question-bank/page.tsx` | — | missing | |
| F-018 | Exam bundles | `src/app/dashboard/bundles/page.tsx` | — | missing | |
| F-019 | Invitations | `src/app/dashboard/invitations/page.tsx` | — | missing | |
| F-020 | Examinee groups | `src/app/dashboard/groups/page.tsx` | — | missing | Entering a join code is F-012, not this screen |
| F-021 | Proctor results | `src/app/dashboard/results/page.tsx`, `src/app/dashboard/results/[resultId]/review/page.tsx`, `src/app/dashboard/results/[resultId]/slip/page.tsx` | — | missing | |
| F-022 | Organizations | `src/app/dashboard/organizations/page.tsx`, `src/app/dashboard/organizations/[id]/page.tsx` | — | missing | |
| F-023 | Settings | `src/app/dashboard/settings/page.tsx` | `mobile/src/screens/ProfileScreen.tsx` | partial | Notifications, plan, webhooks, and integrations. Profile shows name, email, role, appearance, and sign out. |
| F-024 | Question types | `src/app/dashboard/questions/page.tsx` | — | missing | Admin |
| F-025 | Proctor requests | `src/app/dashboard/proctor-requests/page.tsx` | — | missing | Admin |
| F-026 | English and Filipino | `src/lib/i18n.ts` | — | missing | Android copy is English only |
| F-027 | Light and dark theme | `src/app/layout.tsx` (`next-themes`) | `mobile/src/theme.tsx` | matched | |
| F-028 | Math in question text | `src/components/math/math-text.tsx` | `mobile/src/math-text.tsx`, `mobile/src/math-notation.ts` | matched | |
| F-029 | Exam integrity events | `src/lib/integrity-logger.ts` | `mobile/src/integrity.ts` | matched | |
| F-030 | App icon | `public/icons/icon-512.png` | `mobile/assets/` | matched | |
