const test = require("node:test");
const assert = require("node:assert/strict");
const { MODULE_ROLES, canAccess, normalizeRole } = require("../src/permissions");

test("role module matrix matches the configured grants", () => {
  for (const [module, roles] of Object.entries(MODULE_ROLES)) {
    for (const role of ["ADMIN", "DOCTOR", "FRONT_DESK"]) {
      assert.equal(canAccess(role, module, "view"), roles.includes(role), `${role} access to ${module}`);
    }
  }
});

test("ADMIN can use create, edit, and delete actions", () => {
  for (const module of Object.keys(MODULE_ROLES)) {
    for (const action of ["view", "create", "edit", "delete"]) {
      assert.equal(canAccess("ADMIN", module, action), true, `ADMIN ${action} on ${module}`);
    }
  }
});

test("DOCTOR can edit patients but cannot create them or delete records", () => {
  assert.equal(canAccess("DOCTOR", "patients", "view"), true);
  assert.equal(canAccess("DOCTOR", "patients", "edit"), true);
  assert.equal(canAccess("DOCTOR", "patients", "create"), false);
  assert.equal(canAccess("DOCTOR", "laboratory", "create"), true);
  assert.equal(canAccess("DOCTOR", "laboratory", "edit"), true);
  assert.equal(canAccess("DOCTOR", "laboratory", "delete"), false);
});

test("FRONT_DESK has patients, appointments, patient forms, discharge, and billing without deletes", () => {
  for (const module of ["patients", "appointments", "patient_forms", "discharge", "billing"]) {
    assert.equal(canAccess("FRONT_DESK", module, "create"), true, `FRONT_DESK create on ${module}`);
    assert.equal(canAccess("FRONT_DESK", module, "edit"), true, `FRONT_DESK edit on ${module}`);
    assert.equal(canAccess("FRONT_DESK", module, "delete"), false, `FRONT_DESK delete on ${module}`);
  }
  for (const module of ["opd_queue", "ipd", "emergency", "cpoe", "clinical_notes", "laboratory", "radiology", "pharmacy", "inventory", "analytics", "revenue_cycle", "settings"]) {
    assert.equal(canAccess("FRONT_DESK", module, "view"), false, `FRONT_DESK access to ${module}`);
  }
});

test("DOCTOR can access clinical and diagnostic modules but not Operations", () => {
  for (const module of ["laboratory", "radiology", "pharmacy", "nursing", "patient_forms", "clinical_notes"]) {
    assert.equal(canAccess("DOCTOR", module, "view"), true, `DOCTOR access to ${module}`);
  }
  for (const module of ["inventory", "analytics"]) {
    assert.equal(canAccess("DOCTOR", module, "view"), false, `DOCTOR access to ${module}`);
  }
});

test("legacy STAFF role resolves to FRONT_DESK", () => {
  assert.equal(normalizeRole("STAFF"), "FRONT_DESK");
  assert.equal(canAccess("STAFF", "billing", "view"), true);
  assert.equal(canAccess("STAFF", "ipd", "view"), false);
});