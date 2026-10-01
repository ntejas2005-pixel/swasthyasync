const MODULE_ROLES = {
  dashboard: ["ADMIN", "DOCTOR", "FRONT_DESK"],
  patients: ["ADMIN", "DOCTOR", "FRONT_DESK"],
  appointments: ["ADMIN", "DOCTOR", "FRONT_DESK"],
  opd_queue: ["ADMIN", "DOCTOR"],
  ipd: ["ADMIN", "DOCTOR"],
  emergency: ["ADMIN", "DOCTOR"],
  cpoe: ["ADMIN", "DOCTOR"],
  patient_forms: ["ADMIN", "DOCTOR", "FRONT_DESK"],
  clinical_notes: ["ADMIN", "DOCTOR"],
  discharge: ["ADMIN", "DOCTOR", "FRONT_DESK"],
  laboratory: ["ADMIN", "DOCTOR"],
  radiology: ["ADMIN", "DOCTOR"],
  pharmacy: ["ADMIN", "DOCTOR"],
  nursing: ["ADMIN", "DOCTOR"],
  operation_theatre: ["ADMIN", "DOCTOR"],
  blood_bank: ["ADMIN", "DOCTOR"],
  billing: ["ADMIN", "FRONT_DESK"],
  revenue_cycle: ["ADMIN"],
  inventory: ["ADMIN"],
  analytics: ["ADMIN"],
  staff_management: ["ADMIN"],
  form_templates: ["ADMIN"],
  audit_log: ["ADMIN"],
  settings: ["ADMIN"],
};

function normalizeRole(role) {
  const normalized = String(role || "").toUpperCase();
  return normalized === "STAFF" ? "FRONT_DESK" : normalized;
}

function canAccess(role, module, action = "view") {
  const normalizedRole = normalizeRole(role);
  if (!["view", "create", "edit", "delete"].includes(action)) return false;
  if (action === "delete") return normalizedRole === "ADMIN";
  if (normalizedRole === "ADMIN") return true;
  if (!MODULE_ROLES[module]?.includes(normalizedRole)) return false;
  if (module === "patients" && action === "create" && normalizedRole === "DOCTOR") return false;
  return true;
}

module.exports = { MODULE_ROLES, normalizeRole, canAccess };