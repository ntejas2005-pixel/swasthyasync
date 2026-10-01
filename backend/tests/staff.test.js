const test = require("node:test");
const assert = require("node:assert/strict");
const { validateStaffInput, publicStaff, filtersForRequest } = require("../src/staff");

const validStaff = {
  fullName: "Asha Menon",
  staffId: "KMH-DEMO-001",
  email: "asha@example.com",
  phone: "+91 98765 43210",
  role: "STAFF",
  designation: "Lab Technician",
  department: "Laboratory",
  seniority: "Senior",
  qualification: "DMLT",
  dateOfJoining: "2024-03-12",
  password: "correct-horse-battery",
  confirmPassword: "correct-horse-battery",
};

test("staff input accepts broad roles and reference designations", () => {
  assert.equal(validateStaffInput(validStaff, { creating: true }), null);
  assert.equal(validateStaffInput({ ...validStaff, role: "DOCTOR", designation: "PEDIATRICIAN" }, { creating: true }), null);
  assert.equal(validateStaffInput({ ...validStaff, seniority: "" }, { creating: true }), null);
  assert.equal(validateStaffInput({ ...validStaff, email: "", password: undefined, confirmPassword: undefined }), null);
});

test("staff input rejects designation names used as system roles", () => {
  assert.match(validateStaffInput({ ...validStaff, role: "LAB_TECHNICIAN" }, { creating: true }), /Role must be/);
  assert.equal(validateStaffInput({ ...validStaff, designation: "Actual Source Designation" }, { creating: true }), null);
});

test("staff input validates required values, date, password length, and confirmation", () => {
  assert.match(validateStaffInput({ ...validStaff, phone: "bad phone!" }, { creating: true }), /valid phone/);
  assert.match(validateStaffInput({ ...validStaff, dateOfJoining: "2024-02-30" }, { creating: true }), /valid date/);
  assert.match(validateStaffInput({ ...validStaff, password: "short" }, { creating: true }), /at least 8/);
  assert.match(validateStaffInput({ ...validStaff, confirmPassword: "different" }, { creating: true }), /Passwords do not match/);
});

test("public staff objects omit password and support login-less profiles", () => {
  const publicRecord = publicStaff({
    profile_id: "a1b2c3d4-1234-1234-1234-123456789012",
    user_id: null,
    staff_id: "KMH-001",
    full_name: "Priya Sharma",
    email: null,
    role: "STAFF",
    status: "ACTIVE",
    account_active: null,
    password_hash: "must-not-escape",
    phone: "9876543210",
    date_of_joining: "2024-03-12",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  });
  assert.equal(publicRecord.role, "STAFF");
  assert.equal(publicRecord.loginId, null);
  assert.equal(publicRecord.userId, null);
  assert.equal(publicRecord.status, "ACTIVE");
  assert.equal(publicRecord.dateOfJoining, "2024-03-12");
  assert.equal("password" in publicRecord, false);
  assert.equal("password_hash" in publicRecord, false);
});

test("staff list filters parameterize values and filter profile roles", () => {
  const filtered = filtersForRequest({
    user: { hospital_id: "hospital-id" },
    query: { q: "Asha%", role: "STAFF", designation: "Lab Technician", department: "Laboratory", status: "ACTIVE" },
  });
  assert.equal(filtered.error, undefined);
  assert.deepEqual(filtered.values, ["hospital-id", "%Asha%%", "STAFF", "lab technician", "laboratory", true]);
  assert.match(filtered.conditions.join(" "), /p\.role = \$3/);
  assert.match(filtered.conditions.join(" "), /p\.status/);
  assert.doesNotMatch(filtered.conditions.join(" "), /Asha/);
});
