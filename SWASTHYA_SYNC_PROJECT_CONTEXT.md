# Swasthya Sync Project Context

This document is a repo-based status snapshot. It reflects what is implemented in the codebase as of inspection, what is clearly placeholder work, and what appears to be startup/setup dependent rather than completed feature work.

## 1) Executive summary

This repository is a local monorepo for a hospital management system built with:

- Backend: Node.js + Express + PostgreSQL + JWT auth
- Frontend: Next.js App Router + React + TypeScript
- Database schema: explicit PostgreSQL schema in [backend/src/schema.sql](backend/src/schema.sql)
- Core API surface: [backend/src/server.js](backend/src/server.js)
- Frontend auth/session handling: [frontend/context/AuthContext.tsx](frontend/context/AuthContext.tsx)

The codebase is not a blank scaffold. It includes a real backend API, a hospital schema, protected auth flows, patient and appointment management, emergency triage, CPOE, IPD admission workflows, forms, and discharge/document generation. However, several major modules are still placeholder screens meant for future phases rather than actual production-ready features.

## 2) Evidence base used for this assessment

This summary is based on direct inspection of the following code and documentation:

- [backend/src/server.js](backend/src/server.js)
- [backend/src/schema.sql](backend/src/schema.sql)
- [backend/src/auth.js](backend/src/auth.js)
- [backend/src/db.js](backend/src/db.js)
- [backend/README.md](backend/README.md)
- [backend/.env.example](backend/.env.example)
- [frontend/context/AuthContext.tsx](frontend/context/AuthContext.tsx)
- [frontend/lib/api.ts](frontend/lib/api.ts)
- [frontend/components/shared/PlaceholderPage.tsx](frontend/components/shared/PlaceholderPage.tsx)
- [backend/tests/emergency-phase7.test.js](backend/tests/emergency-phase7.test.js)

## 3) Architecture overview

### 3.1 Backend

The backend exposes a central Express app in [backend/src/server.js](backend/src/server.js). It:

- loads environment configuration via dotenv
- configures CORS with FRONTEND_ORIGIN or localhost:3000 fallback
- parses JSON with a 32kb limit
- exposes a health route at /health
- defines auth, patient, appointment, emergency, CPOE, bed/admission, form, and discharge APIs
- uses a PostgreSQL pool from [backend/src/db.js](backend/src/db.js)
- generates JWTs via [backend/src/auth.js](backend/src/auth.js)

The database layer initializes a PostgreSQL pool using DATABASE_URL and reads the canonical schema from [backend/src/schema.sql](backend/src/schema.sql).

### 3.2 Frontend

The frontend is a Next.js app using the App Router under [frontend/app](frontend/app). It includes:

- public auth screens under [frontend/app/(auth)](frontend/app/(auth))
- app-shell routes under [frontend/app/(app)](frontend/app/(app))
- protected session logic in [frontend/context/AuthContext.tsx](frontend/context/AuthContext.tsx)
- shared API wrapper in [frontend/lib/api.ts](frontend/lib/api.ts)
- reusable placeholder component in [frontend/components/shared/PlaceholderPage.tsx](frontend/components/shared/PlaceholderPage.tsx)

The frontend defaults to calling the backend at http://localhost:5000 unless NEXT_PUBLIC_API_URL is provided.

## 4) Authentication and authorization model

Implemented and backed by code:

- JWT-based auth using jsonwebtoken in [backend/src/auth.js](backend/src/auth.js)
- Login and register endpoints in [backend/src/server.js](backend/src/server.js)
- Role checks using requireRole("ADMIN") and other role gates
- Public user serialization returning role, hospital info, avatar initials
- Frontend local storage persistence of token and user in [frontend/context/AuthContext.tsx](frontend/context/AuthContext.tsx)

Credentials described in [backend/README.md](backend/README.md):

- admin@swasthyasync.com / admin123
- staff@swasthyasync.com / staff123

These are clearly local development seeds, not production credentials.

## 5) Database model and implemented domain objects

The schema in [backend/src/schema.sql](backend/src/schema.sql) includes major hospital workflow tables:

- hospitals
- users
- patients
- emergency_encounters
- cpoe_orders
- beds
- ipd_admissions
- appointments
- form_templates
- patient_forms
- discharge_templates
- discharge_summaries

This is a substantial domain model, not a stubbed schema. Notable constraints and indexes include:

- UUID-based hospital and user identity
- unique UHID generation via patient_uhid_seq
- emergency queue tracking
- active-bed uniqueness and patient uniqueness for active IPD admissions
- appointment slot uniqueness per hospital/doctor/date/time when not cancelled
- form template metadata and patient form payload storage
- discharge summary linkage to admissions

## 6) Implemented feature status

### 6.1 Implemented and strongly backed by code

These are the major active workflows visible in the repo:

- Authentication and session restoration:
  - [backend/src/server.js](backend/src/server.js)
  - [frontend/context/AuthContext.tsx](frontend/context/AuthContext.tsx)
- Patient management and validation:
  - patient registration, UHID creation, enum validation, patient listing and retrieval
- Appointment scheduling and slot availability:
  - doctor/slot validation, appointment creation, appointment status transitions
- Emergency queue and triage flow:
  - emergency encounter creation and status tracking
- CPOE order generation:
  - order creation, status lifecycle, categories and priority
- IPD admissions and bed assignment:
  - bed records, admission creation, occupancy protection via unique indices
- Staff Management:
  - Admin-only staff directory, linked login/profile records, search/filters, role statistics, and account status controls
- Form templates and patient forms:
  - form template storage, view/download routes, patient form linking and PDF-style outputs
- Discharge summary workflow:
  - discharge summary creation and PDF document generation

### 6.2 Real UI pages that appear implemented

The following app pages are present and are not simple placeholder stubs:

- [frontend/app/(app)/dashboard/page.tsx](frontend/app/(app)/dashboard/page.tsx)
- [frontend/app/(app)/patients/page.tsx](frontend/app/(app)/patients/page.tsx)
- [frontend/app/(app)/appointments/page.tsx](frontend/app/(app)/appointments/page.tsx)
- [frontend/app/(app)/emergency/page.tsx](frontend/app/(app)/emergency/page.tsx)
- [frontend/app/(app)/cpoe/page.tsx](frontend/app/(app)/cpoe/page.tsx)
- [frontend/app/(app)/ipd/page.tsx](frontend/app/(app)/ipd/page.tsx)
- [frontend/app/(app)/forms/page.tsx](frontend/app/(app)/forms/page.tsx)
- [frontend/app/(app)/discharge/page.tsx](frontend/app/(app)/discharge/page.tsx)
- [frontend/app/(app)/staff/page.tsx](frontend/app/(app)/staff/page.tsx)

These pages are important because they correspond to real feature domains and are not only placeholder navigation nodes.

Staff Management was initially a placeholder and is now implemented. Its profile model and API contract are documented in [STAFF_MANAGEMENT.md](STAFF_MANAGEMENT.md).

## 7) Partially implemented / mixed-status areas

A few areas are functionally real but still appear to be thin or demo-oriented rather than complete production modules.

### Dashboard

The dashboard shell exists, but it appears to be a KPI shell built on top of app/demo scaffolding rather than a complete analytics layer. It is present, but not necessarily deeply integrated with all live data streams.

### Forms

The forms module is far more feature-rich than most of the repo, including template browsing, patient-specific form creation, PDF generation/viewing, and form-related data flows. That said, the repo still clearly signals modular expansion beyond the current form surface.

### Discharge

Discharge summary and PDF generation are present, which is a concrete feature. However, it is best treated as an implemented patient workflow, not as a complete end-to-end billing or post-discharge suite.

## 8) Planned, placeholder, and not-yet-built modules

The codebase explicitly contains placeholder pages for future modules using the shared [frontend/components/shared/PlaceholderPage.tsx](frontend/components/shared/PlaceholderPage.tsx) component. These modules are clearly not full implementations yet:

- [frontend/app/(app)/analytics/page.tsx](frontend/app/(app)/analytics/page.tsx)
- [frontend/app/(app)/audit-log/page.tsx](frontend/app/(app)/audit-log/page.tsx)
- [frontend/app/(app)/billing/page.tsx](frontend/app/(app)/billing/page.tsx)
- [frontend/app/(app)/blood-bank/page.tsx](frontend/app/(app)/blood-bank/page.tsx)
- [frontend/app/(app)/clinical-notes/page.tsx](frontend/app/(app)/clinical-notes/page.tsx)
- [frontend/app/(app)/inventory/page.tsx](frontend/app/(app)/inventory/page.tsx)
- [frontend/app/(app)/laboratory/page.tsx](frontend/app/(app)/laboratory/page.tsx)
- [frontend/app/(app)/nursing/page.tsx](frontend/app/(app)/nursing/page.tsx)
- [frontend/app/(app)/ot/page.tsx](frontend/app/(app)/ot/page.tsx)
- [frontend/app/(app)/pharmacy/page.tsx](frontend/app/(app)/pharmacy/page.tsx)
- [frontend/app/(app)/radiology/page.tsx](frontend/app/(app)/radiology/page.tsx)
- [frontend/app/(app)/revenue-cycle/page.tsx](frontend/app/(app)/revenue-cycle/page.tsx)
- [frontend/app/(app)/settings/page.tsx](frontend/app/(app)/settings/page.tsx)

Also notable:

- [frontend/app/(app)/form-templates/page.tsx](frontend/app/(app)/form-templates/page.tsx) redirects to /forms
- [frontend/app/page.tsx](frontend/app/page.tsx) redirects root landing to /login

These are not failures; they are consistent with a staged architecture: foundational shell and core hospital flows built first, then remaining modules deferred.

## 9) Startup/configuration requirements and local environment risk

### 9.1 Backend configuration

The backend expects environment configuration defined in [backend/.env.example](backend/.env.example):

- PORT=5000
- DATABASE_URL=postgresql://postgres:postgres@localhost:5432/swasthyasync
- JWT_SECRET=replace-with-a-long-random-local-secret
- JWT_EXPIRES_IN=8h
- FRONTEND_ORIGIN=http://localhost:3000

The code reads these values directly via process.env in [backend/src/server.js](backend/src/server.js), [backend/src/db.js](backend/src/db.js), and [backend/src/auth.js](backend/src/auth.js).

### 9.2 Frontend configuration

The frontend API base is defined in [frontend/lib/api.ts](frontend/lib/api.ts):

- NEXT_PUBLIC_API_URL default: http://localhost:5000

This implies the frontend will fail gracefully if the backend is not running, or can be redirected to a different API origin if environment is set.

### 9.3 Required infrastructure

This repo depends on a local PostgreSQL instance that matches the DATABASE_URL and a valid JWT secret. The backend README instructs the developer to:

1. copy .env.example to .env
2. set DATABASE_URL and JWT_SECRET
3. install dependencies
4. run seed
5. run the backend server

Because the schema and auth logic are code-first and DB-backed, local startup is dependent on DB readiness and environment variables.

## 10) Known status of project readiness

### Implemented status

The codebase contains real implementation for core clinical and operational workflows:

- registration/login/logout/auth guard
- patient intake and validation
- appointment scheduling
- emergency triage queue
- CPOE order management
- IPD admission/bed occupancy tracking
- active form and discharge document workflows

### Partially implemented status

- dashboard summary screens
- form workflow polish and patient-specific UI
- discharge automation and document generation

### Planned or placeholder status

- analytics
- billing
- inventory and pharmacy
- blood bank, OT, radiology, laboratory, nursing
- settings, audit log

### Broken or environment-dependent status

This is the biggest caveat: without the local database, environment variables, and a valid JWT secret, the app cannot run correctly. The repo does not appear to include an automated bootstrap that guarantees a working database out of the box. The seed command is the intended bootstrap step, but it only works when the local PostgreSQL environment is ready.

## 11) Testing signals

There is at least one test file in [backend/tests/emergency-phase7.test.js](backend/tests/emergency-phase7.test.js). That particular test is a minimal verification that the emergency queue route rejects unauthenticated access with a 401 response.

This confirms that the project includes some backend route-level validation tests, but it is not evidence of full end-to-end coverage across the system.

## 12) Overall assessment

This project is best described as a real hospital management foundation with a substantial set of working domain features already implemented, rather than a pure mock or wireframe project.

The most accurate classification is:

- Core clinical workflow foundation: implemented
- Auth and backend rule enforcement: implemented
- Many patient/admin workflows: implemented
- High-level app shell and navigation: implemented
- Speciality modules like lab, radiology, pharmacy, billing, etc.: placeholder or planned
- Entire app readiness: dependent on environment and database setup

In short: the repo appears to be a staged healthcare application with a strong backend schema and actual working core features, but also with a clear roadmap of remaining modules still being intentionally deferred.
