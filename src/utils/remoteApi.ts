import type { Attempt, AttemptAnswer, Class, Exam, ExamQuestion, Message, Question, User, UserRole } from "@/types/domain";
import { supabase } from "@/lib/supabase";
import { buildAuthEmail } from "@/utils/authIdentity";

function getSupabaseClient() {
  if (!supabase) {
    throw new Error("系统未配置 Supabase，请检查 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY，并重启前端服务");
  }
  return supabase;
}

function mapUserFromApi(u: any): User {
  return {
    id: u.id,
    role: u.role,
    phone: u.phone || "",
    schoolNo: u.school_no,
    password: "",
    displayName: u.display_name,
    age: u.age ?? undefined,
    gender: u.gender ?? undefined,
    status: u.status,
    avatarUrl: u.avatar_url ?? undefined,
    gradeLevel: u.grade_level ?? undefined,
    subjectId: u.subject_id ?? undefined,
    classId: u.class_id ?? undefined,
    createdAt: u.created_at,
  };
}

function mapClassFromApi(c: any): Class {
  return {
    id: c.id,
    name: c.name,
    gradeLevel: c.grade_level,
    teacherId: c.teacher_id ?? undefined,
    createdAt: c.created_at,
  };
}

async function requestJson(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `请求失败: ${res.status}`);
  }
  return data;
}

export async function loginRemote(args: {
  role: UserRole;
  schoolNo: string;
  password: string;
}): Promise<User> {
  const client = getSupabaseClient();
  const email = buildAuthEmail(args.role, args.schoolNo);
  const { data: authData, error: authError } = await client.auth.signInWithPassword({
    email,
    password: args.password,
  });
  if (authError || !authData.user) {
    throw new Error("账号或密码不正确");
  }

  const { data: userRow, error: userError } = await client
    .from("users")
    .select("*")
    .eq("id", authData.user.id)
    .single();
  if (userError || !userRow) {
    await client.auth.signOut();
    throw new Error("用户业务信息不存在，请联系管理员");
  }
  const me = mapUserFromApi(userRow);
  if (me.role !== args.role) {
    await client.auth.signOut();
    throw new Error("角色不匹配");
  }
  if (me.status === "disabled") {
    await client.auth.signOut();
    throw new Error("该账号已被禁用，请联系管理员");
  }
  return me;
}

export async function registerRemote(args: {
  role: UserRole;
  schoolNo: string;
  password: string;
  displayName: string;
}): Promise<User> {
  const client = getSupabaseClient();
  const email = buildAuthEmail(args.role, args.schoolNo);
  const { error: signUpError } = await client.auth.signUp({
    email,
    password: args.password,
    options: {
      data: {
        role: args.role,
        schoolNo: args.schoolNo,
        displayName: args.displayName,
      },
    },
  });
  if (signUpError) {
    throw new Error(signUpError.message || "注册失败");
  }
  return loginRemote({
    role: args.role,
    schoolNo: args.schoolNo,
    password: args.password,
  });
}

export async function logoutRemote(): Promise<void> {
  const client = getSupabaseClient();
  await client.auth.signOut();
}

export async function adminListUsersRemote(adminId: string, role?: UserRole): Promise<User[]> {
  const roleQuery = role ? `&role=${encodeURIComponent(role)}` : "";
  const data = await requestJson(`/api/admin?resource=users&adminId=${encodeURIComponent(adminId)}${roleQuery}`);
  return (data.users || []).map(mapUserFromApi);
}

export async function adminListClassesRemote(adminId: string): Promise<Class[]> {
  const data = await requestJson(`/api/admin?resource=classes&adminId=${encodeURIComponent(adminId)}`);
  return (data.classes || []).map(mapClassFromApi);
}

export async function adminUpsertUserRemote(
  adminId: string,
  user: Partial<User> & { role: User["role"] },
) {
  await requestJson("/api/admin?resource=users", {
    method: "POST",
    body: JSON.stringify({ adminId, user }),
  });
}

export async function adminDeleteUserRemote(adminId: string, userId: string) {
  await requestJson("/api/admin?resource=users", {
    method: "DELETE",
    body: JSON.stringify({ adminId, userId }),
  });
}

export async function adminBatchUpdateUserStatusRemote(
  adminId: string,
  userIds: string[],
  status: "active" | "disabled",
) {
  await requestJson("/api/admin?resource=users", {
    method: "PATCH",
    body: JSON.stringify({ adminId, userIds, status }),
  });
}

export async function adminUpsertClassRemote(adminId: string, cls: Partial<Class>) {
  await requestJson("/api/admin?resource=classes", {
    method: "POST",
    body: JSON.stringify({ adminId, cls }),
  });
}

export async function adminDeleteClassRemote(adminId: string, classId: string) {
  await requestJson("/api/admin?resource=classes", {
    method: "DELETE",
    body: JSON.stringify({ adminId, classId }),
  });
}

export async function adminGetStatsRemote(adminId: string): Promise<{
  studentCount: number;
  teacherCount: number;
  adminCount: number;
}> {
  const data = await requestJson(`/api/admin?resource=stats&adminId=${encodeURIComponent(adminId)}`);
  return {
    studentCount: Number(data.studentCount || 0),
    teacherCount: Number(data.teacherCount || 0),
    adminCount: Number(data.adminCount || 0),
  };
}

function mapQuestionFromApi(q: any): Question {
  return {
    id: q.id,
    teacherId: q.teacher_id,
    type: q.type,
    stem: q.stem || [],
    options: q.options ?? undefined,
    answerKey: q.answer_key ?? null,
    defaultScore: q.default_score,
    gradeLevel: q.grade_level ?? undefined,
    subjectId: q.subject_id ?? undefined,
    analysis: q.analysis ?? undefined,
    difficulty: q.difficulty ?? undefined,
    createdAt: q.created_at,
    updatedAt: q.updated_at,
  };
}

export async function teacherListQuestionsRemote(teacherId: string): Promise<Question[]> {
  const data = await requestJson(`/api/teacher?resource=questions&teacherId=${encodeURIComponent(teacherId)}`);
  return (data.questions || []).map(mapQuestionFromApi);
}

export async function teacherUpsertQuestionRemote(teacherId: string, question: Partial<Question>) {
  await requestJson("/api/teacher?resource=questions", {
    method: "POST",
    body: JSON.stringify({ teacherId, question }),
  });
}

export async function teacherDeleteQuestionRemote(teacherId: string, questionId: string) {
  await requestJson("/api/teacher?resource=questions", {
    method: "DELETE",
    body: JSON.stringify({ teacherId, questionId }),
  });
}

export async function teacherDeleteQuestionsRemote(teacherId: string, questionIds: string[]) {
  await requestJson("/api/teacher?resource=questions", {
    method: "PATCH",
    body: JSON.stringify({ teacherId, questionIds }),
  });
}

function mapExamFromApi(e: any): Exam {
  return {
    id: e.id,
    teacherId: e.teacher_id,
    title: e.title,
    description: e.description ?? undefined,
    status: e.status,
    durationMinutes: e.duration_minutes,
    gradeLevel: e.grade_level ?? undefined,
    subjectId: e.subject_id ?? undefined,
    startAt: e.start_at ?? undefined,
    endAt: e.end_at ?? undefined,
    attemptLimit: e.attempt_limit,
    shuffleQuestions: Boolean(e.shuffle_questions),
    assignedClassIds: e.assigned_class_ids ?? undefined,
    createdAt: e.created_at,
    updatedAt: e.updated_at,
  };
}

function mapExamQuestionFromApi(eq: any): ExamQuestion {
  return {
    id: eq.id,
    examId: eq.exam_id,
    questionId: eq.question_id,
    sortOrder: eq.sort_order,
    score: eq.score,
  };
}

function mapAttemptFromApi(a: any): Attempt {
  return {
    id: a.id,
    examId: a.exam_id,
    studentId: a.student_id,
    status: a.status,
    startedAt: a.started_at,
    submittedAt: a.submitted_at ?? undefined,
    totalScore: Number(a.total_score || 0),
    scorePublished: Boolean(a.score_published),
  };
}

function mapAttemptAnswerFromApi(a: any): AttemptAnswer {
  return {
    id: a.id,
    attemptId: a.attempt_id,
    questionId: a.question_id,
    answer: a.answer,
    autoScore: Number(a.auto_score || 0),
    manualScore: Number(a.manual_score || 0),
    teacherComment: a.teacher_comment ?? undefined,
    updatedAt: a.updated_at,
  };
}

function mapMessageFromApi(m: any): Message {
  return {
    id: m.id,
    teacherId: m.teacher_id,
    title: m.title,
    content: m.content,
    target: m.target,
    createdAt: m.created_at,
  };
}

export async function teacherListExamsRemote(teacherId: string): Promise<{
  exams: Exam[];
  assignmentCounts: Map<string, number>;
}> {
  const data = await requestJson(`/api/teacher?resource=exams&teacherId=${encodeURIComponent(teacherId)}`);
  const counts = new Map<string, number>();
  const rawCounts = data.assignmentCounts || {};
  Object.keys(rawCounts).forEach((k) => counts.set(k, Number(rawCounts[k] || 0)));
  return {
    exams: (data.exams || []).map(mapExamFromApi),
    assignmentCounts: counts,
  };
}

export async function teacherUpsertExamRemote(teacherId: string, exam: Partial<Exam> & Pick<Exam, "title" | "durationMinutes">) {
  const data = await requestJson("/api/teacher?resource=exams", {
    method: "POST",
    body: JSON.stringify({ teacherId, exam }),
  });
  return { id: data.id as string };
}

export async function teacherDeleteExamRemote(teacherId: string, examId: string) {
  await requestJson("/api/teacher?resource=exams", {
    method: "DELETE",
    body: JSON.stringify({ teacherId, examId }),
  });
}

export async function teacherListClassesRemote(teacherId: string): Promise<Class[]> {
  const data = await requestJson(`/api/teacher?resource=classes&teacherId=${encodeURIComponent(teacherId)}`);
  return (data.classes || []).map(mapClassFromApi);
}

export async function teacherGetExamDetailRemote(teacherId: string, examId: string): Promise<{
  exam: Exam;
  questions: Question[];
  examQuestions: ExamQuestion[];
  classes: Class[];
}> {
  const data = await requestJson(
    `/api/teacher?resource=exam-detail&teacherId=${encodeURIComponent(teacherId)}&examId=${encodeURIComponent(examId)}`,
  );
  return {
    exam: mapExamFromApi(data.exam),
    questions: (data.questions || []).map(mapQuestionFromApi),
    examQuestions: (data.examQuestions || []).map(mapExamQuestionFromApi),
    classes: (data.classes || []).map(mapClassFromApi),
  };
}

export async function teacherSetExamQuestionsRemote(
  teacherId: string,
  examId: string,
  items: { questionId: string; score: number }[],
) {
  await requestJson("/api/teacher?resource=exam-content", {
    method: "POST",
    body: JSON.stringify({ teacherId, examId, items }),
  });
}

export async function teacherSetExamAssignmentsRemote(
  teacherId: string,
  examId: string,
  classIds: string[],
) {
  await requestJson("/api/teacher?resource=exam-content", {
    method: "POST",
    body: JSON.stringify({ teacherId, examId, classIds }),
  });
}

export async function teacherListAttemptsForExamRemote(teacherId: string, examId: string): Promise<{
  exam: Exam;
  attempts: Attempt[];
  studentsById: Map<string, User>;
}> {
  const data = await requestJson(
    `/api/teacher?resource=grading&teacherId=${encodeURIComponent(teacherId)}&examId=${encodeURIComponent(examId)}`,
  );
  const studentsById = new Map<string, User>();
  (data.students || []).map(mapUserFromApi).forEach((u: User) => studentsById.set(u.id, u));
  return {
    exam: mapExamFromApi(data.exam),
    attempts: (data.attempts || []).map(mapAttemptFromApi),
    studentsById,
  };
}

export async function teacherGetGradingAttemptDetailRemote(
  teacherId: string,
  attemptId: string,
): Promise<{
  attempt: Attempt;
  exam: Exam;
  student: User | null;
  questions: { eq: ExamQuestion; q: Question }[];
  byQ: Map<string, AttemptAnswer>;
}> {
  const data = await requestJson(
    `/api/teacher?resource=grading&teacherId=${encodeURIComponent(teacherId)}&attemptId=${encodeURIComponent(attemptId)}`,
  );
  const attempt = mapAttemptFromApi(data.attempt);
  const exam = mapExamFromApi(data.exam);
  const student = data.student ? mapUserFromApi(data.student) : null;
  const eqRows = (data.examQuestions || []).map(mapExamQuestionFromApi);
  const qMap = new Map((data.questions || []).map((q: any) => {
    const mapped = mapQuestionFromApi(q);
    return [mapped.id, mapped] as const;
  }));
  const questions = eqRows
    .map((eq) => ({ eq, q: qMap.get(eq.questionId) }))
    .filter((x): x is { eq: ExamQuestion; q: Question } => Boolean(x.q));
  const answers: AttemptAnswer[] = (data.answers || []).map(mapAttemptAnswerFromApi);
  const byQ = new Map<string, AttemptAnswer>(answers.map((a) => [a.questionId, a]));
  return { attempt, exam, student, questions, byQ };
}

export async function teacherSaveManualScoresRemote(
  teacherId: string,
  attemptId: string,
  patch: { questionId: string; manualScore: number; teacherComment?: string }[],
) {
  await requestJson("/api/teacher?resource=grading", {
    method: "POST",
    body: JSON.stringify({ teacherId, attemptId, patch }),
  });
}

export async function teacherSetScorePublishedRemote(
  teacherId: string,
  attemptId: string,
  scorePublished: boolean,
) {
  await requestJson("/api/teacher?resource=grading", {
    method: "PATCH",
    body: JSON.stringify({ teacherId, attemptId, scorePublished }),
  });
}

export async function studentListAssignedExamsRemote(studentId: string): Promise<Exam[]> {
  const data = await requestJson(`/api/student?resource=exams&studentId=${encodeURIComponent(studentId)}`);
  return (data.exams || []).map(mapExamFromApi);
}

export async function studentListAttemptsRemote(studentId: string): Promise<Attempt[]> {
  const data = await requestJson(`/api/student?resource=attempts&studentId=${encodeURIComponent(studentId)}`);
  return (data.attempts || []).map(mapAttemptFromApi);
}

export async function studentGetExamRemote(studentId: string, examId: string): Promise<{
  exam: Exam;
  questions: { eq: ExamQuestion; q: Question }[];
}> {
  const data = await requestJson(
    `/api/student?resource=exams&studentId=${encodeURIComponent(studentId)}&examId=${encodeURIComponent(examId)}`,
  );
  const exam = mapExamFromApi(data.exam);
  const eqRows = (data.examQuestions || []).map(mapExamQuestionFromApi);
  const qMap = new Map((data.questions || []).map((q: any) => {
    const mapped = mapQuestionFromApi(q);
    return [mapped.id, mapped] as const;
  }));
  const questions = eqRows
    .map((eq) => ({ eq, q: qMap.get(eq.questionId) }))
    .filter((x): x is { eq: ExamQuestion; q: Question } => Boolean(x.q));
  return { exam, questions };
}

export async function studentStartOrResumeAttemptRemote(studentId: string, examId: string): Promise<Attempt> {
  const data = await requestJson("/api/student?resource=exams", {
    method: "POST",
    body: JSON.stringify({ studentId, examId }),
  });
  return mapAttemptFromApi(data.attempt);
}

export async function studentGetAttemptDetailRemote(studentId: string, attemptId: string): Promise<{
  attempt: Attempt;
  exam: Exam;
  questions: { eq: ExamQuestion; q: Question }[];
  answers: AttemptAnswer[];
}> {
  const data = await requestJson(
    `/api/student?resource=attempts&studentId=${encodeURIComponent(studentId)}&attemptId=${encodeURIComponent(attemptId)}`,
  );
  const attempt = mapAttemptFromApi(data.attempt);
  const exam = mapExamFromApi(data.exam);
  const eqRows = (data.examQuestions || []).map(mapExamQuestionFromApi);
  const qMap = new Map((data.questions || []).map((q: any) => {
    const mapped = mapQuestionFromApi(q);
    return [mapped.id, mapped] as const;
  }));
  const questions = eqRows
    .map((eq) => ({ eq, q: qMap.get(eq.questionId) }))
    .filter((x): x is { eq: ExamQuestion; q: Question } => Boolean(x.q));
  const answers = (data.answers || []).map(mapAttemptAnswerFromApi);
  return { attempt, exam, questions, answers };
}

export async function studentSaveAnswerRemote(
  studentId: string,
  attemptId: string,
  questionId: string,
  answer: unknown,
) {
  await requestJson("/api/student?resource=attempts", {
    method: "POST",
    body: JSON.stringify({ studentId, attemptId, questionId, answer }),
  });
}

export async function studentSubmitAttemptRemote(studentId: string, attemptId: string) {
  await requestJson("/api/student?resource=attempts", {
    method: "PATCH",
    body: JSON.stringify({ studentId, attemptId }),
  });
}

export async function adminBatchImportUsersRemote(adminId: string, users: Partial<User>[]) {
  return requestJson("/api/admin?resource=users-import", {
    method: "POST",
    body: JSON.stringify({ adminId, users }),
  });
}

export async function teacherGetDashboardRemote(teacherId: string): Promise<{
  exams: Exam[];
  pendingGrading: number;
}> {
  const data = await requestJson(`/api/teacher?resource=dashboard&teacherId=${encodeURIComponent(teacherId)}`);
  return {
    exams: (data.exams || []).map(mapExamFromApi),
    pendingGrading: Number(data.pendingGrading || 0),
  };
}

export async function teacherListMessagesRemote(teacherId: string): Promise<{
  sent: Message[];
  students: User[];
}> {
  const data = await requestJson(`/api/teacher?resource=messages&teacherId=${encodeURIComponent(teacherId)}`);
  return {
    sent: (data.sent || []).map(mapMessageFromApi),
    students: (data.students || []).map(mapUserFromApi),
  };
}

export async function teacherSendMessageRemote(
  teacherId: string,
  payload: Omit<Message, "id" | "teacherId" | "createdAt">,
) {
  await requestJson("/api/teacher?resource=messages", {
    method: "POST",
    body: JSON.stringify({ teacherId, ...payload }),
  });
}

export async function studentListMessagesRemote(studentId: string): Promise<{
  messages: Message[];
  teachersById: Map<string, User>;
}> {
  const data = await requestJson(`/api/student?resource=messages&studentId=${encodeURIComponent(studentId)}`);
  const teachersById = new Map<string, User>();
  (data.teachers || []).map(mapUserFromApi).forEach((u: User) => teachersById.set(u.id, u));
  return {
    messages: (data.messages || []).map(mapMessageFromApi),
    teachersById,
  };
}
