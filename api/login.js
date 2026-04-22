import { getSupabaseAdminClient } from "../server/supabase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { role, schoolNo } = req.body || {};
    if (!role || !schoolNo) {
      return res.status(400).json({ error: "参数缺失" });
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("role", role)
      .eq("school_no", schoolNo)
      .single();

    if (error || !data) {
      return res.status(401).json({ error: "账号或密码不正确" });
    }
    if (data.status === "disabled") {
      return res.status(403).json({ error: "该账号已被禁用，请联系管理员" });
    }

    return res.status(200).json({ user: data });
  } catch (e) {
    return res.status(500).json({ error: e.message || "登录失败" });
  }
}
