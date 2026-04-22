import { assertStudent, getSupabaseAdminClient } from "../server/supabase.js";

function gradeAuto(question, answer, score) {
  const key = question.answer_key;
  if (question.type === "short") return 0;
  if (question.type === "single") return answer === key ? score : 0;
  if (question.type === "multiple") {
    const a = Array.isArray(answer) ? [...answer].sort() : [];
    const k = Array.isArray(key) ? [...key].sort() : [];
    return JSON.stringify(a) === JSON.stringify(k) ? score : 0;
  }
  if (question.type === "true_false") return Boolean(answer) === Boolean(key) ? score : 0;
  if (question.type === "blank") return String(answer ?? "").trim() === String(key ?? "").trim() ? score : 0;
  return 0;
}

export default async function handler(req, res) {
  const supabase = getSupabaseAdminClient();
  const { resource } = req.query || {};

  try {
    if (resource === "exams") {
      if (req.method === "GET") {
        const { studentId, examId } = req.query || {};
        await assertStudent(supabase, studentId);

        if (!examId) {
          const { data: assignments, error: asErr } = await supabase
            .from("exam_assignments")
            .select("exam_id")
            .eq("student_id", studentId);
          if (asErr) throw new Error(asErr.message);
          const examIds = [...new Set((assignments || []).map((x) => x.exam_id))];
          if (examIds.length === 0) return res.status(200).json({ exams: [] });

          const { data: exams, error: eErr } = await supabase
            .from("exams")
            .select("*")
            .in("id", examIds)
            .eq("status", "published")
            .order("created_at", { ascending: false });
          if (eErr) throw new Error(eErr.message);
          return res.status(200).json({ exams: exams || [] });
        }

        const { data: allowed, error: allowErr } = await supabase
          .from("exam_assignments")
          .select("id")
          .eq("student_id", studentId)
          .eq("exam_id", examId)
          .limit(1);
        if (allowErr) throw new Error(allowErr.message);
        if (!allowed || allowed.length === 0) return res.status(403).json({ error: "无权限" });

        const { data: exam, error: examErr } = await supabase
          .from("exams")
          .select("*")
          .eq("id", examId)
          .eq("status", "published")
          .single();
        if (examErr || !exam) return res.status(404).json({ error: "考试不存在" });

        const { data: examQuestions, error: eqErr } = await supabase
          .from("exam_questions")
          .select("*")
          .eq("exam_id", examId)
          .order("sort_order", { ascending: true });
        if (eqErr) throw new Error(eqErr.message);

        const qIds = (examQuestions || []).map((x) => x.question_id);
        let questions = [];
        if (qIds.length > 0) {
          const { data, error: qErr } = await supabase.from("questions").select("*").in("id", qIds);
          if (qErr) throw new Error(qErr.message);
          questions = data || [];
        }
        return res.status(200).json({ exam, examQuestions: examQuestions || [], questions });
      }

      if (req.method === "POST") {
        const { studentId, examId } = req.body || {};
        await assertStudent(supabase, studentId);
        if (!examId) return res.status(400).json({ error: "缺少 examId" });

        const { data: exam, error: examErr } = await supabase.from("exams").select("*").eq("id", examId).single();
        if (examErr || !exam || exam.status !== "published") return res.status(400).json({ error: "考试不可用" });

        const { data: allowed, error: allowErr } = await supabase
          .from("exam_assignments")
          .select("id")
          .eq("student_id", studentId)
          .eq("exam_id", examId)
          .limit(1);
        if (allowErr) throw new Error(allowErr.message);
        if (!allowed || allowed.length === 0) return res.status(403).json({ error: "无权限" });

        const { data: inProgress, error: ipErr } = await supabase
          .from("attempts")
          .select("*")
          .eq("student_id", studentId)
          .eq("exam_id", examId)
          .eq("status", "in_progress")
          .limit(1);
        if (ipErr) throw new Error(ipErr.message);
        if (inProgress && inProgress.length > 0) return res.status(200).json({ attempt: inProgress[0] });

        const { data: attempts, error: cErr } = await supabase
          .from("attempts")
          .select("id,status")
          .eq("student_id", studentId)
          .eq("exam_id", examId);
        if (cErr) throw new Error(cErr.message);
        const submittedCount = (attempts || []).filter((a) => a.status !== "in_progress").length;
        if (submittedCount >= Number(exam.attempt_limit || 1)) {
          return res.status(400).json({ error: "已达到考试次数上限" });
        }

        const now = new Date().toISOString();
        const attempt = {
          id: crypto.randomUUID(),
          exam_id: examId,
          student_id: studentId,
          status: "in_progress",
          started_at: now,
          submitted_at: null,
          total_score: 0,
          score_published: false,
        };
        const { error: insErr } = await supabase.from("attempts").insert(attempt);
        if (insErr) throw new Error(insErr.message);

        const { data: eqRows, error: eqErr } = await supabase
          .from("exam_questions")
          .select("question_id")
          .eq("exam_id", examId)
          .order("sort_order", { ascending: true });
        if (eqErr) throw new Error(eqErr.message);
        if ((eqRows || []).length > 0) {
          const aaRows = eqRows.map((x) => ({
            id: crypto.randomUUID(),
            attempt_id: attempt.id,
            question_id: x.question_id,
            answer: null,
            auto_score: 0,
            manual_score: 0,
            teacher_comment: null,
            updated_at: now,
          }));
          const { error: aaErr } = await supabase.from("attempt_answers").insert(aaRows);
          if (aaErr) throw new Error(aaErr.message);
        }
        return res.status(200).json({ attempt });
      }
    }

    if (resource === "attempts") {
      if (req.method === "GET") {
        const { studentId, attemptId } = req.query || {};
        await assertStudent(supabase, studentId);
        if (!attemptId) {
          const { data: attempts, error } = await supabase
            .from("attempts")
            .select("*")
            .eq("student_id", studentId)
            .order("started_at", { ascending: false });
          if (error) throw new Error(error.message);
          return res.status(200).json({ attempts: attempts || [] });
        }

        const { data: attempt, error: atErr } = await supabase.from("attempts").select("*").eq("id", attemptId).single();
        if (atErr || !attempt || attempt.student_id !== studentId) return res.status(403).json({ error: "无权限" });

        const { data: exam, error: examErr } = await supabase.from("exams").select("*").eq("id", attempt.exam_id).single();
        if (examErr || !exam) return res.status(404).json({ error: "考试不存在" });

        if (attempt.status !== "in_progress") {
          const now = Date.now();
          const end = exam.end_at ? Date.parse(exam.end_at) : undefined;
          if (end && now <= end) return res.status(400).json({ error: "考试时间未结束，请耐心等候考试结果" });
        }

        const { data: examQuestions, error: eqErr } = await supabase
          .from("exam_questions")
          .select("*")
          .eq("exam_id", exam.id)
          .order("sort_order", { ascending: true });
        if (eqErr) throw new Error(eqErr.message);

        const qIds = (examQuestions || []).map((x) => x.question_id);
        let questions = [];
        if (qIds.length > 0) {
          const { data, error: qErr } = await supabase.from("questions").select("*").in("id", qIds);
          if (qErr) throw new Error(qErr.message);
          questions = data || [];
        }
        const { data: answers, error: ansErr } = await supabase.from("attempt_answers").select("*").eq("attempt_id", attemptId);
        if (ansErr) throw new Error(ansErr.message);

        return res.status(200).json({ attempt, exam, examQuestions: examQuestions || [], questions, answers: answers || [] });
      }

      if (req.method === "POST") {
        const { studentId, attemptId, questionId, answer } = req.body || {};
        await assertStudent(supabase, studentId);
        if (!attemptId || !questionId) return res.status(400).json({ error: "参数不完整" });

        const { data: attempt, error: atErr } = await supabase.from("attempts").select("*").eq("id", attemptId).single();
        if (atErr || !attempt || attempt.student_id !== studentId) return res.status(403).json({ error: "无权限" });
        if (attempt.status !== "in_progress") return res.status(400).json({ error: "仅进行中答卷可保存" });

        const { error } = await supabase
          .from("attempt_answers")
          .update({ answer, updated_at: new Date().toISOString() })
          .eq("attempt_id", attemptId)
          .eq("question_id", questionId);
        if (error) throw new Error(error.message);
        return res.status(200).json({ ok: true });
      }

      if (req.method === "PATCH") {
        const { studentId, attemptId } = req.body || {};
        await assertStudent(supabase, studentId);
        if (!attemptId) return res.status(400).json({ error: "缺少 attemptId" });

        const { data: attempt, error: atErr } = await supabase.from("attempts").select("*").eq("id", attemptId).single();
        if (atErr || !attempt || attempt.student_id !== studentId) return res.status(403).json({ error: "无权限" });
        if (attempt.status !== "in_progress") return res.status(400).json({ error: "答卷状态不可提交" });

        const { data: examQuestions, error: eqErr } = await supabase.from("exam_questions").select("*").eq("exam_id", attempt.exam_id);
        if (eqErr) throw new Error(eqErr.message);
        const qIds = (examQuestions || []).map((x) => x.question_id);
        const qScoreMap = new Map((examQuestions || []).map((x) => [x.question_id, Number(x.score || 0)]));

        let questions = [];
        if (qIds.length > 0) {
          const { data, error: qErr } = await supabase.from("questions").select("*").in("id", qIds);
          if (qErr) throw new Error(qErr.message);
          questions = data || [];
        }
        const qMap = new Map(questions.map((q) => [q.id, q]));

        const { data: answers, error: ansErr } = await supabase.from("attempt_answers").select("*").eq("attempt_id", attemptId);
        if (ansErr) throw new Error(ansErr.message);

        for (const aa of answers || []) {
          const q = qMap.get(aa.question_id);
          if (!q) continue;
          const autoScore = gradeAuto(q, aa.answer, qScoreMap.get(aa.question_id) || 0);
          const { error } = await supabase
            .from("attempt_answers")
            .update({ auto_score: autoScore, manual_score: aa.manual_score || 0, updated_at: new Date().toISOString() })
            .eq("id", aa.id);
          if (error) throw new Error(error.message);
        }

        const { data: latestAnswers, error: laErr } = await supabase
          .from("attempt_answers")
          .select("auto_score, manual_score")
          .eq("attempt_id", attemptId);
        if (laErr) throw new Error(laErr.message);
        const totalScore = (latestAnswers || []).reduce((sum, x) => sum + Number(x.auto_score || 0) + Number(x.manual_score || 0), 0);

        const { error: upErr } = await supabase
          .from("attempts")
          .update({ status: "submitted", submitted_at: new Date().toISOString(), total_score: totalScore })
          .eq("id", attemptId);
        if (upErr) throw new Error(upErr.message);
        return res.status(200).json({ ok: true, totalScore });
      }
    }

    if (resource === "messages" && req.method === "GET") {
      const { studentId } = req.query || {};
      await assertStudent(supabase, studentId);

      const { data: messages, error } = await supabase.from("messages").select("*").order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      const visible = (messages || []).filter((m) => {
        if (!m.target || !m.target.type) return false;
        if (m.target.type === "all_students") return true;
        if (m.target.type === "students" && Array.isArray(m.target.studentIds)) {
          return m.target.studentIds.includes(studentId);
        }
        return false;
      });

      const teacherIds = [...new Set(visible.map((m) => m.teacher_id).filter(Boolean))];
      let teachers = [];
      if (teacherIds.length > 0) {
        const { data, error: tErr } = await supabase.from("users").select("*").in("id", teacherIds);
        if (tErr) throw new Error(tErr.message);
        teachers = data || [];
      }
      return res.status(200).json({ messages: visible, teachers });
    }

    return res.status(405).json({ error: "Method Not Allowed" });
  } catch (e) {
    return res.status(500).json({ error: e.message || "学生接口失败" });
  }
}
