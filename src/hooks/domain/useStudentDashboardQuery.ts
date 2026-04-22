import { useMemo } from "react";
import { createQueryKey } from "@/lib/query/queryKey";
import { useCachedQuery } from "@/hooks/query/useCachedQuery";
import { usePrefetchQuery } from "@/hooks/query/usePrefetchQuery";
import { studentListAssignedExamsRemote, studentListAttemptsRemote } from "@/utils/remoteApi";

export function useStudentDashboardQuery(studentId?: string) {
  const key = useMemo(() => createQueryKey("student", studentId || "anonymous", "dashboard", {}), [studentId]);

  return useCachedQuery(key, {
    enabled: Boolean(studentId),
    staleTime: 60 * 1000,
    fetcher: async () => {
      const [exams, attempts] = await Promise.all([
        studentListAssignedExamsRemote(studentId!),
        studentListAttemptsRemote(studentId!),
      ]);
      return { exams, attempts };
    },
  });
}

export function usePrefetchStudentDashboard() {
  const prefetch = usePrefetchQuery();

  return (studentId?: string) => {
    if (!studentId) return;
    const key = createQueryKey("student", studentId, "dashboard", {});
    prefetch(key, {
      staleTime: 60 * 1000,
      fetcher: async () => {
        const [exams, attempts] = await Promise.all([
          studentListAssignedExamsRemote(studentId),
          studentListAttemptsRemote(studentId),
        ]);
        return { exams, attempts };
      },
    });
  };
}

