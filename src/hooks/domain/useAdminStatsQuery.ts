import { useMemo } from "react";
import { createQueryKey } from "@/lib/query/queryKey";
import { useCachedQuery } from "@/hooks/query/useCachedQuery";
import { usePrefetchQuery } from "@/hooks/query/usePrefetchQuery";
import { adminGetStatsRemote } from "@/utils/remoteApi";

export function useAdminStatsQuery(adminId?: string) {
  const key = useMemo(() => createQueryKey("admin", adminId || "anonymous", "stats", {}), [adminId]);

  return useCachedQuery(key, {
    enabled: Boolean(adminId),
    staleTime: 60 * 1000,
    fetcher: () => adminGetStatsRemote(adminId!),
  });
}

export function usePrefetchAdminStats() {
  const prefetch = usePrefetchQuery();

  return (adminId?: string) => {
    if (!adminId) return;
    prefetch(createQueryKey("admin", adminId, "stats", {}), {
      staleTime: 60 * 1000,
      fetcher: () => adminGetStatsRemote(adminId),
    });
  };
}

