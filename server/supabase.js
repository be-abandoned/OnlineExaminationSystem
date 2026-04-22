import { createClient } from "@supabase/supabase-js";

export function getSupabaseAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase env missing");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function assertAdmin(supabase, adminId) {
  if (!adminId) throw new Error("未登录");
  const { data, error } = await supabase
    .from("users")
    .select("id, role")
    .eq("id", adminId)
    .single();
  if (error || !data || data.role !== "admin") {
    throw new Error("无管理员权限");
  }
}

export async function assertTeacher(supabase, teacherId) {
  if (!teacherId) throw new Error("未登录");
  const { data, error } = await supabase
    .from("users")
    .select("id, role")
    .eq("id", teacherId)
    .single();
  if (error || !data || data.role !== "teacher") {
    throw new Error("无教师权限");
  }
}

export async function assertStudent(supabase, studentId) {
  if (!studentId) throw new Error("未登录");
  const { data, error } = await supabase
    .from("users")
    .select("id, role")
    .eq("id", studentId)
    .single();
  if (error || !data || data.role !== "student") {
    throw new Error("无学生权限");
  }
}
