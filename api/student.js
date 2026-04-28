import { assertStudent, getSupabaseAdminClient } from "../server/supabase.js";

function gradeAuto(question, answer, score) {
  const key = question.answer_key;
  if (question.type === "blank" || question.type === "short") return 0;
  if (question.type === "single") return answer === key ? score : 0;
  if (question.type === "multiple") {
    const a = Array.isArray(answer) ? [...answer].sort() : [];
    const k = Array.isArray(key) ? [...key].sort() : [];
    return JSON.stringify(a) === JSON.stringify(k) ? score : 0;
  }
  if (question.type === "true_false") return Boolean(answer) === Boolean(key) ? score : 0;
  return 0;
}

function isSubjectiveQuestion(question) {
  return question && (question.type === "blank" || question.type === "short");
}

function shouldAutoSubmitAttempt(attempt, exam) {
  if (attempt.status !== "in_progress") return false;
  const candidates = [];
  const examEnd = exam.end_at ? Date.parse(exam.end_at) : undefined;
  const startedAt = attempt.started_at ? Date.parse(attempt.started_at) : undefined;
  if (Number.isFinite(examEnd)) candidates.push(examEnd);
  if (Number.isFinite(startedAt) && Number(exam.duration_minutes) > 0) {
    candidates.push(startedAt + Number(exam.duration_minutes) * 60_000);
  }
  if (candidates.length === 0) return false;
  return Date.now() >= Math.min(...candidates);
}

async function submitAttempt(supabase, attempt) {
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

  const { data: answers, error: ansErr } = await supabase.from("attempt_answers").select("*").eq("attempt_id", attempt.id);
  if (ansErr) throw new Error(ansErr.message);

  const updatedAt = new Date().toISOString();
  for (const aa of answers || []) {
    const q = qMap.get(aa.question_id);
    if (!q) continue;
    const autoScore = gradeAuto(q, aa.answer, qScoreMap.get(aa.question_id) || 0);
    const { error } = await supabase
      .from("attempt_answers")
      .update({ auto_score: autoScore, manual_score: aa.manual_score || 0, updated_at: updatedAt })
      .eq("id", aa.id);
    if (error) throw new Error(error.message);
  }

  const { data: latestAnswers, error: laErr } = await supabase
    .from("attempt_answers")
    .select("auto_score, manual_score")
    .eq("attempt_id", attempt.id);
  if (laErr) throw new Error(laErr.message);
  const totalScore = (latestAnswers || []).reduce((sum, x) => sum + Number(x.auto_score || 0) + Number(x.manual_score || 0), 0);
  const submittedAt = new Date().toISOString();
  const hasSubjectiveQuestions = questions.some(isSubjectiveQuestion);

  const { data: updatedAttempt, error: upErr } = await supabase
    .from("attempts")
    .update({ status: hasSubjectiveQuestions ? "submitted" : "graded", submitted_at: submittedAt, total_score: totalScore })
    .eq("id", attempt.id)
    .select("*")
    .single();
  if (upErr) throw new Error(upErr.message);
  return updatedAttempt;
}

function isMessageVisibleForStudent(message, student) {
  const target = message.target;
  if (!target || !target.type) return false;
  if (target.type === "all_students") return true;
  if (target.type === "students" && Array.isArray(target.studentIds)) {
    return target.studentIds.includes(student.id);
  }
  if (target.type === "classes" && Array.isArray(target.classIds)) {
    return Boolean(student.class_id && target.classIds.includes(student.class_id));
  }
  return false;
}

export default async function handler(req, res) {
  const supabase = getSupabaseAdminClient();
  const { resource } = req.query || {};

  try {
    if (resource === "profile") {
      if (req.method === "GET") {
        const { studentId } = req.query || {};
        await assertStudent(supabase, studentId);
        const { data: student, error: studentErr } = await supabase
          .from("users")
          .select("*")
          .eq("id", studentId)
          .eq("role", "student")
          .single();
        if (studentErr || !student) throw new Error(studentErr?.message || "学生不存在");
        let classInfo = null;
        if (student.class_id) {
          const { data, error } = await supabase.from("classes").select("*").eq("id", student.class_id).limit(1);
          if (error) throw new Error(error.message);
          classInfo = (data || [])[0] || null;
        }
        return res.status(200).json({ user: student, class: classInfo });
      }

      if (req.method === "POST") {
        const { studentId, patch } = req.body || {};
        await assertStudent(supabase, studentId);
        const displayName = String(patch?.displayName || "").trim();
        if (!displayName) return res.status(400).json({ error: "姓名不能为空" });
        const { data: user, error } = await supabase
          .from("users")
          .update({ display_name: displayName })
          .eq("id", studentId)
          .eq("role", "student")
          .select("*")
          .single();
        if (error) throw new Error(error.message);
        return res.status(200).json({ user });
      }
    }

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
            .neq("status", "draft")
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
          .neq("status", "draft")
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
        if (examErr || !exam || exam.status === "draft") return res.status(400).json({ error: "考试不可用" });

        const now = Date.now();
        const start = exam.start_at ? Date.parse(exam.start_at) : undefined;
        const end = exam.end_at ? Date.parse(exam.end_at) : undefined;
        if (start && now < start) return res.status(400).json({ error: "考试还未开始请耐心等待" });
        if (end && now > end) return res.status(400).json({ error: "考试已结束" });

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

        const nowIso = new Date().toISOString();
        const attempt = {
          id: crypto.randomUUID(),
          exam_id: examId,
          student_id: studentId,
          status: "in_progress",
          started_at: nowIso,
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
            updated_at: nowIso,
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

        let { data: attempt, error: atErr } = await supabase.from("attempts").select("*").eq("id", attemptId).single();
        if (atErr || !attempt || attempt.student_id !== studentId) return res.status(403).json({ error: "无权限" });

        const { data: exam, error: examErr } = await supabase.from("exams").select("*").eq("id", attempt.exam_id).single();
        if (examErr || !exam) return res.status(404).json({ error: "考试不存在" });

        if (shouldAutoSubmitAttempt(attempt, exam)) {
          attempt = await submitAttempt(supabase, attempt);
        } else if (attempt.status !== "in_progress") {
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

        const updatedAttempt = await submitAttempt(supabase, attempt);
        return res.status(200).json({ ok: true, totalScore: updatedAttempt.total_score, attempt: updatedAttempt });
      }
    }

    if (resource === "messages") {
      if (req.method === "GET") {
        const { studentId } = req.query || {};
        await assertStudent(supabase, studentId);
        const { data: student, error: studentErr } = await supabase
          .from("users")
          .select("id, class_id")
          .eq("id", studentId)
          .eq("role", "student")
          .single();
        if (studentErr || !student) throw new Error(studentErr?.message || "学生不存在");

        const { data: messages, error } = await supabase.from("messages").select("*").order("created_at", { ascending: false });
        if (error) throw new Error(error.message);
        const visible = (messages || []).filter((m) => isMessageVisibleForStudent(m, student));

        const messageIds = visible.map((m) => m.id);
        let reads = [];
        if (messageIds.length > 0) {
          const { data, error: readErr } = await supabase
            .from("message_reads")
            .select("message_id, read_at")
            .eq("student_id", studentId)
            .in("message_id", messageIds);
          if (readErr && !readErr.message.includes('message_reads')) throw new Error(readErr.message);
          reads = data || [];
        }
        const readMap = new Map(reads.map((item) => [item.message_id, item.read_at]));
        const visibleWithReadAt = visible.map((m) => ({ ...m, read_at: readMap.get(m.id) || null }));

        const teacherIds = [...new Set(visibleWithReadAt.map((m) => m.teacher_id).filter(Boolean))];
        let teachers = [];
        if (teacherIds.length > 0) {
          const { data, error: tErr } = await supabase.from("users").select("*").in("id", teacherIds);
          if (tErr) throw new Error(tErr.message);
          teachers = data || [];
        }
        return res.status(200).json({ messages: visibleWithReadAt, teachers });
      }

      if (req.method === "POST") {
        const { studentId, messageId } = req.body || {};
        await assertStudent(supabase, studentId);
        if (!messageId) return res.status(400).json({ error: "缺少 messageId" });
        const { data: student, error: studentErr } = await supabase
          .from("users")
          .select("id, class_id")
          .eq("id", studentId)
          .eq("role", "student")
          .single();
        if (studentErr || !student) throw new Error(studentErr?.message || "学生不存在");

        const { data: message, error: messageErr } = await supabase.from("messages").select("*").eq("id", messageId).single();
        if (messageErr || !message) throw new Error(messageErr?.message || "公告不存在");

        const visible = isMessageVisibleForStudent(message, student);
        if (!visible) return res.status(403).json({ error: "无权操作该公告" });

        const row = {
          message_id: messageId,
          student_id: studentId,
          read_at: new Date().toISOString(),
        };
        const { error: upsertErr } = await supabase.from("message_reads").upsert(row, { onConflict: "message_id,student_id" });
        if (upsertErr) throw new Error(upsertErr.message);
        return res.status(200).json({ ok: true });
      }
    }

    return res.status(405).json({ error: "Method Not Allowed" });
  } catch (e) {
    return res.status(500).json({ error: e.message || "学生接口失败" });
  }
}
