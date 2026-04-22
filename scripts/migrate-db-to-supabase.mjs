import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const dbPath = path.join(process.cwd(), "db.json");
if (!fs.existsSync(dbPath)) {
  console.error("未找到 db.json");
  process.exit(1);
}

const raw = fs.readFileSync(dbPath, "utf8");
const db = JSON.parse(raw);
const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

const toUsers = (rows = []) => rows.map((u) => ({
  id: u.id,
  role: u.role,
  phone: u.phone || "",
  school_no: u.schoolNo,
  password: u.password,
  display_name: u.displayName,
  age: u.age ?? null,
  gender: u.gender ?? null,
  status: u.status,
  avatar_url: u.avatarUrl ?? null,
  grade_level: u.gradeLevel ?? null,
  subject_id: u.subjectId ?? null,
  class_id: u.classId ?? null,
  created_at: u.createdAt,
}));

const toClasses = (rows = []) => rows.map((c) => ({
  id: c.id,
  name: c.name,
  grade_level: c.gradeLevel,
  teacher_id: c.teacherId ?? null,
  created_at: c.createdAt,
}));

const toMessages = (rows = []) => rows.map((m) => ({
  id: m.id,
  teacher_id: m.teacherId,
  title: m.title,
  content: m.content,
  target: m.target,
  created_at: m.createdAt,
}));

const toQuestions = (rows = []) => rows.map((q) => ({
  id: q.id,
  teacher_id: q.teacherId,
  type: q.type,
  stem: q.stem,
  options: q.options ?? null,
  answer_key: q.answerKey ?? null,
  default_score: q.defaultScore,
  grade_level: q.gradeLevel ?? null,
  subject_id: q.subjectId ?? null,
  analysis: q.analysis ?? null,
  difficulty: q.difficulty ?? null,
  created_at: q.createdAt,
  updated_at: q.updatedAt,
}));

const toExams = (rows = []) => rows.map((e) => ({
  id: e.id,
  teacher_id: e.teacherId,
  title: e.title,
  description: e.description ?? null,
  status: e.status,
  duration_minutes: e.durationMinutes,
  grade_level: e.gradeLevel ?? null,
  subject_id: e.subjectId ?? null,
  start_at: e.startAt ?? null,
  end_at: e.endAt ?? null,
  attempt_limit: e.attemptLimit,
  shuffle_questions: Boolean(e.shuffleQuestions),
  assigned_class_ids: e.assignedClassIds ?? null,
  created_at: e.createdAt,
  updated_at: e.updatedAt,
}));

const toExamQuestions = (rows = []) => rows.map((x) => ({
  id: x.id,
  exam_id: x.examId,
  question_id: x.questionId,
  sort_order: x.sortOrder,
  score: x.score,
}));

const toExamAssignments = (rows = []) => rows.map((x) => ({
  id: x.id,
  exam_id: x.examId,
  student_id: x.studentId,
  created_at: x.createdAt,
}));

const toAttempts = (rows = []) => rows.map((x) => ({
  id: x.id,
  exam_id: x.examId,
  student_id: x.studentId,
  status: x.status,
  started_at: x.startedAt,
  submitted_at: x.submittedAt ?? null,
  total_score: x.totalScore ?? 0,
  score_published: Boolean(x.scorePublished),
}));

const toAttemptAnswers = (rows = []) => rows.map((x) => ({
  id: x.id,
  attempt_id: x.attemptId,
  question_id: x.questionId,
  answer: x.answer ?? null,
  auto_score: x.autoScore ?? 0,
  manual_score: x.manualScore ?? 0,
  teacher_comment: x.teacherComment ?? null,
  updated_at: x.updatedAt,
}));

async function upsert(table, rows, on) {
  if (!rows || rows.length === 0) return;
  const { error } = await supabase.from(table).upsert(rows, { onConflict: on });
  if (error) throw new Error(`${table} 导入失败: ${error.message}`);
  console.log(`已导入 ${table}: ${rows.length}`);
}

async function main() {
  await upsert("users", toUsers(db.users), "id");
  await upsert("classes", toClasses(db.classes), "id");
  await upsert("messages", toMessages(db.messages), "id");
  await upsert("questions", toQuestions(db.questions), "id");
  await upsert("exams", toExams(db.exams), "id");
  await upsert("exam_questions", toExamQuestions(db.examQuestions), "id");
  await upsert("exam_assignments", toExamAssignments(db.examAssignments), "id");
  await upsert("attempts", toAttempts(db.attempts), "id");
  await upsert("attempt_answers", toAttemptAnswers(db.attemptAnswers), "id");
  console.log("迁移完成");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
