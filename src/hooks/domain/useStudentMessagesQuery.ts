import { useMemo } from "react";
import { createQueryKey } from "@/lib/query/queryKey";
import { useCachedQuery } from "@/hooks/query/useCachedQuery";
import { usePrefetchQuery } from "@/hooks/query/usePrefetchQuery";
import { studentListMessagesRemote } from "@/utils/remoteApi";

export function useStudentMessagesQuery(studentId?: string) {
  const key = useMemo(() => createQueryKey("student", studentId || "anonymous", "messages", {}), [studentId]);

  return useCachedQuery(key, {
    enabled: Boolean(studentId),
    staleTime: 60 * 1000,
    fetcher: () => studentListMessagesRemote(studentId!),
  });
}

export function usePrefetchStudentMessages() {
  const prefetch = usePrefetchQuery();

  return (studentId?: string) => {
    if (!studentId) return;
    const key = createQueryKey("student", studentId, "messages", {});
    prefetch(key, {
      staleTime: 60 * 1000,
      fetcher: () => studentListMessagesRemote(studentId),
    });
  };
}

