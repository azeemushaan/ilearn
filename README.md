# iLearn (ER21) Admin & Billing Platform

A production-ready Next.js 14 admin portal for iLearn ER21 with Firebase Auth, Firestore, Cloud Functions, and secure manual billing workflows.

## Features

- Next.js App Router with Tailwind + shadcn/ui.
- Firebase Auth (email/password & Google) with role-based custom claims (`admin`, `teacher`, `student`).
- Full admin dashboard for coaches, plans, subscriptions, manual payment approvals, invoices, users, audit trail, and system settings.
- Coach self-service billing (manual bank slip uploads) and impersonation tooling for support teams.
- Cloud Functions v2 automations for payment approval, subscription lifecycle, seat guardrails, invoice creation, and email receipt generation.
- Hardened Firestore & Storage rules with tenant isolation and admin override.
- Shared Zod schemas, typed Firestore converters, and comprehensive testing via Vitest.
- Deployment ready Firebase configuration (hosting, functions, firestore rules/indexes, storage rules).

## Prerequisites

- Node.js 20+
- npm 10+
- Firebase CLI (`npm install -g firebase-tools`)
- A Firebase project with Firestore, Authentication, Cloud Storage, and Cloud Functions enabled.
- Service account credentials (JSON) with Firestore/Storage access for local server actions (`FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PROJECT_ID`).

## Environment Variables

Create `.env.local` for Next.js and `.env` for Cloud Functions if needed.

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_APP_ID=
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=service-account@project.iam.gserviceaccount.com
FIREBASE_PROJECT_ID=your-project-id
```

For Cloud Functions secrets (e.g., support email) run:

```
firebase functions:secrets:set SUPPORT_EMAIL
```

## Development

Install dependencies (the repository already contains a `node_modules` tree for the provided environment; re-install only if necessary).

```
npm install
```

Run the Next.js dev server:

```
npm run dev
```

Run unit tests (Vitest):

```
npm run test
```

### Firebase Emulators

```
firebase emulators:start
```

Configure the Firebase CLI with `.firebaserc` (`your-project-id`) before deployment.

## Deployment

1. Build the Next.js app:
   ```
   npm run build
   ```
2. Deploy Firestore rules & indexes:
   ```
   firebase deploy --only firestore:rules,firestore:indexes
   ```
3. Deploy Storage rules:
   ```
   firebase deploy --only storage:rules
   ```
4. Deploy Cloud Functions:
   ```
   cd functions && npm install && npm run deploy
   ```
5. Deploy Hosting (Next.js on Firebase Hosting with frameworks backend):
   ```
   firebase deploy --only hosting
   ```

## Testing Matrix

- **Unit**: Vitest coverage for Zod schemas and admin operations (see `tests/`).
- **Integration**: Exercises server actions for plans, payments, and subscriptions (`tests/integration`).
- **E2E**: Playwright specs (see `tests/e2e`) verifying admin approving manual payments and verifying activated subscriptions.

Run all tests:

```
npm run test
```

Playwright requires browsers; install once via `npx playwright install`.

## Project Structure

```
src/
  app/admin/(dashboard)    # Admin routes with server actions and guards
  components/admin         # Admin UI building blocks
  lib/schemas              # Shared Zod schemas & typings
  lib/firestore            # Firestore converters and admin operations
  lib/firebase             # Admin SDK initialisation
  hooks/                   # Client state hooks (impersonation, toasts)
functions/
  src/index.ts             # Cloud Functions (payment workflows, claims, invoices)
firestore.rules            # Firestore security rules with admin override
storage.rules              # Storage security rules
firestore.indexes.json     # Composite indexes required by queries
firebase.json              # Hosting + Functions deployment config
```

## Service Accounts & Privileged Ops

Server actions and Cloud Functions require a service account with the following roles:

- Cloud Datastore Owner (Firestore admin)
- Cloud Functions Admin (deployment)
- Storage Admin (receipt PDFs)
- Firebase Auth Admin (custom claims)

Generate a service account JSON and provide the values via environment variables as described earlier.

## Email Templates & PDFs

Cloud Functions use Handlebars templates (`functions/src/index.ts`) to generate receipt bodies. Extend them or plug into your transactional email provider by replacing the placeholder logic in `sendInvoiceEmail`.

## Timezone

All server computations normalise to `Asia/Karachi` and the UI renders friendly timestamps with date-fns.
