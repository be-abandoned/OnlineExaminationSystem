import { useMemo } from "react";
import { createQueryKey } from "@/lib/query/queryKey";
import { queryClient } from "@/lib/query/queryClient";
import { useCachedQuery } from "@/hooks/query/useCachedQuery";
import {
  teacherGetGradingAttemptDetailRemote,
  teacherListAttemptsForExamRemote,
} from "@/utils/remoteApi";
import type { Attempt, AttemptAnswer } from "@/types/domain";

type GradingListData = Awaited<ReturnType<typeof teacherListAttemptsForExamRemote>>;
type GradingDetailData = Awaited<ReturnType<typeof teacherGetGradingAttemptDetailRemote>>;

export function getTeacherGradingListKey(teacherId?: string, examId?: string) {
  return createQueryKey("teacher", teacherId || "anonymous", "grading-list", { examId: examId || "" });
}

export function getTeacherGradingDetailKey(teacherId?: string, attemptId?: string) {
  return createQueryKey("teacher", teacherId || "anonymous", "grading-detail", { attemptId: attemptId || "" });
}

export function useTeacherGradingListQuery(teacherId?: string, examId?: string) {
  const key = useMemo(() => getTeacherGradingListKey(teacherId, examId), [teacherId, examId]);

  return useCachedQuery(key, {
    enabled: Boolean(teacherId && examId),
    staleTime: 30 * 1000,
    fetcher: () => teacherListAttemptsForExamRemote(teacherId!, examId!),
  });
}

export function useTeacherGradingDetailQuery(teacherId?: string, attemptId?: string) {
  const key = useMemo(() => getTeacherGradingDetailKey(teacherId, attemptId), [teacherId, attemptId]);

  return useCachedQuery(key, {
    enabled: Boolean(teacherId && attemptId),
    staleTime: 30 * 1000,
    fetcher: () => teacherGetGradingAttemptDetailRemote(teacherId!, attemptId!),
  });
}

export function updateTeacherGradingDetailCache(
  teacherId: string,
  attemptId: string,
  questionId: string,
  manualScore: number,
  teacherComment: string,
) {
  queryClient.setQueryData<GradingDetailData>(getTeacherGradingDetailKey(teacherId, attemptId), (current) => {
    if (!current) return current as GradingDetailData;
    const nextByQ = new Map(current.byQ);
    const answer = nextByQ.get(questionId);
    if (!answer) return current;
    nextByQ.set(questionId, {
      ...answer,
      manualScore,
      teacherComment,
      updatedAt: new Date().toISOString(),
    });
    const totalScore = current.questions.reduce((sum, item) => {
      const currentAnswer = nextByQ.get(item.q.id);
      return sum + (
        item.q.type === "blank" || item.q.type === "short"
          ? Number(currentAnswer?.manualScore || 0)
          : Number(currentAnswer?.autoScore || 0)
      );
    }, 0);

    return {
      ...current,
      attempt: {
        ...current.attempt,
        status: "graded",
        totalScore,
      },
      byQ: nextByQ,
    };
  });
}

export function updateTeacherGradingPublishedCache(teacherId: string, attemptId: string, scorePublished: boolean) {
  queryClient.setQueryData<GradingDetailData>(getTeacherGradingDetailKey(teacherId, attemptId), (current) => {
    if (!current) return current as GradingDetailData;
    return {
      ...current,
      attempt: {
        ...current.attempt,
        scorePublished,
      },
    };
  });
}

export function updateTeacherGradingListAttempt(
  teacherId: string,
  examId: string,
  attemptId: string,
  updater: (current: GradingListData["attempts"][number]) => GradingListData["attempts"][number],
) {
  queryClient.setQueryData<GradingListData>(getTeacherGradingListKey(teacherId, examId), (current) => {
    if (!current) return current as GradingListData;
    return {
      ...current,
      attempts: current.attempts.map((attempt) => (attempt.id === attemptId ? updater(attempt) : attempt)),
    };
  });
}

export function updateTeacherGradingListAfterScore(
  teacherId: string,
  examId: string,
  updatedAttempt: Attempt,
  updatedAnswers: AttemptAnswer[],
) {
  queryClient.setQueryData<GradingListData>(getTeacherGradingListKey(teacherId, examId), (current) => {
    if (!current) return current as GradingListData;
    const updatedAnswerKeys = new Set(updatedAnswers.map((answer) => `${answer.attemptId}:${answer.questionId}`));
    const remainingAnswers = current.answers.filter((answer) => !updatedAnswerKeys.has(`${answer.attemptId}:${answer.questionId}`));
    return {
      ...current,
      attempts: current.attempts.map((attempt) => (attempt.id === updatedAttempt.id ? updatedAttempt : attempt)),
      answers: [...remainingAnswers, ...updatedAnswers],
    };
  });
}
