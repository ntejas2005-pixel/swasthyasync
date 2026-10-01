require("dotenv").config();

const bcrypt = require("bcrypt");
const { pool, query, initializeDatabase } = require("./db");
const { importKmhStaff } = require("./kmh-staff-import");

async function seed() {
  await initializeDatabase();
  const assignedHospital = await query(
    "SELECT hospital_id AS id FROM users WHERE email = $1 LIMIT 1",
    ["admin@swasthyasync.com"]
  );
  const existingHospital = await query("SELECT id FROM hospitals WHERE name = $1 ORDER BY created_at ASC LIMIT 1", ["City General Hospital"]);
  const hospital = assignedHospital.rows[0] ?? existingHospital.rows[0] ?? (await query("INSERT INTO hospitals (name) VALUES ($1) RETURNING id", ["City General Hospital"])).rows[0];
  let hospitalId = hospital.id;

  const users = [
    { name: "Dr. Arjun Mehta", email: "admin@swasthyasync.com", password: "admin123", role: "ADMIN", staffId: "KMH-DEMO-ADMIN", department: "Administration", designation: "ADMINISTRATOR", qualification: "", dateOfJoining: "2020-01-01" },
    { name: "Dr. Kavita Rao", email: "doctor@swasthyasync.com", password: "doctor123", role: "DOCTOR", staffId: "KMH-DEMO-DOCTOR", department: "Emergency", designation: "DUTY DOCTOR", qualification: "MBBS", seniority: "Junior", dateOfJoining: "2022-05-16" },
    { name: "Priya Sharma", email: "staff@swasthyasync.com", password: "staff123", role: "FRONT_DESK", staffId: "KMH-DEMO-FRONTDESK", department: "Outpatient", designation: "EXECUTIVE", qualification: "PUC", dateOfJoining: "2023-04-03" },
    { name: "Asha Menon", email: "lab.tech@swasthyasync.com", password: "labstaff123", role: "STAFF", staffId: "KMH-DEMO-LAB-001", department: "Laboratory", designation: "Lab Technician", qualification: "DMLT", dateOfJoining: "2024-03-12" },
    { name: "Neethu Chacko", email: "nurse.staff@swasthyasync.com", password: "nursestaff123", role: "STAFF", staffId: "KMH-DEMO-NURSE-001", department: "Nursing", designation: "SR STAFF NURSE", seniority: "Senior", qualification: "BSC Nursing", dateOfJoining: "2023-08-21" },
  ];
  for (const user of users) {
    const passwordHash = await bcrypt.hash(user.password, 12);
    const savedUser = await query(
      `INSERT INTO users (hospital_id, name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role, active = TRUE
       RETURNING id`,
      [hospitalId, user.name, user.email, passwordHash, user.role]
    );
    await query(
      `INSERT INTO staff_profiles (user_id, hospital_id, full_name, role, staff_id, designation, department, seniority, qualification, date_of_joining, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'ACTIVE')
       ON CONFLICT (user_id) DO UPDATE SET staff_id = EXCLUDED.staff_id, designation = EXCLUDED.designation,
         department = EXCLUDED.department, seniority = EXCLUDED.seniority, qualification = EXCLUDED.qualification,
         date_of_joining = EXCLUDED.date_of_joining, full_name = EXCLUDED.full_name, role = EXCLUDED.role,
         hospital_id = EXCLUDED.hospital_id, updated_at = NOW()
       WHERE staff_profiles.source_key IS NULL`,
      [savedUser.rows[0].id, hospitalId, user.name, user.role === "FRONT_DESK" ? "STAFF" : user.role, user.staffId, user.designation || null, user.department || null, user.seniority || null, user.qualification || null, user.dateOfJoining]
    );
  }

  const patients = [
    ["CGH-2026-01001", "Rajesh Kumar", "IPD", 54, "1969-03-12", "Male", "B+", "9876543210", "Cardiology", "doc-001", "Critical", "General", "None", "Shortness of breath", "Insurance / TPA", "Star Health", "Medi Assist", "POL-4821", "2027-03-31"],
    ["CGH-2026-01002", "Meena Devi", "OPD", 38, "1987-08-21", "Female", "O+", "9876501234", "Gynaecology", "doc-003", "Stable", "General", "None", "Routine consultation", "UPI", null, null, null, null],
    ["CGH-2026-01003", "Aryan Singh", "Emergency", 8, "2017-11-05", "Male", "A+", "9876512345", "Paediatrics", "doc-002", "Recovering", "BPL", "Road Traffic Accident", "Minor injury after road accident", "Govt / Free", null, null, null, null],
  ];
  for (const patient of patients) {
    await query(
      `INSERT INTO patients (hospital_id, uhid, full_name, admission_type, age, date_of_birth, gender, blood_group, mobile, department, attending_doctor_id, initial_status, patient_category, mlc_type, chief_complaint, payment_type, insurance_company, tpa_name, policy_member_id, policy_validity)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
      ON CONFLICT (uhid) DO UPDATE SET hospital_id = EXCLUDED.hospital_id`,
      [hospitalId, ...patient]
    );
  }
  await query("SELECT setval('patient_uhid_seq', COALESCE((SELECT MAX(CAST(split_part(uhid, '-', 3) AS INTEGER)) FROM patients), 1000), true)");
  const beds = [
    ["GEN-01", "General Ward", "G-1"], ["GEN-02", "General Ward", "G-1"], ["GEN-03", "General Ward", "G-1"],
    ["ICU-01", "ICU", "ICU-1"], ["ICU-02", "ICU", "ICU-1"],
    ["CARD-01", "Cardiology", "C-1"], ["CARD-02", "Cardiology", "C-1"],
    ["MAT-01", "Maternity", "M-1"],
  ];
  for (const [bedNumber, ward, room] of beds) {
    await query(
      `INSERT INTO beds (hospital_id, bed_number, ward, room) VALUES ($1,$2,$3,$4)
       ON CONFLICT (hospital_id, bed_number) DO UPDATE SET ward = EXCLUDED.ward, room = EXCLUDED.room`,
      [hospitalId, bedNumber, ward, room]
    );
  }
  const importReport = await importKmhStaff(hospitalId);
  console.log("KMH staff import report:", JSON.stringify(importReport));
  console.log("Seeded local Admin, Doctor, Front Desk, and two reference-based Staff accounts.");
}

seed().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => pool.end());
