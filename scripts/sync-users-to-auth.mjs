import { createClient } from "@supabase/supabase-js";

function buildAuthEmail(role, schoolNo) {
  const safeRole = String(role || "").trim().toLowerCase();
  const safeSchoolNo = String(schoolNo || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "_");
  return `${safeRole}.${safeSchoolNo}@oex.local`;
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRole) {
  console.error("Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, serviceRole, { auth: { persistSession: false } });

const { data: users, error } = await supabase.from("users").select("*").order("created_at", { ascending: true });
if (error) {
  console.error("Load users failed:", error.message);
  process.exit(1);
}

let created = 0;
let updated = 0;
let skipped = 0;

for (const u of users || []) {
  if (!u?.id || !u?.role || !u?.school_no) {
    skipped++;
    continue;
  }

  const email = buildAuthEmail(u.role, u.school_no);
  const password = u.password || "123456";

  const { data: existing, error: getErr } = await supabase.auth.admin.getUserById(u.id);
  if (!getErr && existing?.user) {
    const { error: upErr } = await supabase.auth.admin.updateUserById(u.id, {
      email,
      ...(u.password ? { password: u.password } : {}),
      user_metadata: {
        role: u.role,
        schoolNo: u.school_no,
        displayName: u.display_name || u.school_no,
      },
    });
    if (upErr) {
      console.warn(`update auth user failed: ${u.id} => ${upErr.message}`);
      continue;
    }
    updated++;
    continue;
  }

  const { error: createErr } = await supabase.auth.admin.createUser({
    id: u.id,
    email,
    password,
    email_confirm: true,
    user_metadata: {
      role: u.role,
      schoolNo: u.school_no,
      displayName: u.display_name || u.school_no,
    },
  });
  if (createErr) {
    console.warn(`create auth user failed: ${u.id} => ${createErr.message}`);
    continue;
  }
  created++;
}

console.log(`sync finished. created=${created}, updated=${updated}, skipped=${skipped}`);
