import { createClient } from "@supabase/supabase-js";

function buildAuthEmail(role, schoolNo) {
  const safeRole = String(role || "").trim().toLowerCase();
  const safeSchoolNo = String(schoolNo || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "_");
  return `${safeRole}.${safeSchoolNo}@oex.local`;
}

function assertStrongPassword(password) {
  const value = String(password || "");
  const valid =
    value.length >= 12 &&
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /[0-9]/.test(value) &&
    /[^A-Za-z0-9]/.test(value);
  if (!valid) {
    throw new Error("SEED_DEFAULT_PASSWORD 不满足密码策略（至少12位，且包含大小写字母、数字、特殊字符）");
  }
}

function extractProjectRef(supabaseUrl) {
  const match = /^https:\/\/([a-z0-9-]+)\.supabase\.co/i.exec(String(supabaseUrl || ""));
  return match?.[1] || "";
}

function asIsoMinutesFromNow(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

const ENV = {
  SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
  SEED_ENV: process.env.SEED_ENV,
  SEED_CONFIRM: process.env.SEED_CONFIRM,
  SEED_ALLOWED_PROJECT_REF: process.env.SEED_ALLOWED_PROJECT_REF,
  SEED_DEFAULT_PASSWORD: process.env.SEED_DEFAULT_PASSWORD || "OexTest#2026!A1",
};

if (!ENV.SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("缺少 SUPABASE_URL/VITE_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

if (ENV.SEED_ENV !== "test") {
  console.error("安全保护：仅允许在测试环境执行。请设置 SEED_ENV=test");
  process.exit(1);
}

if (ENV.SEED_CONFIRM !== "I_UNDERSTAND_THIS_WILL_WRITE_DATA") {
  console.error("安全保护：请设置 SEED_CONFIRM=I_UNDERSTAND_THIS_WILL_WRITE_DATA 后重试");
  process.exit(1);
}

const projectRef = extractProjectRef(ENV.SUPABASE_URL);
if (!projectRef) {
  console.error("无法从 SUPABASE_URL 解析 project ref，已中止");
  process.exit(1);
}
if (!ENV.SEED_ALLOWED_PROJECT_REF) {
  console.error("安全保护：请设置 SEED_ALLOWED_PROJECT_REF 为测试项目的 ref");
  process.exit(1);
}
if (ENV.SEED_ALLOWED_PROJECT_REF !== projectRef) {
  console.error(`安全保护：project ref 不匹配，当前=${projectRef}，允许=${ENV.SEED_ALLOWED_PROJECT_REF}`);
  process.exit(1);
}

assertStrongPassword(ENV.SEED_DEFAULT_PASSWORD);

const admin = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const anon = ENV.SUPABASE_ANON_KEY
  ? createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  : null;

const IDS = {
  users: {
    adminSuper: "00000000-0000-4000-8000-000000000001",
    adminOps: "00000000-0000-4000-8000-000000000002",
    teacherMath: "10000000-0000-4000-8000-000000000001",
    teacherEnglish: "10000000-0000-4000-8000-000000000002",
    teacherPhysics: "10000000-0000-4000-8000-000000000003",
    studentA: "20000000-0000-4000-8000-000000000001",
    studentB: "20000000-0000-4000-8000-000000000002",
    studentC: "20000000-0000-4000-8000-000000000003",
    studentD: "20000000-0000-4000-8000-000000000004",
    studentE: "20000000-0000-4000-8000-000000000005",
    studentF: "20000000-0000-4000-8000-000000000006",
  },
  classes: {
    class7_1: "30000000-0000-4000-8000-000000000001",
    class7_2: "30000000-0000-4000-8000-000000000002",
    class8_1: "30000000-0000-4000-8000-000000000003",
  },
  questions: {
    qMathSingle: "40000000-0000-4000-8000-000000000001",
    qMathTrueFalse: "40000000-0000-4000-8000-000000000002",
    qEnglishSingle: "40000000-0000-4000-8000-000000000003",
    qPhysicsBlank: "40000000-0000-4000-8000-000000000004",
  },
  exams: {
    examMath: "50000000-0000-4000-8000-000000000001",
    examEnglish: "50000000-0000-4000-8000-000000000002",
    examPhysics: "50000000-0000-4000-8000-000000000003",
  },
  messages: {
    msgAll: "60000000-0000-4000-8000-000000000001",
    msgSpecific: "60000000-0000-4000-8000-000000000002",
  },
  examQuestions: {
    eqMath1: "70000000-0000-4000-8000-000000000001",
    eqMath2: "70000000-0000-4000-8000-000000000002",
    eqEnglish1: "70000000-0000-4000-8000-000000000003",
    eqPhysics1: "70000000-0000-4000-8000-000000000004",
  },
  examAssignments: {
    ea1: "80000000-0000-4000-8000-000000000001",
    ea2: "80000000-0000-4000-8000-000000000002",
    ea3: "80000000-0000-4000-8000-000000000003",
    ea4: "80000000-0000-4000-8000-000000000004",
    ea5: "80000000-0000-4000-8000-000000000005",
    ea6: "80000000-0000-4000-8000-000000000006",
    ea7: "80000000-0000-4000-8000-000000000007",
  },
  attempts: {
    at1: "90000000-0000-4000-8000-000000000001",
    at2: "90000000-0000-4000-8000-000000000002",
  },
  attemptAnswers: {
    aa1: "a0000000-0000-4000-8000-000000000001",
    aa2: "a0000000-0000-4000-8000-000000000002",
    aa3: "a0000000-0000-4000-8000-000000000003",
  },
};

const nowIso = new Date().toISOString();
const examMathStart = asIsoMinutesFromNow(-60);
const examMathEnd = asIsoMinutesFromNow(60);
const examEnglishStart = asIsoMinutesFromNow(30);
const examEnglishEnd = asIsoMinutesFromNow(180);
const examPhysicsStart = asIsoMinutesFromNow(-1440);
const examPhysicsEnd = asIsoMinutesFromNow(-1380);

const users = [
  {
    id: IDS.users.adminSuper,
    role: "admin",
    school_no: "admin",
    display_name: "系统管理员",
    phone: "18800000000",
    age: 30,
    gender: "other",
    status: "active",
    avatar_url: null,
    grade_level: null,
    subject_id: null,
    class_id: null,
    created_at: nowIso,
  },
  {
    id: IDS.users.adminOps,
    role: "admin",
    school_no: "A10002",
    display_name: "运营管理员",
    phone: "18800000009",
    age: 29,
    gender: "female",
    status: "active",
    avatar_url: null,
    grade_level: null,
    subject_id: null,
    class_id: null,
    created_at: nowIso,
  },
  {
    id: IDS.users.teacherMath,
    role: "teacher",
    school_no: "T10001",
    display_name: "张老师(数学)",
    phone: "18800000001",
    age: 35,
    gender: "male",
    status: "active",
    avatar_url: null,
    grade_level: 7,
    subject_id: "math",
    class_id: null,
    created_at: nowIso,
  },
  {
    id: IDS.users.teacherEnglish,
    role: "teacher",
    school_no: "T10002",
    display_name: "李老师(英语)",
    phone: "18800000002",
    age: 33,
    gender: "female",
    status: "active",
    avatar_url: null,
    grade_level: 7,
    subject_id: "english",
    class_id: null,
    created_at: nowIso,
  },
  {
    id: IDS.users.teacherPhysics,
    role: "teacher",
    school_no: "T10003",
    display_name: "王老师(物理)",
    phone: "18800000003",
    age: 37,
    gender: "male",
    status: "active",
    avatar_url: null,
    grade_level: 8,
    subject_id: "physics",
    class_id: null,
    created_at: nowIso,
  },
  {
    id: IDS.users.studentA,
    role: "student",
    school_no: "S20230001",
    display_name: "学生甲",
    phone: "18800000011",
    age: 13,
    gender: "male",
    status: "active",
    avatar_url: null,
    grade_level: 7,
    subject_id: null,
    class_id: IDS.classes.class7_1,
    created_at: nowIso,
  },
  {
    id: IDS.users.studentB,
    role: "student",
    school_no: "S20230002",
    display_name: "学生乙",
    phone: "18800000012",
    age: 13,
    gender: "female",
    status: "active",
    avatar_url: null,
    grade_level: 7,
    subject_id: null,
    class_id: IDS.classes.class7_1,
    created_at: nowIso,
  },
  {
    id: IDS.users.studentC,
    role: "student",
    school_no: "S20230003",
    display_name: "学生丙",
    phone: "18800000013",
    age: 13,
    gender: "male",
    status: "active",
    avatar_url: null,
    grade_level: 7,
    subject_id: null,
    class_id: IDS.classes.class7_2,
    created_at: nowIso,
  },
  {
    id: IDS.users.studentD,
    role: "student",
    school_no: "S20230004",
    display_name: "学生丁",
    phone: "18800000014",
    age: 13,
    gender: "female",
    status: "active",
    avatar_url: null,
    grade_level: 7,
    subject_id: null,
    class_id: IDS.classes.class7_2,
    created_at: nowIso,
  },
  {
    id: IDS.users.studentE,
    role: "student",
    school_no: "S20240001",
    display_name: "学生戊",
    phone: "18800000015",
    age: 14,
    gender: "male",
    status: "active",
    avatar_url: null,
    grade_level: 8,
    subject_id: null,
    class_id: IDS.classes.class8_1,
    created_at: nowIso,
  },
  {
    id: IDS.users.studentF,
    role: "student",
    school_no: "S20240002",
    display_name: "学生己(禁用)",
    phone: "18800000016",
    age: 14,
    gender: "female",
    status: "disabled",
    avatar_url: null,
    grade_level: 8,
    subject_id: null,
    class_id: IDS.classes.class8_1,
    created_at: nowIso,
  },
];

const classes = [
  {
    id: IDS.classes.class7_1,
    name: "七年级1班",
    grade_level: 7,
    teacher_id: IDS.users.teacherMath,
    created_at: nowIso,
  },
  {
    id: IDS.classes.class7_2,
    name: "七年级2班",
    grade_level: 7,
    teacher_id: IDS.users.teacherEnglish,
    created_at: nowIso,
  },
  {
    id: IDS.classes.class8_1,
    name: "八年级1班",
    grade_level: 8,
    teacher_id: IDS.users.teacherPhysics,
    created_at: nowIso,
  },
];

const questions = [
  {
    id: IDS.questions.qMathSingle,
    teacher_id: IDS.users.teacherMath,
    type: "single",
    stem: [{ type: "text", text: "下列结果正确的是：2 + 2 = ?" }],
    options: [
      { id: "A", text: "3" },
      { id: "B", text: "4" },
      { id: "C", text: "5" },
      { id: "D", text: "6" },
    ],
    answer_key: "B",
    default_score: 5,
    grade_level: 7,
    subject_id: "math",
    analysis: "基础运算题",
    difficulty: 1,
    created_at: nowIso,
    updated_at: nowIso,
  },
  {
    id: IDS.questions.qMathTrueFalse,
    teacher_id: IDS.users.teacherMath,
    type: "true_false",
    stem: [{ type: "text", text: "判断：任意奇数与偶数之和是奇数。" }],
    options: null,
    answer_key: true,
    default_score: 5,
    grade_level: 7,
    subject_id: "math",
    analysis: "奇偶性基础概念",
    difficulty: 2,
    created_at: nowIso,
    updated_at: nowIso,
  },
  {
    id: IDS.questions.qEnglishSingle,
    teacher_id: IDS.users.teacherEnglish,
    type: "single",
    stem: [{ type: "text", text: "Choose the correct word: I ___ a student." }],
    options: [
      { id: "A", text: "am" },
      { id: "B", text: "is" },
      { id: "C", text: "are" },
      { id: "D", text: "be" },
    ],
    answer_key: "A",
    default_score: 5,
    grade_level: 7,
    subject_id: "english",
    analysis: "主系表结构",
    difficulty: 1,
    created_at: nowIso,
    updated_at: nowIso,
  },
  {
    id: IDS.questions.qPhysicsBlank,
    teacher_id: IDS.users.teacherPhysics,
    type: "blank",
    stem: [{ type: "text", text: "速度的国际单位是 ____ 。" }],
    options: null,
    answer_key: ["m/s", "米每秒"],
    default_score: 10,
    grade_level: 8,
    subject_id: "physics",
    analysis: "基础物理单位",
    difficulty: 2,
    created_at: nowIso,
    updated_at: nowIso,
  },
];

const exams = [
  {
    id: IDS.exams.examMath,
    teacher_id: IDS.users.teacherMath,
    title: "七年级数学周测",
    description: "覆盖有理数与基础运算",
    status: "published",
    duration_minutes: 45,
    grade_level: 7,
    subject_id: "math",
    start_at: examMathStart,
    end_at: examMathEnd,
    attempt_limit: 1,
    shuffle_questions: false,
    assigned_class_ids: [IDS.classes.class7_1, IDS.classes.class7_2],
    created_at: nowIso,
    updated_at: nowIso,
  },
  {
    id: IDS.exams.examEnglish,
    teacher_id: IDS.users.teacherEnglish,
    title: "七年级英语单元测",
    description: "基础语法与词汇",
    status: "draft",
    duration_minutes: 40,
    grade_level: 7,
    subject_id: "english",
    start_at: examEnglishStart,
    end_at: examEnglishEnd,
    attempt_limit: 1,
    shuffle_questions: true,
    assigned_class_ids: [IDS.classes.class7_1],
    created_at: nowIso,
    updated_at: nowIso,
  },
  {
    id: IDS.exams.examPhysics,
    teacher_id: IDS.users.teacherPhysics,
    title: "八年级物理月考",
    description: "力学与单位",
    status: "closed",
    duration_minutes: 60,
    grade_level: 8,
    subject_id: "physics",
    start_at: examPhysicsStart,
    end_at: examPhysicsEnd,
    attempt_limit: 2,
    shuffle_questions: false,
    assigned_class_ids: [IDS.classes.class8_1],
    created_at: nowIso,
    updated_at: nowIso,
  },
];

const examQuestions = [
  { id: IDS.examQuestions.eqMath1, exam_id: IDS.exams.examMath, question_id: IDS.questions.qMathSingle, sort_order: 1, score: 50 },
  { id: IDS.examQuestions.eqMath2, exam_id: IDS.exams.examMath, question_id: IDS.questions.qMathTrueFalse, sort_order: 2, score: 50 },
  { id: IDS.examQuestions.eqEnglish1, exam_id: IDS.exams.examEnglish, question_id: IDS.questions.qEnglishSingle, sort_order: 1, score: 100 },
  { id: IDS.examQuestions.eqPhysics1, exam_id: IDS.exams.examPhysics, question_id: IDS.questions.qPhysicsBlank, sort_order: 1, score: 100 },
];

const examAssignments = [
  { id: IDS.examAssignments.ea1, exam_id: IDS.exams.examMath, student_id: IDS.users.studentA, created_at: nowIso },
  { id: IDS.examAssignments.ea2, exam_id: IDS.exams.examMath, student_id: IDS.users.studentB, created_at: nowIso },
  { id: IDS.examAssignments.ea3, exam_id: IDS.exams.examMath, student_id: IDS.users.studentC, created_at: nowIso },
  { id: IDS.examAssignments.ea4, exam_id: IDS.exams.examMath, student_id: IDS.users.studentD, created_at: nowIso },
  { id: IDS.examAssignments.ea5, exam_id: IDS.exams.examEnglish, student_id: IDS.users.studentA, created_at: nowIso },
  { id: IDS.examAssignments.ea6, exam_id: IDS.exams.examPhysics, student_id: IDS.users.studentE, created_at: nowIso },
  { id: IDS.examAssignments.ea7, exam_id: IDS.exams.examPhysics, student_id: IDS.users.studentF, created_at: nowIso },
];

const attempts = [
  {
    id: IDS.attempts.at1,
    exam_id: IDS.exams.examMath,
    student_id: IDS.users.studentA,
    status: "submitted",
    started_at: asIsoMinutesFromNow(-40),
    submitted_at: asIsoMinutesFromNow(-10),
    total_score: 95,
    score_published: true,
  },
  {
    id: IDS.attempts.at2,
    exam_id: IDS.exams.examPhysics,
    student_id: IDS.users.studentE,
    status: "graded",
    started_at: asIsoMinutesFromNow(-1430),
    submitted_at: asIsoMinutesFromNow(-1410),
    total_score: 88,
    score_published: true,
  },
];

const attemptAnswers = [
  {
    id: IDS.attemptAnswers.aa1,
    attempt_id: IDS.attempts.at1,
    question_id: IDS.questions.qMathSingle,
    answer: "B",
    auto_score: 50,
    manual_score: 0,
    teacher_comment: null,
    updated_at: nowIso,
  },
  {
    id: IDS.attemptAnswers.aa2,
    attempt_id: IDS.attempts.at1,
    question_id: IDS.questions.qMathTrueFalse,
    answer: true,
    auto_score: 45,
    manual_score: 0,
    teacher_comment: "计算过程可再规范",
    updated_at: nowIso,
  },
  {
    id: IDS.attemptAnswers.aa3,
    attempt_id: IDS.attempts.at2,
    question_id: IDS.questions.qPhysicsBlank,
    answer: ["米每秒"],
    auto_score: 80,
    manual_score: 8,
    teacher_comment: "单位书写正确",
    updated_at: nowIso,
  },
];

const messages = [
  {
    id: IDS.messages.msgAll,
    teacher_id: IDS.users.teacherMath,
    title: "周测通知",
    content: "请同学们在今天晚自习前完成周测。",
    target: { type: "all_students" },
    created_at: nowIso,
  },
  {
    id: IDS.messages.msgSpecific,
    teacher_id: IDS.users.teacherEnglish,
    title: "英语补测提醒",
    content: "请指定同学按时参加补测。",
    target: { type: "students", studentIds: [IDS.users.studentA, IDS.users.studentC] },
    created_at: nowIso,
  },
];

async function upsert(table, rows, onConflict) {
  if (!rows || rows.length === 0) return;
  const { error } = await admin.from(table).upsert(rows, { onConflict });
  if (error) {
    throw new Error(`${table} upsert 失败: ${error.message}`);
  }
  console.log(`[ok] ${table}: ${rows.length}`);
}

async function ensureAuthUsers() {
  let created = 0;
  let updated = 0;
  for (const user of users) {
    const email = buildAuthEmail(user.role, user.school_no);
    const metadata = {
      role: user.role,
      schoolNo: user.school_no,
      displayName: user.display_name,
    };

    const { data: got, error: getErr } = await admin.auth.admin.getUserById(user.id);
    if (!getErr && got?.user) {
      const { error: upErr } = await admin.auth.admin.updateUserById(user.id, {
        email,
        password: ENV.SEED_DEFAULT_PASSWORD,
        user_metadata: metadata,
      });
      if (upErr) throw new Error(`更新 auth.users 失败(${user.school_no}): ${upErr.message}`);
      updated++;
      continue;
    }

    const { error: createErr } = await admin.auth.admin.createUser({
      id: user.id,
      email,
      password: ENV.SEED_DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: metadata,
    });
    if (createErr) throw new Error(`创建 auth.users 失败(${user.school_no}): ${createErr.message}`);
    created++;
  }
  console.log(`[ok] auth.users created=${created}, updated=${updated}`);
}

async function verifyRows(table, ids) {
  const { count, error } = await admin
    .from(table)
    .select("id", { count: "exact", head: true })
    .in("id", ids);
  if (error) throw new Error(`校验 ${table} 失败: ${error.message}`);
  if (Number(count || 0) !== ids.length) {
    throw new Error(`校验 ${table} 数量异常: 期望 ${ids.length}，实际 ${count || 0}`);
  }
  console.log(`[verify] ${table}: ${count}/${ids.length}`);
}

async function verifyLogins() {
  if (!anon) {
    console.warn("[warn] 未设置 VITE_SUPABASE_ANON_KEY，跳过登录校验");
    return;
  }
  const samples = [
    { role: "admin", schoolNo: "admin", expectedStatus: "active" },
    { role: "teacher", schoolNo: "T10001", expectedStatus: "active" },
    { role: "student", schoolNo: "S20230001", expectedStatus: "active" },
  ];

  for (const sample of samples) {
    const email = buildAuthEmail(sample.role, sample.schoolNo);
    const { data, error } = await anon.auth.signInWithPassword({
      email,
      password: ENV.SEED_DEFAULT_PASSWORD,
    });
    if (error || !data.user) {
      throw new Error(`登录校验失败(${sample.role}/${sample.schoolNo}): ${error?.message || "unknown error"}`);
    }
    const { data: row, error: rowErr } = await admin
      .from("users")
      .select("id, role, status, school_no")
      .eq("id", data.user.id)
      .single();
    if (rowErr || !row) {
      throw new Error(`登录后业务用户校验失败(${sample.schoolNo}): ${rowErr?.message || "not found"}`);
    }
    if (row.role !== sample.role || row.status !== sample.expectedStatus) {
      throw new Error(`登录后角色/状态不符合预期(${sample.schoolNo})`);
    }
    await anon.auth.signOut();
    console.log(`[verify-login] ${sample.role}/${sample.schoolNo} ok`);
  }
}

async function verifyDisabledUserCannotLogin() {
  if (!anon) return;
  const email = buildAuthEmail("student", "S20240002");
  const { data, error } = await anon.auth.signInWithPassword({
    email,
    password: ENV.SEED_DEFAULT_PASSWORD,
  });
  if (error || !data.user) {
    throw new Error("禁用用户基础登录失败，无法验证业务层禁用逻辑");
  }
  const { data: row, error: rowErr } = await admin
    .from("users")
    .select("status")
    .eq("id", data.user.id)
    .single();
  await anon.auth.signOut();
  if (rowErr || !row) throw new Error("禁用用户状态校验失败");
  if (row.status !== "disabled") throw new Error("禁用用户状态不正确");
  console.log("[verify] disabled user status=disabled");
}

async function seed() {
  console.log(`[seed] project_ref=${projectRef}`);
  console.log(`[seed] total users=${users.length} (admin/teacher/student 2/3/6)`);

  await ensureAuthUsers();
  await upsert("classes", classes, "id");
  await upsert("users", users, "id");
  await upsert("questions", questions, "id");
  await upsert("exams", exams, "id");
  await upsert("exam_questions", examQuestions, "id");
  await upsert("exam_assignments", examAssignments, "id");
  await upsert("attempts", attempts, "id");
  await upsert("attempt_answers", attemptAnswers, "id");
  await upsert("messages", messages, "id");

  await verifyRows("users", users.map((x) => x.id));
  await verifyRows("classes", classes.map((x) => x.id));
  await verifyRows("questions", questions.map((x) => x.id));
  await verifyRows("exams", exams.map((x) => x.id));
  await verifyRows("exam_questions", examQuestions.map((x) => x.id));
  await verifyRows("exam_assignments", examAssignments.map((x) => x.id));
  await verifyRows("attempts", attempts.map((x) => x.id));
  await verifyRows("attempt_answers", attemptAnswers.map((x) => x.id));
  await verifyRows("messages", messages.map((x) => x.id));

  await verifyLogins();
  await verifyDisabledUserCannotLogin();

  console.log("[done] 测试数据初始化与校验完成");
  console.log(`[done] 统一初始密码: ${ENV.SEED_DEFAULT_PASSWORD}`);
}

seed().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
