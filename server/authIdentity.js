export function buildAuthEmail(role, schoolNo) {
  const safeRole = String(role || "").trim().toLowerCase();
  const safeSchoolNo = String(schoolNo || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "_");
  return `${safeRole}.${safeSchoolNo}@oex.local`;
}
