import { useMemo } from "react";
import { createQueryKey } from "@/lib/query/queryKey";
import { useCachedQuery } from "@/hooks/query/useCachedQuery";
import { usePrefetchQuery } from "@/hooks/query/usePrefetchQuery";
import { teacherListMessagesRemote } from "@/utils/remoteApi";

export function useTeacherMessagesQuery(teacherId?: string) {
  const key = useMemo(() => createQueryKey("teacher", teacherId || "anonymous", "messages", {}), [teacherId]);

  return useCachedQuery(key, {
    enabled: Boolean(teacherId),
    staleTime: 60 * 1000,
    fetcher: () => teacherListMessagesRemote(teacherId!),
  });
}

export function usePrefetchTeacherMessages() {
  const prefetch = usePrefetchQuery();

  return (teacherId?: string) => {
    if (!teacherId) return;
    const key = createQueryKey("teacher", teacherId, "messages", {});
    prefetch(key, {
      staleTime: 60 * 1000,
      fetcher: () => teacherListMessagesRemote(teacherId),
    });
  };
}

