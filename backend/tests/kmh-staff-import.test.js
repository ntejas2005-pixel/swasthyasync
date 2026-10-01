const test = require("node:test");
const assert = require("node:assert/strict");
const rows = require("../src/kmh-staff-data.json");
const { roleForDesignation, buildImportReport } = require("../src/kmh-staff-import");

test("KMH fixture has all validated source rows and no duplicate/missing staff IDs", () => {
  const report = buildImportReport();
  assert.equal(rows.length, 116);
  assert.equal(report.populatedRecords, 116);
  assert.equal(report.validRecords, 116);
  assert.equal(report.skippedRecords, 0);
  assert.deepEqual(report.duplicateStaffIds, []);
  assert.equal(report.missingStaffIds, 0);
  assert.equal(report.missingNames, 0);
  assert.equal(report.missingDesignations, 1);
  assert.equal(report.missingDates, 4);
  assert.equal(report.invalidDates.length, 0);
  assert.equal(report.missingQualifications, 7);
});

test("KMH source designations map deterministically to the three broad system roles", () => {
  const report = buildImportReport();
  assert.deepEqual(report.roleCounts, { ADMIN: 0, DOCTOR: 16, STAFF: 100 });
  assert.equal(roleForDesignation("Dentist"), "DOCTOR");
  assert.equal(roleForDesignation("GYNAECOLOGY"), "DOCTOR");
  assert.equal(roleForDesignation("Lab Technician"), "STAFF");
  assert.equal(roleForDesignation("ADMINISTRATOR"), "STAFF");
});

test("KMH source values preserve missing data as null and preserve designations", () => {
  const blankQualification = rows.find((row) => row.staffId === "KCH0791");
  const blankDesignation = rows.find((row) => row.staffId === "KCH0684");
  const blankDate = rows.find((row) => row.staffId === "KCH0758");
  assert.equal(blankQualification.qualification, null);
  assert.equal(blankDesignation.designation, null);
  assert.equal(blankDate.dateOfJoining, null);
  assert.equal(rows.find((row) => row.staffId === "KCH0831").designation, "SR STAFF NURSE");
});
