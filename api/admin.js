import { assertAdmin, getSupabaseAdminClient } from "../server/supabase.js";
import { buildAuthEmail } from "../server/authIdentity.js";

function normalizeUserInput(input) {
  return {
    id: input.id,
    role: input.role,
    phone: input.phone || "",
    school_no: input.schoolNo || "",
    display_name: input.displayName || "新用户",
    age: input.age ?? null,
    gender: input.gender ?? null,
    status: input.status || "active",
    avatar_url: input.avatarUrl ?? null,
    grade_level: input.gradeLevel ?? null,
    subject_id: input.subjectId ?? null,
    class_id: input.classId ?? null,
  };
}

function normalizeImportUserInput(input) {
  return {
    id: input.id,
    role: input.role,
    phone: input.phone || "",
    school_no: input.schoolNo || "",
    display_name: input.displayName || input.schoolNo || "新用户",
    age: input.age ?? null,
    gender: input.gender ?? null,
    status: input.status || "active",
    avatar_url: input.avatarUrl ?? null,
    grade_level: input.gradeLevel ?? null,
    subject_id: input.subjectId ?? null,
    class_id: input.classId ?? null,
    created_at: new Date().toISOString(),
  };
}

async function createAuthUser(supabase, input, preferredId) {
  const email = buildAuthEmail(input.role, input.schoolNo);
  const password = input.password || "123456";
  const payload = {
    ...(preferredId ? { id: preferredId } : {}),
    email,
    password,
    email_confirm: true,
    user_metadata: {
      role: input.role,
      schoolNo: input.schoolNo,
      displayName: input.displayName || input.schoolNo || "新用户",
    },
  };
  const { data, error } = await supabase.auth.admin.createUser(payload);
  if (error || !data?.user) throw new Error(error?.message || "创建认证用户失败");
  return data.user;
}

async function updateAuthUser(supabase, userId, input) {
  const attrs = {
    email: buildAuthEmail(input.role, input.schoolNo),
    user_metadata: {
      role: input.role,
      schoolNo: input.schoolNo,
      displayName: input.displayName || input.schoolNo || "新用户",
    },
    ...(input.password ? { password: input.password } : {}),
  };
  const { error } = await supabase.auth.admin.updateUserById(userId, attrs);
  if (!error) return;
  if (/not found/i.test(error.message || "")) {
    await createAuthUser(supabase, input, userId);
    return;
  }
  throw new Error(error.message || "更新认证用户失败");
}

export default async function handler(req, res) {
  const supabase = getSupabaseAdminClient();
  const { resource } = req.query || {};

  try {
    if (resource === "users") {
      if (req.method === "GET") {
        const { adminId, role } = req.query || {};
        await assertAdmin(supabase, adminId);

        let query = supabase.from("users").select("*").order("school_no", { ascending: true });
        if (role) query = query.eq("role", role);
        const { data, error } = await query;
        if (error) throw new Error(error.message);
        return res.status(200).json({ users: data || [] });
      }

      if (req.method === "POST") {
        const { adminId, user } = req.body || {};
        await assertAdmin(supabase, adminId);
        if (!user || !user.role || !user.schoolNo || !user.displayName) {
          return res.status(400).json({ error: "参数不完整" });
        }

        const row = normalizeUserInput(user);
        if (!row.id) {
          const authUser = await createAuthUser(supabase, user);
          row.id = authUser.id;
          row.created_at = new Date().toISOString();
        } else {
          await updateAuthUser(supabase, row.id, user);
        }
        const { error } = await supabase.from("users").upsert(row, { onConflict: "id" });
        if (error) throw new Error(error.message);
        return res.status(200).json({ ok: true });
      }

      if (req.method === "DELETE") {
        const { adminId, userId } = req.body || {};
        await assertAdmin(supabase, adminId);
        if (!userId) return res.status(400).json({ error: "缺少 userId" });
        const { error } = await supabase.from("users").delete().eq("id", userId);
        if (error) throw new Error(error.message);
        await supabase.auth.admin.deleteUser(userId).catch(() => {});
        return res.status(200).json({ ok: true });
      }

      if (req.method === "PATCH") {
        const { adminId, userIds, status } = req.body || {};
        await assertAdmin(supabase, adminId);
        if (!Array.isArray(userIds) || userIds.length === 0) {
          return res.status(400).json({ error: "缺少 userIds" });
        }
        if (status !== "active" && status !== "disabled") {
          return res.status(400).json({ error: "非法状态值" });
        }
        const { error } = await supabase.from("users").update({ status }).in("id", userIds);
        if (error) throw new Error(error.message);
        return res.status(200).json({ ok: true });
      }
    }

    if (resource === "classes") {
      if (req.method === "GET") {
        const { adminId } = req.query || {};
        await assertAdmin(supabase, adminId);
        const { data, error } = await supabase.from("classes").select("*").order("created_at", { ascending: false });
        if (error) throw new Error(error.message);
        return res.status(200).json({ classes: data || [] });
      }

      if (req.method === "POST") {
        const { adminId, cls } = req.body || {};
        await assertAdmin(supabase, adminId);
        if (!cls || !cls.name || !cls.gradeLevel) {
          return res.status(400).json({ error: "参数不完整" });
        }
        const row = {
          id: cls.id || crypto.randomUUID(),
          name: cls.name,
          grade_level: cls.gradeLevel,
          teacher_id: cls.teacherId || null,
        };
        if (!cls.id) row.created_at = new Date().toISOString();
        const { error } = await supabase.from("classes").upsert(row, { onConflict: "id" });
        if (error) throw new Error(error.message);
        return res.status(200).json({ ok: true });
      }

      if (req.method === "DELETE") {
        const { adminId, classId } = req.body || {};
        await assertAdmin(supabase, adminId);
        if (!classId) return res.status(400).json({ error: "缺少 classId" });
        const { error } = await supabase.from("classes").delete().eq("id", classId);
        if (error) throw new Error(error.message);
        return res.status(200).json({ ok: true });
      }
    }

    if (resource === "stats" && req.method === "GET") {
      const { adminId } = req.query || {};
      await assertAdmin(supabase, adminId);
      const { data, error } = await supabase.from("users").select("role");
      if (error) throw new Error(error.message);
      const users = data || [];
      const studentCount = users.filter((u) => u.role === "student").length;
      const teacherCount = users.filter((u) => u.role === "teacher").length;
      const adminCount = users.filter((u) => u.role === "admin").length;
      return res.status(200).json({ studentCount, teacherCount, adminCount });
    }

    if (resource === "users-import" && req.method === "POST") {
      const { adminId, users } = req.body || {};
      await assertAdmin(supabase, adminId);
      if (!Array.isArray(users)) return res.status(400).json({ error: "缺少 users" });

      let successCount = 0;
      let failCount = 0;
      const errors = [];
      for (let i = 0; i < users.length; i++) {
        const u = users[i];
        try {
          if (!u.role || !u.schoolNo) throw new Error("缺少角色或学号/工号");
          const authUser = await createAuthUser(supabase, u, u.id);
          const row = normalizeImportUserInput({ ...u, id: authUser.id });
          const { error } = await supabase.from("users").insert(row);
          if (error) {
            await supabase.auth.admin.deleteUser(authUser.id).catch(() => {});
            throw new Error(error.message);
          }
          successCount++;
        } catch (e) {
          failCount++;
          errors.push(`第 ${i + 1} 行: ${e.message || "导入失败"}`);
        }
      }
      return res.status(200).json({ successCount, failCount, errors });
    }

    return res.status(405).json({ error: "Method Not Allowed" });
  } catch (e) {
    return res.status(500).json({ error: e.message || "管理员接口失败" });
  }
}
