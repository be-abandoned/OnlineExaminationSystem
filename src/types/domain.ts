export const SUBJECTS = [
  { id: "math", name: "数学" },
  { id: "chinese", name: "语文" },
  { id: "english", name: "英语" },
  { id: "physics", name: "物理" },
  { id: "chemistry", name: "化学" },
  { id: "biology", name: "生物" },
  { id: "history", name: "历史" },
  { id: "geography", name: "地理" },
  { id: "politics", name: "政治" },
];

export const GRADE_LEVELS = [
  { value: 1, label: "一年级" },
  { value: 2, label: "二年级" },
  { value: 3, label: "三年级" },
  { value: 4, label: "四年级" },
  { value: 5, label: "五年级" },
  { value: 6, label: "六年级" },
  { value: 7, label: "七年级" },
  { value: 8, label: "八年级" },
  { value: 9, label: "九年级" },
  { value: 10, label: "高一" },
  { value: 11, label: "高二" },
  { value: 12, label: "高三" },
];

export type UserRole = "student" | "teacher" | "admin";

export type Class = {
  id: string;
  name: string;
  gradeLevel: number;
  teacherId?: string; // 班主任
  createdAt: string;
};

export type User = {
  id: string;
  role: UserRole;
  phone: string;
  schoolNo: string;
  password: string;
  displayName: string;
  age?: number;
  gender?: "male" | "female" | "other";
  status: "active" | "disabled";
  avatarUrl?: string;
  gradeLevel?: number; // 教师教授年级
  subjectId?: string; // 教师教授学科
  classId?: string; // 学生所属班级
  createdAt: string;
};

export type MessageTarget =
  | { type: "all_students" }
  | { type: "students"; studentIds: string[] };

export type MessageRead = {
  messageId: string;
  studentId: string;
  readAt: string;
};

export type Message = {
  id: string;
  teacherId: string;
  title: string;
  content: string;
  target: MessageTarget;
  createdAt: string;
  readAt?: string;
  reads?: MessageRead[];
};

export type QuestionType = "single" | "multiple" | "true_false" | "blank" | "short";

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single: "单选题",
  multiple: "多选题",
  true_false: "判断题",
  blank: "填空题",
  short: "简答题",
};

export type StemBlock =
  | { type: "text"; text: string }
  | { type: "image"; url: string; alt?: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "formula"; latex: string };

export type Question = {
  id: string;
  teacherId: string;
  type: QuestionType;
  stem: StemBlock[];
  options?: { id: string; text: string }[];
  answerKey: unknown;
  defaultScore: number;
  gradeLevel?: number; // 1-12
  subjectId?: string;
  analysis?: string; // 解析
  difficulty?: number; // 1-5
  createdAt: string;
  updatedAt: string;
};

export type ExamStatus = "draft" | "published" | "closed";

export const EXAM_STATUS_LABELS: Record<ExamStatus, string> = {
  draft: "草稿",
  published: "已发布",
  closed: "已关闭",
};

export type QuestionTypeSetting = {
  count: number;
  score: number;
};

export type ExamQuestionTypeSettings = Record<QuestionType, QuestionTypeSetting>;

export type QuestionTypePreset = {
  id: string;
  name: string;
  settings: ExamQuestionTypeSettings;
  createdAt: string;
  updatedAt: string;
};

export type Exam = {
  id: string;
  teacherId: string;
  title: string;
  description?: string;
  status: ExamStatus;
  durationMinutes: number;
  gradeLevel?: number;
  subjectId?: string;
  startAt?: string;
  endAt?: string;
  attemptLimit: number;
  shuffleQuestions: boolean;
  assignedClassIds?: string[];
  questionTypeSettings?: ExamQuestionTypeSettings;
  createdAt: string;
  updatedAt: string;
};

export type ExamQuestion = {
  id: string;
  examId: string;
  questionId: string;
  sortOrder: number;
  score: number;
};

export type ExamAssignment = {
  id: string;
  examId: string;
  studentId: string;
  createdAt: string;
};

export type AttemptStatus = "in_progress" | "submitted" | "graded";

export type Attempt = {
  id: string;
  examId: string;
  studentId: string;
  status: AttemptStatus;
  startedAt: string;
  submittedAt?: string;
  totalScore: number;
  scorePublished: boolean;
};

export type AttemptAnswer = {
  id: string;
  attemptId: string;
  questionId: string;
  answer: unknown;
  autoScore: number;
  manualScore: number;
  teacherComment?: string;
  updatedAt: string;
};

export type Db = {
  users: User[];
  messages: Message[];
  questions: Question[];
  exams: Exam[];
  examQuestions: ExamQuestion[];
  examAssignments: ExamAssignment[];
  attempts: Attempt[];
  attemptAnswers: AttemptAnswer[];
  classes: Class[];
  meta: { seeded: boolean; version: number };
};
