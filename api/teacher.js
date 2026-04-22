import { assertTeacher, getSupabaseAdminClient } from "../server/supabase.js";

function normalizeQuestionInput(input, teacherId) {
  return {
    id: input.id || crypto.randomUUID(),
    teacher_id: teacherId,
    type: input.type,
    stem: input.stem,
    options: input.options ?? null,
    answer_key: input.answerKey ?? null,
    default_score: input.defaultScore,
    grade_level: input.gradeLevel ?? null,
    subject_id: input.subjectId ?? null,
    analysis: input.analysis ?? null,
    difficulty: input.difficulty ?? null,
    updated_at: new Date().toISOString(),
    ...(input.id ? {} : { created_at: new Date().toISOString() }),
  };
}

function normalizeExamInput(input, teacherId) {
  const now = new Date().toISOString();
  return {
    id: input.id || crypto.randomUUID(),
    teacher_id: teacherId,
    title: input.title,
    description: input.description ?? null,
    status: input.status || "draft",
    duration_minutes: Number(input.durationMinutes || 30),
    grade_level: input.gradeLevel ?? null,
    subject_id: input.subjectId ?? null,
    start_at: input.startAt ?? null,
    end_at: input.endAt ?? null,
    attempt_limit: Number(input.attemptLimit || 1),
    shuffle_questions: Boolean(input.shuffleQuestions),
    assigned_class_ids: input.assignedClassIds ?? null,
    updated_at: now,
    ...(input.id ? {} : { created_at: now }),
  };
}

function canAccessExam(exam, teacherId) {
  return exam && exam.teacher_id === teacherId;
}

export default async function handler(req, res) {
  const supabase = getSupabaseAdminClient();
  const { resource } = req.query || {};

  try {
    if (resource === "questions") {
      if (req.method === "GET") {
        const { teacherId } = req.query || {};
        await assertTeacher(supabase, teacherId);
        const { data, error } = await supabase
          .from("questions")
          .select("*")
          .eq("teacher_id", teacherId)
          .order("updated_at", { ascending: false });
        if (error) throw new Error(error.message);
        return res.status(200).json({ questions: data || [] });
      }

      if (req.method === "POST") {
        const { teacherId, question } = req.body || {};
        await assertTeacher(supabase, teacherId);
        if (!question || !question.type || !question.stem) {
          return res.status(400).json({ error: "题目参数不完整" });
        }
        const row = normalizeQuestionInput(question, teacherId);
        const { error } = await supabase.from("questions").upsert(row, { onConflict: "id" });
        if (error) throw new Error(error.message);
        return res.status(200).json({ ok: true, id: row.id });
      }

      if (req.method === "DELETE") {
        const { teacherId, questionId } = req.body || {};
        await assertTeacher(supabase, teacherId);
        if (!questionId) return res.status(400).json({ error: "缺少 questionId" });
        const { error } = await supabase
          .from("questions")
          .delete()
          .eq("id", questionId)
          .eq("teacher_id", teacherId);
        if (error) throw new Error(error.message);
        return res.status(200).json({ ok: true });
      }

      if (req.method === "PATCH") {
        const { teacherId, questionIds } = req.body || {};
        await assertTeacher(supabase, teacherId);
        if (!Array.isArray(questionIds) || questionIds.length === 0) {
          return res.status(400).json({ error: "缺少 questionIds" });
        }
        const { error } = await supabase
          .from("questions")
          .delete()
          .eq("teacher_id", teacherId)
          .in("id", questionIds);
        if (error) throw new Error(error.message);
        return res.status(200).json({ ok: true });
      }
    }

    if (resource === "exams") {
      if (req.method === "GET") {
        const { teacherId } = req.query || {};
        await assertTeacher(supabase, teacherId);

        const { data: exams, error } = await supabase
          .from("exams")
          .select("*")
          .eq("teacher_id", teacherId)
          .order("updated_at", { ascending: false });
        if (error) throw new Error(error.message);

        const examIds = (exams || []).map((e) => e.id);
        let assignmentCounts = {};
        if (examIds.length > 0) {
          const { data: assignments, error: ae } = await supabase
            .from("exam_assignments")
            .select("exam_id")
            .in("exam_id", examIds);
          if (ae) throw new Error(ae.message);
          assignmentCounts = (assignments || []).reduce((acc, x) => {
            acc[x.exam_id] = (acc[x.exam_id] || 0) + 1;
            return acc;
          }, {});
        }
        return res.status(200).json({ exams: exams || [], assignmentCounts });
      }

      if (req.method === "POST") {
        const { teacherId, exam } = req.body || {};
        await assertTeacher(supabase, teacherId);
        if (!exam || !exam.title) return res.status(400).json({ error: "缺少试卷参数" });
        const row = normalizeExamInput(exam, teacherId);
        const { error } = await supabase.from("exams").upsert(row, { onConflict: "id" });
        if (error) throw new Error(error.message);
        return res.status(200).json({ ok: true, id: row.id });
      }

      if (req.method === "DELETE") {
        const { teacherId, examId } = req.body || {};
        await assertTeacher(supabase, teacherId);
        if (!examId) return res.status(400).json({ error: "缺少 examId" });
        const { error } = await supabase
          .from("exams")
          .delete()
          .eq("id", examId)
          .eq("teacher_id", teacherId);
        if (error) throw new Error(error.message);
        return res.status(200).json({ ok: true });
      }
    }

    if (resource === "exam-content" && req.method === "POST") {
      const { teacherId, examId, items, classIds } = req.body || {};
      await assertTeacher(supabase, teacherId);
      if (!examId) return res.status(400).json({ error: "缺少 examId" });

      const { data: exam, error: examErr } = await supabase
        .from("exams")
        .select("id, teacher_id")
        .eq("id", examId)
        .single();
      if (examErr || !exam || exam.teacher_id !== teacherId) {
        return res.status(403).json({ error: "无权限或试卷不存在" });
      }

      if (Array.isArray(items)) {
        const { error: delEqErr } = await supabase.from("exam_questions").delete().eq("exam_id", examId);
        if (delEqErr) throw new Error(delEqErr.message);
        if (items.length > 0) {
          const rows = items.map((it, idx) => ({
            id: crypto.randomUUID(),
            exam_id: examId,
            question_id: it.questionId,
            sort_order: idx + 1,
            score: Number(it.score || 0),
          }));
          const { error: insEqErr } = await supabase.from("exam_questions").insert(rows);
          if (insEqErr) throw new Error(insEqErr.message);
        }
      }

      if (Array.isArray(classIds)) {
        const { error: upExamErr } = await supabase
          .from("exams")
          .update({ assigned_class_ids: classIds, updated_at: new Date().toISOString() })
          .eq("id", examId)
          .eq("teacher_id", teacherId);
        if (upExamErr) throw new Error(upExamErr.message);

        const { error: delAssignErr } = await supabase.from("exam_assignments").delete().eq("exam_id", examId);
        if (delAssignErr) throw new Error(delAssignErr.message);

        if (classIds.length > 0) {
          const { data: students, error: stuErr } = await supabase
            .from("users")
            .select("id")
            .eq("role", "student")
            .in("class_id", classIds);
          if (stuErr) throw new Error(stuErr.message);
          if ((students || []).length > 0) {
            const now = new Date().toISOString();
            const rows = students.map((s) => ({
              id: crypto.randomUUID(),
              exam_id: examId,
              student_id: s.id,
              created_at: now,
            }));
            const { error: insAssignErr } = await supabase.from("exam_assignments").insert(rows);
            if (insAssignErr) throw new Error(insAssignErr.message);
          }
        }
      }

      return res.status(200).json({ ok: true });
    }

    if (resource === "classes" && req.method === "GET") {
      const { teacherId } = req.query || {};
      await assertTeacher(supabase, teacherId);
      const { data, error } = await supabase.from("classes").select("*").order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return res.status(200).json({ classes: data || [] });
    }

    if (resource === "exam-detail" && req.method === "GET") {
      const { teacherId, examId } = req.query || {};
      await assertTeacher(supabase, teacherId);
      if (!examId) return res.status(400).json({ error: "缺少 examId" });

      const { data: exam, error: examErr } = await supabase
        .from("exams")
        .select("*")
        .eq("id", examId)
        .eq("teacher_id", teacherId)
        .single();
      if (examErr || !exam) return res.status(404).json({ error: "试卷不存在" });

      const { data: questions, error: qErr } = await supabase
        .from("questions")
        .select("*")
        .eq("teacher_id", teacherId)
        .order("updated_at", { ascending: false });
      if (qErr) throw new Error(qErr.message);

      const { data: examQuestions, error: eqErr } = await supabase
        .from("exam_questions")
        .select("*")
        .eq("exam_id", examId)
        .order("sort_order", { ascending: true });
      if (eqErr) throw new Error(eqErr.message);

      const { data: classes, error: cErr } = await supabase
        .from("classes")
        .select("*")
        .order("created_at", { ascending: false });
      if (cErr) throw new Error(cErr.message);

      return res.status(200).json({
        exam,
        questions: questions || [],
        examQuestions: examQuestions || [],
        classes: classes || [],
      });
    }

    if (resource === "grading") {
      if (req.method === "GET") {
        const { teacherId, examId, attemptId } = req.query || {};
        await assertTeacher(supabase, teacherId);

        if (examId) {
          const { data: exam, error: examErr } = await supabase.from("exams").select("*").eq("id", examId).single();
          if (examErr || !canAccessExam(exam, teacherId)) return res.status(404).json({ error: "试卷不存在或无权限" });

          const { data: attempts, error: aErr } = await supabase
            .from("attempts")
            .select("*")
            .eq("exam_id", examId)
            .order("submitted_at", { ascending: false });
          if (aErr) throw new Error(aErr.message);

          const studentIds = [...new Set((attempts || []).map((a) => a.student_id).filter(Boolean))];
          let students = [];
          if (studentIds.length > 0) {
            const { data, error: sErr } = await supabase.from("users").select("*").in("id", studentIds);
            if (sErr) throw new Error(sErr.message);
            students = data || [];
          }
          return res.status(200).json({ exam, attempts: attempts || [], students });
        }

        if (attemptId) {
          const { data: attempt, error: atErr } = await supabase.from("attempts").select("*").eq("id", attemptId).single();
          if (atErr || !attempt) return res.status(404).json({ error: "答卷不存在" });

          const { data: exam, error: examErr } = await supabase.from("exams").select("*").eq("id", attempt.exam_id).single();
          if (examErr || !canAccessExam(exam, teacherId)) return res.status(403).json({ error: "无权限" });

          const { data: answers, error: ansErr } = await supabase
            .from("attempt_answers")
            .select("*")
            .eq("attempt_id", attemptId);
          if (ansErr) throw new Error(ansErr.message);

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

          const { data: student } = await supabase.from("users").select("*").eq("id", attempt.student_id).single();
          return res.status(200).json({
            attempt,
            exam,
            answers: answers || [],
            examQuestions: examQuestions || [],
            questions,
            student: student || null,
          });
        }

        return res.status(400).json({ error: "缺少 examId 或 attemptId" });
      }

      if (req.method === "POST") {
        const { teacherId, attemptId, patch } = req.body || {};
        await assertTeacher(supabase, teacherId);
        if (!attemptId || !Array.isArray(patch)) return res.status(400).json({ error: "参数不完整" });

        const { data: attempt, error: atErr } = await supabase.from("attempts").select("*").eq("id", attemptId).single();
        if (atErr || !attempt) return res.status(404).json({ error: "答卷不存在" });
        const { data: exam, error: examErr } = await supabase.from("exams").select("*").eq("id", attempt.exam_id).single();
        if (examErr || !canAccessExam(exam, teacherId)) return res.status(403).json({ error: "无权限" });

        const updatedAt = new Date().toISOString();
        for (const p of patch) {
          const { error } = await supabase
            .from("attempt_answers")
            .update({
              manual_score: Math.max(0, Math.floor(Number(p.manualScore || 0))),
              teacher_comment: p.teacherComment ?? null,
              updated_at: updatedAt,
            })
            .eq("attempt_id", attemptId)
            .eq("question_id", p.questionId);
          if (error) throw new Error(error.message);
        }

        const { data: latestAnswers, error: laErr } = await supabase
          .from("attempt_answers")
          .select("auto_score, manual_score")
          .eq("attempt_id", attemptId);
        if (laErr) throw new Error(laErr.message);
        const totalScore = (latestAnswers || []).reduce(
          (sum, x) => sum + Number(x.auto_score || 0) + Number(x.manual_score || 0),
          0,
        );

        const { error: upErr } = await supabase
          .from("attempts")
          .update({ total_score: totalScore, status: "graded" })
          .eq("id", attemptId);
        if (upErr) throw new Error(upErr.message);
        return res.status(200).json({ ok: true, totalScore });
      }

      if (req.method === "PATCH") {
        const { teacherId, attemptId, scorePublished } = req.body || {};
        await assertTeacher(supabase, teacherId);
        if (!attemptId) return res.status(400).json({ error: "缺少 attemptId" });

        const { data: attempt, error: atErr } = await supabase.from("attempts").select("*").eq("id", attemptId).single();
        if (atErr || !attempt) return res.status(404).json({ error: "答卷不存在" });
        const { data: exam, error: examErr } = await supabase.from("exams").select("*").eq("id", attempt.exam_id).single();
        if (examErr || !canAccessExam(exam, teacherId)) return res.status(403).json({ error: "无权限" });

        const { error } = await supabase
          .from("attempts")
          .update({ score_published: Boolean(scorePublished) })
          .eq("id", attemptId);
        if (error) throw new Error(error.message);
        return res.status(200).json({ ok: true });
      }
    }

    if (resource === "messages") {
      if (req.method === "GET") {
        const { teacherId } = req.query || {};
        await assertTeacher(supabase, teacherId);

        const { data: sent, error: sentErr } = await supabase
          .from("messages")
          .select("*")
          .eq("teacher_id", teacherId)
          .order("created_at", { ascending: false });
        if (sentErr) throw new Error(sentErr.message);

        const { data: students, error: stuErr } = await supabase
          .from("users")
          .select("*")
          .eq("role", "student")
          .order("school_no", { ascending: true });
        if (stuErr) throw new Error(stuErr.message);

        return res.status(200).json({ sent: sent || [], students: students || [] });
      }

      if (req.method === "POST") {
        const { teacherId, title, content, target } = req.body || {};
        await assertTeacher(supabase, teacherId);
        if (!content || !target) return res.status(400).json({ error: "参数不完整" });
        const row = {
          id: crypto.randomUUID(),
          teacher_id: teacherId,
          title: title || "公告",
          content,
          target,
          created_at: new Date().toISOString(),
        };
        const { error } = await supabase.from("messages").insert(row);
        if (error) throw new Error(error.message);
        return res.status(200).json({ ok: true });
      }
    }

    if (resource === "dashboard" && req.method === "GET") {
      const { teacherId } = req.query || {};
      await assertTeacher(supabase, teacherId);

      const { data: exams, error: eErr } = await supabase
        .from("exams")
        .select("*")
        .eq("teacher_id", teacherId)
        .order("updated_at", { ascending: false });
      if (eErr) throw new Error(eErr.message);

      const examIds = (exams || []).map((e) => e.id);
      let pendingGrading = 0;
      if (examIds.length > 0) {
        const { data: attempts, error: aErr } = await supabase
          .from("attempts")
          .select("status")
          .in("exam_id", examIds)
          .eq("status", "submitted");
        if (aErr) throw new Error(aErr.message);
        pendingGrading = (attempts || []).length;
      }
      return res.status(200).json({ exams: exams || [], pendingGrading });
    }

    return res.status(405).json({ error: "Method Not Allowed" });
  } catch (e) {
    return res.status(500).json({ error: e.message || "教师接口失败" });
  }
}
