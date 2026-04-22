import { useMemo } from "react";
import { createQueryKey } from "@/lib/query/queryKey";
import { useCachedQuery } from "@/hooks/query/useCachedQuery";
import { usePrefetchQuery } from "@/hooks/query/usePrefetchQuery";
import { teacherListExamsRemote } from "@/utils/remoteApi";

export function useTeacherExamsQuery(teacherId?: string) {
  const key = useMemo(
    () => createQueryKey("teacher", teacherId || "anonymous", "exams", {}),
    [teacherId],
  );

  return useCachedQuery(key, {
    enabled: Boolean(teacherId),
    staleTime: 60 * 1000,
    fetcher: () => teacherListExamsRemote(teacherId!),
  });
}

export function usePrefetchTeacherExams() {
  const prefetch = usePrefetchQuery();
  return (teacherId?: string) => {
    if (!teacherId) return;
    const key = createQueryKey("teacher", teacherId, "exams", {});
    prefetch(key, {
      staleTime: 60 * 1000,
      fetcher: () => teacherListExamsRemote(teacherId),
    });
  };
}
