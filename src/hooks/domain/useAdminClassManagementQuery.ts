import { useMemo } from "react";
import { createQueryKey } from "@/lib/query/queryKey";
import { useCachedQuery } from "@/hooks/query/useCachedQuery";
import { usePrefetchQuery } from "@/hooks/query/usePrefetchQuery";
import { adminListClassesRemote, adminListUsersRemote } from "@/utils/remoteApi";

export function useAdminClassManagementQuery(adminId?: string) {
  const key = useMemo(() => createQueryKey("admin", adminId || "anonymous", "classes", {}), [adminId]);

  return useCachedQuery(key, {
    enabled: Boolean(adminId),
    staleTime: 60 * 1000,
    fetcher: async () => {
      const [classes, teachers] = await Promise.all([
        adminListClassesRemote(adminId!),
        adminListUsersRemote(adminId!, "teacher"),
      ]);
      return { classes, teachers };
    },
  });
}

export function usePrefetchAdminClasses() {
  const prefetch = usePrefetchQuery();

  return (adminId?: string) => {
    if (!adminId) return;
    const key = createQueryKey("admin", adminId, "classes", {});
    prefetch(key, {
      staleTime: 60 * 1000,
      fetcher: async () => {
        const [classes, teachers] = await Promise.all([
          adminListClassesRemote(adminId),
          adminListUsersRemote(adminId, "teacher"),
        ]);
        return { classes, teachers };
      },
    });
  };
}

