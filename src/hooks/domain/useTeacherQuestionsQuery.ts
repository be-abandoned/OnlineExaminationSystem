import { useMemo } from "react";
import { createQueryKey } from "@/lib/query/queryKey";
import { useCachedQuery } from "@/hooks/query/useCachedQuery";
import { usePrefetchQuery } from "@/hooks/query/usePrefetchQuery";
import { teacherListQuestionsRemote } from "@/utils/remoteApi";

export function useTeacherQuestionsQuery(teacherId?: string) {
  const key = useMemo(() => createQueryKey("teacher", teacherId || "anonymous", "questions", {}), [teacherId]);

  return useCachedQuery(key, {
    enabled: Boolean(teacherId),
    staleTime: 60 * 1000,
    fetcher: () => teacherListQuestionsRemote(teacherId!),
  });
}

export function usePrefetchTeacherQuestions() {
  const prefetch = usePrefetchQuery();

  return (teacherId?: string) => {
    if (!teacherId) return;
    const key = createQueryKey("teacher", teacherId, "questions", {});
    prefetch(key, {
      staleTime: 60 * 1000,
      fetcher: () => teacherListQuestionsRemote(teacherId),
    });
  };
}

