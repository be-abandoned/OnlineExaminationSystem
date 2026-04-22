import { useMemo } from "react";
import { createQueryKey } from "@/lib/query/queryKey";
import { useCachedQuery } from "@/hooks/query/useCachedQuery";
import { usePrefetchQuery } from "@/hooks/query/usePrefetchQuery";
import { teacherGetExamDetailRemote } from "@/utils/remoteApi";

export function getTeacherExamDetailKey(teacherId?: string, examId?: string) {
  return createQueryKey("teacher", teacherId || "anonymous", "exam-detail", { examId: examId || "" });
}

export function useTeacherExamDetailQuery(teacherId?: string, examId?: string) {
  const key = useMemo(() => getTeacherExamDetailKey(teacherId, examId), [teacherId, examId]);

  return useCachedQuery(key, {
    enabled: Boolean(teacherId && examId),
    staleTime: 30 * 1000,
    fetcher: () => teacherGetExamDetailRemote(teacherId!, examId!),
  });
}

export function usePrefetchTeacherExamDetail() {
  const prefetch = usePrefetchQuery();

  return (teacherId?: string, examId?: string) => {
    if (!teacherId || !examId) return;
    prefetch(getTeacherExamDetailKey(teacherId, examId), {
      staleTime: 30 * 1000,
      fetcher: () => teacherGetExamDetailRemote(teacherId, examId),
    });
  };
}

