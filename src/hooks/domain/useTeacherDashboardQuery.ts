import { useMemo } from "react";
import { createQueryKey } from "@/lib/query/queryKey";
import { useCachedQuery } from "@/hooks/query/useCachedQuery";
import { usePrefetchQuery } from "@/hooks/query/usePrefetchQuery";
import { teacherGetDashboardRemote } from "@/utils/remoteApi";

export function useTeacherDashboardQuery(teacherId?: string) {
  const key = useMemo(() => createQueryKey("teacher", teacherId || "anonymous", "dashboard", {}), [teacherId]);

  return useCachedQuery(key, {
    enabled: Boolean(teacherId),
    staleTime: 60 * 1000,
    fetcher: () => teacherGetDashboardRemote(teacherId!),
  });
}

export function usePrefetchTeacherDashboard() {
  const prefetch = usePrefetchQuery();

  return (teacherId?: string) => {
    if (!teacherId) return;
    const key = createQueryKey("teacher", teacherId, "dashboard", {});
    prefetch(key, {
      staleTime: 60 * 1000,
      fetcher: () => teacherGetDashboardRemote(teacherId),
    });
  };
}

