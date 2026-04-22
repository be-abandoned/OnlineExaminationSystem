import type { Question } from "@/types/domain";

export function normalizeBlankAnswer(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

export function gradeAuto(question: Question, answer: unknown): number {
  const key = question.answerKey;
  // 简答题强制不自动评分
  if (question.type === "short") return 0;
  
  if (question.type === "single") {
    if (typeof key !== "string") return 0;
    return answer === key ? question.defaultScore : 0;
  }
  if (question.type === "multiple") {
    if (!Array.isArray(key)) return 0;
    const a = Array.isArray(answer) ? answer.slice().sort() : [];
    const k = (key as unknown[]).slice().sort();
    return JSON.stringify(a) === JSON.stringify(k) ? question.defaultScore : 0;
  }
  if (question.type === "true_false") {
    if (typeof key !== "boolean") return 0;
    return answer === key ? question.defaultScore : 0;
  }
  if (question.type === "blank") {
    if (typeof key !== "string") return 0;
    return normalizeBlankAnswer(answer) === normalizeBlankAnswer(key) ? question.defaultScore : 0;
  }
  return 0;
}

export function isSubjective(question: Question) {
  return question.type === "short";
}

