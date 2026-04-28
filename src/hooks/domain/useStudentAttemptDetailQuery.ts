import { useMemo } from "react";
import { createQueryKey } from "@/lib/query/queryKey";
import { queryClient } from "@/lib/query/queryClient";
import { useCachedQuery } from "@/hooks/query/useCachedQuery";
import { usePrefetchQuery } from "@/hooks/query/usePrefetchQuery";
import { studentGetAttemptDetailRemote } from "@/utils/remoteApi";
import type { Attempt } from "@/types/domain";

type AttemptDetailData = Awaited<ReturnType<typeof studentGetAttemptDetailRemote>>;

export function getStudentAttemptDetailKey(studentId?: string, attemptId?: string) {
  return createQueryKey("student", studentId || "anonymous", "attempt-detail", { attemptId: attemptId || "" });
}

export function useStudentAttemptDetailQuery(studentId?: string, attemptId?: string) {
  const key = useMemo(() => getStudentAttemptDetailKey(studentId, attemptId), [studentId, attemptId]);

  return useCachedQuery(key, {
    enabled: Boolean(studentId && attemptId),
    staleTime: 30 * 1000,
    fetcher: () => studentGetAttemptDetailRemote(studentId!, attemptId!),
  });
}

export function usePrefetchStudentAttemptDetail() {
  const prefetch = usePrefetchQuery();

  return (studentId?: string, attemptId?: string) => {
    if (!studentId || !attemptId) return;
    prefetch(getStudentAttemptDetailKey(studentId, attemptId), {
      staleTime: 30 * 1000,
      fetcher: () => studentGetAttemptDetailRemote(studentId, attemptId),
    });
  };
}

export function updateStudentAttemptAnswerCache(studentId: string, attemptId: string, questionId: string, answer: unknown) {
  queryClient.setQueryData<AttemptDetailData>(getStudentAttemptDetailKey(studentId, attemptId), (current) => {
    if (!current) return current as AttemptDetailData;
    return {
      ...current,
      answers: current.answers.map((item) =>
        item.questionId === questionId
          ? { ...item, answer, updatedAt: new Date().toISOString() }
          : item,
      ),
    };
  });
}

export function updateStudentAttemptSubmittedCache(studentId: string, attempt: Attempt) {
  queryClient.setQueryData<AttemptDetailData>(getStudentAttemptDetailKey(studentId, attempt.id), (current) => {
    if (!current) return current as AttemptDetailData;
    return {
      ...current,
      attempt,
    };
  });
}
