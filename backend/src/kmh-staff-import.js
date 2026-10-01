const { query } = require("./db");
const sourceRows = require("./kmh-staff-data.json");

const DOCTOR_DESIGNATIONS = new Set([
  "DENTIST",
  "PEDIATRICIAN",
  "DUTY DOCTOR",
  "RMO",
  "RESIDENTS",
  "RESIDENT",
  "ORTHPEDICIAN",
  "GENERAL PHYSICIAN",
  "RADIOLOGIST",
  "GYNAECOLOGY",
]);

const EXISTING_LOGIN_MATCHES = {
  KCH0831: "nurse.staff@swasthyasync.com",
};

function normalizedDesignation(designation) {
  return String(designation || "").trim().replace(/\s+/g, " ").toUpperCase();
}

function roleForDesignation(designation) {
  return DOCTOR_DESIGNATIONS.has(normalizedDesignation(designation)) ? "DOCTOR" : "STAFF";
}

function validDateOnly(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function buildImportReport(rows = sourceRows) {
  const ids = new Map();
  for (const row of rows) {
    if (!row.staffId) continue;
    ids.set(row.staffId, [...(ids.get(row.staffId) || []), row.sourceRow]);
  }
  const duplicates = [...ids.entries()].filter(([, sourceSheetRows]) => sourceSheetRows.length > 1)
    .map(([staffId, sourceSheetRows]) => ({ staffId, sourceSheetRows }));
  const roleCounts = { ADMIN: 0, DOCTOR: 0, STAFF: 0 };
  for (const row of rows) roleCounts[roleForDesignation(row.designation)] += 1;
  return {
    sheet: "STAFF",
    populatedRecords: rows.length,
    validRecords: rows.filter((row) => Boolean(row.fullName && row.staffId)).length,
    skippedRecords: rows.filter((row) => !row.fullName || !row.staffId).length,
    duplicateStaffIds: duplicates,
    missingStaffIds: rows.filter((row) => !row.staffId).length,
    missingNames: rows.filter((row) => !row.fullName).length,
    missingDesignations: rows.filter((row) => !row.designation).length,
    invalidDates: rows.filter((row) => row.dateOfJoining && !validDateOnly(row.dateOfJoining)).map((row) => ({ sourceRow: row.sourceRow, value: row.dateOfJoining })),
    missingDates: rows.filter((row) => !row.dateOfJoining).length,
    missingQualifications: rows.filter((row) => !row.qualification).length,
    roleCounts,
  };
}

async function importKmhStaff(hospitalId) {
  const report = buildImportReport();
  if (report.duplicateStaffIds.length) {
    throw new Error(`KMH import stopped; duplicate Staff IDs found: ${JSON.stringify(report.duplicateStaffIds)}`);
  }
  const invalidRows = sourceRows.filter((row) => !row.fullName || !row.staffId || (row.dateOfJoining && !validDateOnly(row.dateOfJoining)));
  if (invalidRows.length) {
    throw new Error(`KMH import stopped; invalid source records found at sheet rows ${invalidRows.map((row) => row.sourceRow).join(", ")}`);
  }

  let inserted = 0;
  let updated = 0;
  let mergedExistingLogins = 0;
  for (const row of sourceRows) {
    const sourceKey = `KMH-STAFF:${row.staffId}`;
    let existing = (await query("SELECT id, user_id FROM staff_profiles WHERE source_key = $1", [sourceKey])).rows[0];
    let matchedDemo = false;

    if (!existing && EXISTING_LOGIN_MATCHES[row.staffId]) {
      const matchedUser = await query("SELECT id FROM users WHERE email = $1 AND hospital_id = $2", [EXISTING_LOGIN_MATCHES[row.staffId], hospitalId]);
      if (matchedUser.rows[0]) {
        existing = (await query("SELECT id, user_id FROM staff_profiles WHERE user_id = $1", [matchedUser.rows[0].id])).rows[0];
        matchedDemo = Boolean(existing);
      }
    }

    const staffIdCollision = await query(
      "SELECT id, source_key FROM staff_profiles WHERE hospital_id = $1 AND staff_id = $2 AND ($3::text IS NULL OR source_key IS DISTINCT FROM $3) LIMIT 1",
      [hospitalId, row.staffId, existing?.source_key || sourceKey]
    );
    if (staffIdCollision.rows[0] && staffIdCollision.rows[0].id !== existing?.id) {
      throw new Error(`KMH Staff ID ${row.staffId} at sheet row ${row.sourceRow} conflicts with an existing non-import profile.`);
    }

    const values = [
      hospitalId,
      existing?.user_id || null,
      sourceKey,
      row.fullName,
      roleForDesignation(row.designation),
      row.staffId,
      row.designation,
      row.qualification,
      row.dateOfJoining,
    ];

    if (existing) {
      await query(
        `UPDATE staff_profiles SET hospital_id = $1, user_id = $2, source_key = $3,
           full_name = $4, role = $5, staff_id = $6, designation = $7,
           qualification = $8, date_of_joining = $9,
           department = CASE WHEN $10 THEN NULL ELSE department END,
           phone = CASE WHEN $10 THEN NULL ELSE phone END,
           seniority = CASE WHEN $10 THEN NULL ELSE seniority END,
           updated_at = NOW()
         WHERE id = $11`,
        [...values, matchedDemo, existing.id]
      );
      updated += 1;
      if (matchedDemo) mergedExistingLogins += 1;
    } else {
      await query(
        `INSERT INTO staff_profiles (hospital_id, user_id, source_key, full_name, role, staff_id, designation, qualification, date_of_joining)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        values
      );
      inserted += 1;
    }
  }

  const final = await query(
    `SELECT COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE role = 'ADMIN')::int AS admins,
       COUNT(*) FILTER (WHERE role = 'DOCTOR')::int AS doctors,
       COUNT(*) FILTER (WHERE role = 'STAFF')::int AS staff,
       COUNT(*) FILTER (WHERE user_id IS NULL)::int AS without_login,
       COUNT(*) FILTER (WHERE source_key LIKE 'KMH-STAFF:%')::int AS imported_profiles
     FROM staff_profiles WHERE hospital_id = $1`,
    [hospitalId]
  );

  return {
    ...report,
    importedRecords: sourceRows.length,
    insertedThisRun: inserted,
    updatedThisRun: updated,
    mergedExistingLogins,
    finalDatabaseCounts: final.rows[0],
  };
}

module.exports = { DOCTOR_DESIGNATIONS, roleForDesignation, buildImportReport, importKmhStaff };
