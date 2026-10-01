# Role-Based Access Control

## Roles

The application supports three canonical roles:

- `ADMIN`: full access to every current module and action.
- `DOCTOR`: clinical and operational module access defined below; may not register patients.
- `FRONT_DESK`: front-desk workflows defined below.

The login response returns lowercase role identifiers: `admin`, `doctor`, and `front_desk`. Staff Management stores broad hospital roles `ADMIN`, `DOCTOR`, and `STAFF`; `STAFF` maps to the existing `FRONT_DESK` RBAC category to preserve current permissions. Existing `FRONT_DESK` accounts display in the Staff directory as `STAFF`. Schema initialization converts `STAFF` only when upgrading from a role constraint that does not yet allow `FRONT_DESK`, and preserves newly created `STAFF` users afterward.

## Module access matrix

“Full” means view, create, and edit. Delete is governed separately by the global rule below.

| Module | ADMIN | DOCTOR | FRONT_DESK |
|---|---|---|---|
| Dashboard | Full | Full | Full |
| Patients | Full | View/Edit; no Create | Full |
| Appointments | Full | Full | Full |
| OPD Queue | Full | Full | No |
| IPD / Beds | Full | Full | No |
| Emergency | Full | Full | No |
| CPOE | Full | Full | No |
| Patient Forms | Full | Full | Full |
| Clinical Notes | Full | Full | No |
| Discharge Summary | Full | Full | Full |
| Laboratory | Full | Full | No |
| Radiology | Full | Full | No |
| Pharmacy | Full | Full | No |
| Nursing | Full | Full | No |
| Operation Theatre | Full | Full | No |
| Blood Bank | Full | Full | No |
| Billing | Full | No | Full |
| Revenue Cycle | Full | No | No |
| Inventory | Full | No | No |
| Analytics & MIS | Full | No | No |
| Staff Management | Full | No | No |
| Form Templates | Full | No | No |
| Audit Log | Full | No | No |
| Settings | Full | No | No |

## Action rules

- `DELETE` is allowed only for `ADMIN`, irrespective of the module.
- `DOCTOR` can search, view, open, and edit patient records, but cannot create/register a patient.
- `FRONT_DESK` can create, view, and edit patients.
- `DOCTOR` and `FRONT_DESK` retain create/edit access for all modules their role can access.
- `FRONT_DESK` does not have access to CPOE or Clinical Notes, but retains access to Patient Forms and Discharge Summary.
- `DOCTOR` does not have access to Inventory or Analytics & MIS.
- The current API has no record `DELETE` endpoints. The global backend guard is in place for any `DELETE` request added now or later. Appointment cancellation and IPD discharge remain workflow state changes, not record deletion.

## Frontend visibility and route behavior

The central frontend policy is [frontend/lib/permissions.ts](frontend/lib/permissions.ts). The sidebar, dashboard module launcher/cards, patient-create action, Settings profile menu, and protected app route guard all use its role/module/action helpers. Unauthorized modules and links are filtered out; manually opening an unauthorized module route redirects to the dashboard without rendering the page content.

`DOCTOR` sees the patient list and patient edit action, but not the Add Patient action or `/patients/new`. `ADMIN` and `FRONT_DESK` see the create action. `FRONT_DESK` cannot access `/cpoe` or `/clinical-notes`, but can access `/forms` and `/discharge`; `DOCTOR` cannot access `/inventory` or `/analytics`. There are no current record-delete buttons or record-delete API routes in the implemented workflows.

The login/session architecture remains the existing JWT flow. The user role is already part of the authenticated user payload and is now normalized centrally for authorization/display; no second authentication mechanism was added.

## Backend authorization

[backend/src/permissions.js](backend/src/permissions.js) defines the backend module grants and action rule. [backend/src/auth.js](backend/src/auth.js) provides `requirePermission` and preserves `requireRole`; route handlers invoke authorization after `requireAuth`, so unauthenticated requests continue to receive `401` and authenticated forbidden requests receive `403`.

Current implemented API routes are guarded for their owning workflows: patients/doctors, appointments, CPOE, patient forms, discharge, IPD, and emergency. Form-template reads are permitted through the Patient Forms grant because the existing Patient Forms UI consumes those template-list/file endpoints; there is no separate template-management API today. Placeholder modules without APIs have no backend data routes to authorize yet.

The global `DELETE` middleware authenticates every delete request and rejects non-admin users before route handling. `/api/admin/check` continues to use the existing admin-role middleware.

## Database and seed behavior

No role column was added. The existing `users.role` column is retained and its constraint supports `ADMIN`, `DOCTOR`, `FRONT_DESK`, and `STAFF`. The linked `staff_profiles` table holds staff-specific fields. The legacy role conversion runs only for databases with the older constraint; initialized databases preserve the new `STAFF` role. See [STAFF_MANAGEMENT.md](STAFF_MANAGEMENT.md) for the staff profile model and APIs.

The seeded admin login is unchanged. The existing seeded staff email/password is unchanged and maps to Front Desk. A local Doctor login was added for role testing:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@swasthyasync.com` | `admin123` |
| Doctor | `doctor@swasthyasync.com` | `doctor123` |
| Front Desk | `staff@swasthyasync.com` | `staff123` |

These development credentials must not be used in production.

## Changed files

- `backend/src/permissions.js` — backend module/action policy and legacy role normalization.
- `backend/src/auth.js` — reusable permission middleware and normalized role serialization/checking.
- `backend/src/server.js` — per-route authorization and global admin-only `DELETE` enforcement.
- `backend/src/schema.sql` — role constraint migration and legacy `STAFF` mapping.
- `backend/src/seed.js` — preserved Admin and Front Desk seed credentials; added Doctor account.
- `backend/tests/permissions.test.js` — role/action matrix tests.
- `backend/src/staff.js` and `backend/src/staff-options.js` — Admin-protected staff endpoints, validation, and centralized options.
- `backend/tests/staff.test.js` — validation, role separation, filtering, and response-redaction tests.
- `backend/package.json` — `npm test` script.
- `backend/README.md` — local role seed credentials and migration note.
- `frontend/lib/permissions.ts` — central UI role/module/action and route policy.
- `frontend/types/auth.ts` — canonical role typing with legacy compatibility.
- `frontend/lib/nav.ts`, `frontend/components/layout/Sidebar.tsx` — permission-filtered navigation.
- `frontend/lib/dashboard/dashboardData.ts`, `frontend/app/(app)/dashboard/page.tsx` — module launcher and module-linked dashboard widget filtering.
- `frontend/components/shared/RouteGuard.tsx` — direct-route redirect using the shared policy.
- `frontend/app/(app)/patients/page.tsx` — role-checked Add Patient action.
- `frontend/components/layout/Topbar.tsx` — normalized role labels and Settings-link visibility.
- `frontend/lib/staff.ts`, `frontend/app/(app)/staff/page.tsx`, and `frontend/app/(app)/staff/page.module.css` — staff API client and PostgreSQL-backed directory UI.
- `STAFF_MANAGEMENT.md` — staff model, role compatibility, options, APIs, and testing notes.

## How to test

From the repository root:

```powershell
cd backend
npm run seed
npm test
npm run dev
```

In another terminal, start the frontend with `cd frontend; npm run dev`, then sign in with each development account listed above. Verify module visibility using the matrix. Specifically check that Doctor cannot see Add Patient and is redirected from `/patients/new`, `/inventory`, and `/analytics`; Front Desk cannot see CPOE, Clinical Notes, OPD Queue, IPD, Emergency, diagnostics, care-department, revenue-cycle, or administration modules, but can access Patient Forms, Discharge Summary, and Billing; and Admin retains all current sidebar modules.

Backend checks performed during implementation:

```powershell
cd backend
npm test
```

The HTTP probes used the seeded logins and verified:

- all three accounts can log in and receive their canonical role
- Doctor patient `POST` returns `403`
- Front Desk patient `POST` reaches input validation (`400` with an empty body), proving it is not blocked by RBAC
- Front Desk `GET /api/ipd/beds` returns `403`; Doctor and Admin receive `200`
- Doctor and Front Desk `DELETE` requests return `403`; Admin passes the delete guard and receives `404` because no matching delete route currently exists
- unauthenticated protected API requests still return `401`

Frontend verification performed:

```powershell
cd frontend
npx eslint lib/permissions.ts types/auth.ts lib/nav.ts components/layout/Sidebar.tsx components/shared/RouteGuard.tsx 'app/(app)/patients/page.tsx' components/layout/Topbar.tsx lib/dashboard/dashboardData.ts 'app/(app)/dashboard/page.tsx'
npx tsc --noEmit
npm run build
```

The backend test command now includes Staff Management validation/security tests. Next.js may emit the existing workspace-root warning because both the repository root and frontend contain lockfiles.
