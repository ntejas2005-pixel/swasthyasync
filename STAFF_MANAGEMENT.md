# Staff Management

## Scope and terminology

Staff Management is an Admin-only directory for login accounts and linked hospital staff information. It uses the existing `users` authentication model and JWT login; it does not create a separate authentication system.

The Staff Management profile displays three broad hospital roles:

- `ADMIN`
- `DOCTOR`
- `STAFF`

These are not designations. A `DOCTOR` account can have a designation such as `DUTY DOCTOR`, `PEDIATRICIAN`, or `RADIOLOGIST`; a `STAFF` account can have `STAFF NURSE`, `Lab Technician`, or `PHARMACIST`. Department, seniority, and qualification are separate fields.

### Existing Front Desk compatibility

The wider application still has the `FRONT_DESK` RBAC category. Existing Front Desk users and login credentials remain unchanged. In Staff Management, a stored `FRONT_DESK` account is presented in the broad `STAFF` category. A newly created `STAFF` account stores `STAFF` in `users.role`; the existing backend/frontend role normalizers map that role to the established Front Desk permission behavior. The Staff Management APIs themselves require the existing Admin-only `staff_management` permission.

The schema migration converts `STAFF` rows to `FRONT_DESK` only when upgrading from the old role constraint that does not yet allow `FRONT_DESK`. It does not repeat that conversion after the expanded constraint is installed.

## Data model

### Authentication account

The existing `users` table remains the login source of truth:

- `id`, `hospital_id`, `name`, `email`, `password_hash`, `role`, `active`, timestamps
- `email` is the login ID and remains unique under the existing global unique constraint.
- Passwords are hashed with the existing bcrypt mechanism; Staff API responses serialize explicit public fields and never include `password_hash`.
- `active = TRUE` corresponds to `ACTIVE`; `active = FALSE` corresponds to `SUSPENDED`. Login rejects inactive accounts, and `requireAuth` checks the current database account state for each authenticated request.

### Staff profile

`staff_profiles` is the directory source of truth. Each profile has a UUID primary key and may be linked one-to-one to `users.id`; `user_id` is nullable and unique when present. It stores:

- `hospital_id`, `full_name`, broad `role`, and `status`
- `staff_id` (unique when present)
- optional `phone`, `designation`, `department`
- optional `seniority`
- optional `qualification` and `date_of_joining`
- `source_key` for idempotent spreadsheet imports
- profile timestamps

Existing user accounts are not deleted or recreated. Schema initialization backfills profile rows for existing accounts and makes the account link nullable. Imported profiles without logins remain independently listable and editable. Existing clinical workflow foreign keys still restrict deletion of referenced users. No staff delete API is provided.

## Reference data

`KMH STAFF.xls` was inspected and all 116 populated records were imported to PostgreSQL from the static fixture [backend/src/kmh-staff-data.json](backend/src/kmh-staff-data.json). Its columns are `S.N.`, `Staff Name`, `Date of Joining`, `Staff ID`, `Designation`, and `Qualification`. It contains no department, phone, email/login ID, seniority, or system role. Those absent values remain null on imported profiles. The workbook is not read by the application or seed at runtime; PostgreSQL is the runtime source of truth.

Supported designation options are centralized in `backend/src/staff-options.js` and derived from the spreadsheet terminology, with whitespace/case variants normalized. They include `INCHARGE WARD`, `SR STAFF NURSE`, `STAFF NURSE`, `EXECUTIVE`, `LAB TECH`, `DENTIST`, `PEDIATRICIAN`, `DUTY DOCTOR`, `PHARMACIST`, `SUPERVISOR`, `PATIENT CORDINATOR`, `JR PHARMACIST`, `NURSING SUPERINTENDENT`, `RMO`, `TR STAFF NURSE`, `JR ACCOUNTANT`, `ADMINISTRATOR`, `WARD INCHARGE`, `AT TECH`, `NURSE AIDE`, `SR EXECUTIVE`, `JR. RADIOGRAPHER`, `RESIDENTS`, `IT SYSTEM ADMIN`, `RESIDENT`, `JR RADIOGRAPHER`, `ORTHPEDICIAN`, `Manager Marketing`, `MRD INCHARGE`, `Lab Technician`, `BIOMEDICAL ENGINEER`, `Sr Exe-Insurance & Billing`, `RADIOGRAPHER`, `GYNAECOLOGY`, `BILLING EXECUTIVE`, `MANAGER-BILLING`, `Incharge OP Billing`, `MAINTENANCE SUPERVISOR`, `MARKETING EXECUTIVE`, `SCRUB NURSE`, `Asst. Manager`, `TECHNICIAN`, `INCHARGE-LAB TECH`, `Dietitian`, `Sr-Executive IP`, `security guard`, `Incharge-Radiography`, `ICU-STAFF NURSE`, `GENERAL PHYSICIAN`, `RADIOLOGIST`, `Incharge-OPD`, `NURSING AIDE`, `OT TECHNICIAN`, `BUSINESS DEVELOPMENT MANAGER`, `STORE ASSISTANT`, `Sr. Executive`, `PHARMACY In-Charge`, `ASSISTANT MANAGER - ACCOUNTS`, and `PHARMA AIDE`.

The workbook has no departments. Imported departments are null; none are inferred from designation. Options combine the centralized application department list in `backend/src/staff-options.js` with actual non-null departments already stored in PostgreSQL. Likewise, designation options include the distinct values in the imported profiles, preserving source spelling/case/punctuation.

Seniority is optional and imported as null because the source has no seniority column. Qualification is separate text and the source values are preserved, including blanks as null.

## Frontend

The `/staff` route is in `frontend/app/(app)/staff/page.tsx`. It uses the existing authenticated AppShell and route guard; central RBAC keeps the route Admin-only. The page includes:

- PostgreSQL-backed Doctors, Staff, and Admin counts
- an `All Staff` role option plus Doctors, Staff, and Admin filters
- search across name, Staff ID, email/login ID, and phone
- server-backed role, designation, department, and status filters
- staff table with role/status badges and staff information
- `Login: Not created` for unlinked source profiles and a row-level Create Staff Login action
- create-login and edit forms in the existing Drawer component
- status actions that suspend or reactivate an account
- loading, error/retry, empty, and no-match states
- responsive filters and a horizontally scrollable table container

The frontend API client is `frontend/lib/staff.ts`; it uses the existing `apiRequest` wrapper and Bearer token.

## Backend API

Routes are implemented in `backend/src/staff.js`, mounted by `backend/src/server.js`, and use the existing `requireAuth` and `requirePermission` middleware. The central backend policy already restricts `staff_management` to `ADMIN`.

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/staff/options` | Return supported broad roles, statuses, seniorities, departments, and designations. |
| `GET` | `/api/staff` | List all hospital profiles with dynamic role counts and optional `q`, `role`, `designation`, `department`, and `status` filters. |
| `GET` | `/api/staff/:id` | Read one profile by profile ID, whether or not it has a user account. |
| `POST` | `/api/staff` | Validate and create a user account plus staff profile transactionally; bcrypt hashes the password before insert. |
| `POST` | `/api/staff/:id/login` | Create an account for an existing login-less profile and link it without creating a duplicate profile. |
| `PUT` | `/api/staff/:id` | Edit profile data and linked account identity/role, if an account exists. Does not accept/change a password. |
| `PATCH` | `/api/staff/:id/status` | Set profile status; if linked, also updates `users.active` so auth immediately respects suspension. |

The staff list is scoped to the authenticated Admin’s hospital and includes profiles without users. SQL values are parameterized; role, email, phone, password, and dates are validated. Duplicate email or Staff ID returns `409`. A hospital cannot suspend or demote its last active Admin. No hard-delete endpoint is present.

Email is the login ID to preserve the existing login architecture; the API returns `loginId` as an alias of email when linked, otherwise null. New accounts authenticate through `/api/auth/login` and existing JWT/session code.

## Development seed accounts

`backend/src/seed.js` preserves existing Admin, Doctor, and Front Desk credentials, retains the two reference Staff login accounts, and imports the static KMH fixture. The Neethu Chacko profile matches source row `KCH0831` by exact name, designation, and qualification; that existing login is retained while its demo Staff ID/date and demo department are replaced by source values/null. The Lab Technician demo remains separate because no matching Asha Menon row exists in the workbook.

| Existing development login/profile | Role | Designation | Qualification | Local login |
|---|---|---|---|---|
| Asha Menon (sample, not in source sheet) | STAFF | Lab Technician | DMLT | `lab.tech@swasthyasync.com` / `labstaff123` |
| Neethu Chacko (matched to source Staff ID KCH0831) | STAFF | SR STAFF NURSE | BSC Nursing | `nurse.staff@swasthyasync.com` / `nursestaff123` |

These are development credentials only. The other 115 Excel profiles have no login, email, phone, department, or seniority and are not assigned fake values. The Excel file is not a runtime or seed-time dependency; the seed uses the checked-in static fixture.

### Import report

| Check | Result |
|---|---:|
| Worksheet dimensions | `STAFF`, 240 rows × 6 columns |
| Populated / valid records | 116 / 116 |
| Imported / skipped | 116 / 0 |
| Duplicate / missing Staff IDs | 0 / 0 |
| Missing names | 0 |
| Missing designations | 1 |
| Missing joining dates / invalid dates | 4 / 0 |
| Missing qualifications | 7 |
| Mapped roles | DOCTOR 16, STAFF 100, ADMIN 0 |
| Final profile count | 120 |
| Final role counts | ADMIN 1, DOCTOR 17, STAFF 102 |
| Profiles without login | 115 |

The final count is five pre-existing profiles plus 116 workbook records, less one matched/merged Nurse profile. The separate sample Lab Technician login remains.

The doctor mapping is the exact normalized designation allowlist in `backend/src/kmh-staff-import.js`: `DENTIST`, `PEDIATRICIAN`, `DUTY DOCTOR`, `RMO`, `RESIDENTS`, `RESIDENT`, `ORTHPEDICIAN`, `GENERAL PHYSICIAN`, `RADIOLOGIST`, and `GYNAECOLOGY`. Every other designation, including `ADMINISTRATOR` and `IT SYSTEM ADMIN`, maps to `STAFF`; titles never grant system Admin access.

Import records use `KMH-STAFF:<Staff ID>` as an idempotent source key. Repeated `npm run seed` updates imported/source-owned fields without duplicating rows; profile status and manually assigned department, phone, and seniority are preserved after import. Duplicate IDs or invalid name/ID/date records stop the import instead of silently overwriting data.

## Validation performed

- Backend RBAC, staff API, and KMH source validation tests pass with `npm test` from `backend`.
- `npm run seed` was executed twice; the second run inserted zero records, updated all 116 source profiles, and kept the final count at 120.
- Live PostgreSQL/HTTP checks covered Admin-only access, existing account logins, all filters/statistics, profile login linking, editing, suspension/activation, password-field redaction, and rejection of non-Admin Staff API requests.
- Frontend lint, TypeScript, and production build are checked as part of the implementation report. The repository currently has an unrelated existing full-lint error in the Emergency page; the Staff page/API client are linted separately.
