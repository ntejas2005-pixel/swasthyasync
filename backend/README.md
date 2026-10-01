# SwasthyaSync local API

Copy `.env.example` to `.env`, set `DATABASE_URL` and a private `JWT_SECRET`, then install and run:

```powershell
npm install
npm run seed
npm run dev
```

The API listens on `http://localhost:5000`. Development seed credentials:

- Admin: `admin@swasthyasync.com` / `admin123`
- Doctor: `doctor@swasthyasync.com` / `doctor123`
- Front Desk: `staff@swasthyasync.com` / `staff123`
- Sample Staff Nurse: `nurse.staff@swasthyasync.com` / `nursestaff123`
- Sample Lab Technician: `lab.tech@swasthyasync.com` / `labstaff123`

These credentials are for local development only.

The legacy seeded Front Desk account keeps its email and password and is stored with the `FRONT_DESK` role. Staff Management maps that profile to the broad directory role `STAFF` while preserving the app's existing Front Desk RBAC compatibility.

`npm run seed` imports all 116 KMH staff records from the checked-in static fixture `src/kmh-staff-data.json`; it does not read the Excel file at runtime. The spreadsheet itself is never a runtime dependency. Imported profiles do not receive invented emails, phone numbers, departments, seniority, or passwords. One source row matching the seeded Neethu Chacko profile is linked to that existing development login; other imported profiles remain login-less until an Admin uses Create Staff Login.

The seed prints an import report with source quality, role counts, inserted/updated counts, and final database profile counts. Import is idempotent by Staff ID; duplicate IDs or invalid identity/date rows stop rather than overwrite another record. Doctors are determined by the exact designation allowlist in `src/kmh-staff-import.js`; other designations, including `ADMINISTRATOR`, map to `STAFF`.
