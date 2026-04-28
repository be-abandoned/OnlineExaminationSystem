import { useMemo } from "react";
import { createQueryKey } from "@/lib/query/queryKey";
import { useCachedQuery } from "@/hooks/query/useCachedQuery";
import { studentGetProfileRemote } from "@/utils/remoteApi";

export function getStudentProfileKey(studentId?: string) {
  return createQueryKey("student", studentId || "anonymous", "profile", {});
}

export function useStudentProfileQuery(studentId?: string) {
  const key = useMemo(() => getStudentProfileKey(studentId), [studentId]);

  return useCachedQuery(key, {
    enabled: Boolean(studentId),
    staleTime: 30 * 1000,
    fetcher: () => studentGetProfileRemote(studentId!),
  });
}
