import { useMemo } from "react";
import { useCachedQuery } from "@/hooks/query/useCachedQuery";
import { getStudentAttemptDetailKey } from "@/hooks/domain/useStudentAttemptDetailQuery";
import { studentGetAttemptDetailRemote } from "@/utils/remoteApi";

export function useStudentResultDetailQuery(studentId?: string, attemptId?: string) {
  const key = useMemo(() => getStudentAttemptDetailKey(studentId, attemptId), [studentId, attemptId]);

  return useCachedQuery(key, {
    enabled: Boolean(studentId && attemptId),
    staleTime: 0,
    fetcher: () => studentGetAttemptDetailRemote(studentId!, attemptId!),
  });
}
