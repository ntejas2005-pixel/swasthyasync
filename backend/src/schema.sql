CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS hospitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'DOCTOR', 'FRONT_DESK', 'STAFF')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'users'::regclass
      AND conname = 'users_role_check'
      AND pg_get_constraintdef(oid) NOT LIKE '%FRONT_DESK%'
  ) THEN
    UPDATE users SET role = 'FRONT_DESK' WHERE role = 'STAFF';
  END IF;
END $$;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('ADMIN', 'DOCTOR', 'FRONT_DESK', 'STAFF'));

CREATE INDEX IF NOT EXISTS users_hospital_id_idx ON users(hospital_id);

CREATE TABLE IF NOT EXISTS staff_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  source_key TEXT,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'DOCTOR', 'STAFF')),
  staff_id TEXT UNIQUE,
  phone TEXT,
  designation TEXT,
  department TEXT,
  seniority TEXT,
  qualification TEXT,
  date_of_joining DATE,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE;
ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS source_key TEXT;
ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE';

UPDATE staff_profiles p
SET id = COALESCE(p.id, gen_random_uuid()),
    hospital_id = COALESCE(p.hospital_id, u.hospital_id),
    full_name = COALESCE(p.full_name, u.name),
    role = CASE WHEN u.role IN ('FRONT_DESK', 'STAFF') THEN 'STAFF' ELSE u.role END,
    status = CASE WHEN u.active THEN 'ACTIVE' ELSE 'SUSPENDED' END
FROM users u
WHERE p.user_id = u.id
  AND (p.id IS NULL OR p.hospital_id IS NULL OR p.full_name IS NULL OR p.role IS NULL OR p.status IS NULL);

UPDATE staff_profiles SET id = gen_random_uuid() WHERE id IS NULL;

DO $$
DECLARE
  primary_key_name TEXT;
BEGIN
  SELECT conname INTO primary_key_name
  FROM pg_constraint
  WHERE conrelid = 'staff_profiles'::regclass AND contype = 'p';
  IF primary_key_name IS NOT NULL
     AND pg_get_constraintdef((SELECT oid FROM pg_constraint WHERE conrelid = 'staff_profiles'::regclass AND conname = primary_key_name)) <> 'PRIMARY KEY (id)' THEN
    EXECUTE format('ALTER TABLE staff_profiles DROP CONSTRAINT %I', primary_key_name);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'staff_profiles'::regclass AND contype = 'p'
      AND pg_get_constraintdef(oid) = 'PRIMARY KEY (id)'
  ) THEN
    ALTER TABLE staff_profiles ADD CONSTRAINT staff_profiles_pkey PRIMARY KEY (id);
  END IF;
END $$;

ALTER TABLE staff_profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE staff_profiles ALTER COLUMN id SET NOT NULL;
ALTER TABLE staff_profiles ALTER COLUMN hospital_id SET NOT NULL;
ALTER TABLE staff_profiles ALTER COLUMN full_name SET NOT NULL;
ALTER TABLE staff_profiles ALTER COLUMN role SET NOT NULL;
ALTER TABLE staff_profiles ALTER COLUMN status SET DEFAULT 'ACTIVE';
ALTER TABLE staff_profiles ALTER COLUMN status SET NOT NULL;
ALTER TABLE staff_profiles ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE staff_profiles ALTER COLUMN staff_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'staff_profiles'::regclass AND conname = 'staff_profiles_role_check') THEN
    ALTER TABLE staff_profiles ADD CONSTRAINT staff_profiles_role_check CHECK (role IN ('ADMIN', 'DOCTOR', 'STAFF'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'staff_profiles'::regclass AND conname = 'staff_profiles_status_check') THEN
    ALTER TABLE staff_profiles ADD CONSTRAINT staff_profiles_status_check CHECK (status IN ('ACTIVE', 'SUSPENDED'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'staff_profiles'::regclass AND conname = 'staff_profiles_user_id_fkey' AND confdeltype = 'n') THEN
    ALTER TABLE staff_profiles DROP CONSTRAINT IF EXISTS staff_profiles_user_id_fkey;
    ALTER TABLE staff_profiles ADD CONSTRAINT staff_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS staff_profiles_user_id_unique_idx ON staff_profiles(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS staff_profiles_source_key_unique_idx ON staff_profiles(source_key);
CREATE INDEX IF NOT EXISTS staff_profiles_hospital_role_idx ON staff_profiles(hospital_id, role);

CREATE INDEX IF NOT EXISTS staff_profiles_designation_idx ON staff_profiles(designation);
CREATE INDEX IF NOT EXISTS staff_profiles_department_idx ON staff_profiles(department);

INSERT INTO staff_profiles (user_id, hospital_id, full_name, role, staff_id, status)
SELECT id, hospital_id, name,
  CASE WHEN role IN ('FRONT_DESK', 'STAFF') THEN 'STAFF' ELSE role END,
  'USR-' || upper(replace(id::text, '-', '')),
  CASE WHEN active THEN 'ACTIVE' ELSE 'SUSPENDED' END
FROM users
ON CONFLICT DO NOTHING;

CREATE SEQUENCE IF NOT EXISTS patient_uhid_seq START 1001;

CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  uhid TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  admission_type TEXT NOT NULL CHECK (admission_type IN ('OPD', 'IPD', 'Emergency', 'Day Care', 'ICU')),
  age INTEGER NOT NULL CHECK (age >= 0 AND age <= 130),
  date_of_birth DATE,
  gender TEXT NOT NULL CHECK (gender IN ('Male', 'Female', 'Other', 'Prefer not to say')),
  blood_group TEXT CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown')),
  mobile TEXT NOT NULL,
  aadhaar TEXT,
  abha_id TEXT,
  address TEXT,
  guardian_name TEXT,
  guardian_relation TEXT,
  guardian_phone TEXT,
  department TEXT NOT NULL,
  attending_doctor_id TEXT NOT NULL,
  initial_status TEXT NOT NULL CHECK (initial_status IN ('Stable', 'Critical', 'Recovering', 'Under Obs', 'Serious')),
  patient_category TEXT NOT NULL CHECK (patient_category IN ('General', 'BPL', 'Senior Citizen', 'Divyangjan', 'VIP', 'Staff')),
  mlc_type TEXT NOT NULL CHECK (mlc_type IN ('None', 'Road Traffic Accident', 'Assault', 'Poisoning', 'Burns', 'Sexual Assault', 'Suicide Attempt', 'Industrial Accident', 'Other MLC')),
  chief_complaint TEXT,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('Self Pay', 'Cash', 'UPI', 'Insurance / TPA', 'CGHS', 'ECHS', 'ESI', 'Ayushman Bharat', 'Govt / Free')),
  insurance_company TEXT,
  tpa_name TEXT,
  policy_member_id TEXT,
  policy_validity DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS patients_hospital_id_idx ON patients(hospital_id);
CREATE INDEX IF NOT EXISTS patients_uhid_idx ON patients(uhid);
CREATE INDEX IF NOT EXISTS patients_name_idx ON patients USING gin(to_tsvector('simple', full_name));

CREATE TABLE IF NOT EXISTS emergency_encounters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  triage_level TEXT NOT NULL CHECK (triage_level IN ('Red', 'Orange', 'Yellow', 'Green')),
  status TEXT NOT NULL DEFAULT 'Waiting' CHECK (status IN ('Waiting', 'In Treatment', 'Transferred', 'Discharged')),
  arrival_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  complaint TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS emergency_hospital_queue_idx ON emergency_encounters(hospital_id, arrival_time);
CREATE INDEX IF NOT EXISTS emergency_patient_active_idx ON emergency_encounters(patient_id) WHERE status <> 'Discharged';

CREATE SEQUENCE IF NOT EXISTS cpoe_order_number_seq START 1001;

CREATE TABLE IF NOT EXISTS cpoe_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  ordered_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  order_category TEXT NOT NULL CHECK (order_category IN ('Laboratory', 'Radiology', 'Medication', 'Procedure', 'Other')),
  order_item TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'ROUTINE' CHECK (priority IN ('STAT', 'URGENT', 'ROUTINE')),
  clinical_instructions TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'ORDERED' CHECK (status IN ('ORDERED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  ordered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cpoe_hospital_order_idx ON cpoe_orders(hospital_id, ordered_at DESC);
CREATE INDEX IF NOT EXISTS cpoe_patient_order_idx ON cpoe_orders(patient_id, ordered_at DESC);

CREATE SEQUENCE IF NOT EXISTS ipd_admission_number_seq START 1001;

CREATE TABLE IF NOT EXISTS beds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  bed_number TEXT NOT NULL,
  ward TEXT NOT NULL,
  room TEXT,
  status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'OCCUPIED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (hospital_id, bed_number)
);

CREATE TABLE IF NOT EXISTS ipd_admissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_number TEXT NOT NULL UNIQUE,
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  bed_id UUID NOT NULL REFERENCES beds(id) ON DELETE RESTRICT,
  admission_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'ADMITTED' CHECK (status IN ('ADMITTED', 'DISCHARGED')),
  discharged_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ipd_active_bed_unique_idx ON ipd_admissions(bed_id) WHERE status = 'ADMITTED';
CREATE UNIQUE INDEX IF NOT EXISTS ipd_active_patient_unique_idx ON ipd_admissions(patient_id) WHERE status = 'ADMITTED';
CREATE INDEX IF NOT EXISTS beds_hospital_status_idx ON beds(hospital_id, status);
CREATE INDEX IF NOT EXISTS ipd_hospital_status_idx ON ipd_admissions(hospital_id, status);

CREATE SEQUENCE IF NOT EXISTS appointment_number_seq START 1001;

CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_number TEXT NOT NULL UNIQUE,
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  doctor_id TEXT NOT NULL,
  department TEXT NOT NULL,
  appointment_date DATE NOT NULL,
  slot_time TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED')),
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS appointments_hospital_date_idx ON appointments(hospital_id, appointment_date);
CREATE INDEX IF NOT EXISTS appointments_patient_idx ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS appointments_doctor_date_idx ON appointments(doctor_id, appointment_date);
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_hospital_id_doctor_id_appointment_date_slot_ti_key;
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_hospital_id_doctor_id_appointment_date_slot_time_key;
CREATE UNIQUE INDEX IF NOT EXISTS appointments_active_slot_unique_idx ON appointments(hospital_id, doctor_id, appointment_date, slot_time) WHERE status <> 'CANCELLED';

CREATE TABLE IF NOT EXISTS form_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  original_filename TEXT NOT NULL,
  file_path TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS form_templates_category_idx ON form_templates(category, subcategory);
CREATE INDEX IF NOT EXISTS form_templates_name_idx ON form_templates USING gin(to_tsvector('simple', name));

CREATE TABLE IF NOT EXISTS patient_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  template_id UUID NOT NULL REFERENCES form_templates(id) ON DELETE RESTRICT,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'COMPLETED')),
  field_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS patient_forms_patient_idx ON patient_forms(patient_id, created_at DESC);

CREATE TABLE IF NOT EXISTS discharge_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_template_id UUID NOT NULL UNIQUE REFERENCES form_templates(id) ON DELETE CASCADE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS discharge_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  admission_id UUID NOT NULL REFERENCES ipd_admissions(id) ON DELETE RESTRICT,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'COMPLETED')),
  diagnosis TEXT,
  clinical_summary TEXT,
  treatment_procedure TEXT,
  discharge_condition TEXT,
  discharge_instructions TEXT,
  follow_up TEXT,
  consultant TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (admission_id)
);

CREATE INDEX IF NOT EXISTS discharge_summaries_hospital_idx ON discharge_summaries(hospital_id, updated_at DESC);
