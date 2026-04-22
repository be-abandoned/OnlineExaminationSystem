import { useMemo } from "react";
import { createQueryKey } from "@/lib/query/queryKey";
import { useCachedQuery } from "@/hooks/query/useCachedQuery";
import { usePrefetchQuery } from "@/hooks/query/usePrefetchQuery";
import { studentGetExamRemote } from "@/utils/remoteApi";

export function useStudentExamDetailQuery(studentId?: string, examId?: string) {
  const key = useMemo(
    () => createQueryKey("student", studentId || "anonymous", "exam-detail", { examId: examId || "" }),
    [studentId, examId],
  );

  return useCachedQuery(key, {
    enabled: Boolean(studentId && examId),
    staleTime: 60 * 1000,
    fetcher: () => studentGetExamRemote(studentId!, examId!),
  });
}

export function usePrefetchStudentExamDetail() {
  const prefetch = usePrefetchQuery();

  return (studentId?: string, examId?: string) => {
    if (!studentId || !examId) return;
    const key = createQueryKey("student", studentId, "exam-detail", { examId });
    prefetch(key, {
      staleTime: 60 * 1000,
      fetcher: () => studentGetExamRemote(studentId, examId),
    });
  };
}

