import { useMemo } from "react";
import { createQueryKey } from "@/lib/query/queryKey";
import { useCachedQuery } from "@/hooks/query/useCachedQuery";
import { usePrefetchQuery } from "@/hooks/query/usePrefetchQuery";
import { adminListClassesRemote, adminListUsersRemote } from "@/utils/remoteApi";
import type { UserRole } from "@/types/domain";

export function useAdminUserManagementQuery(adminId?: string, role?: UserRole) {
  const key = useMemo(
    () => createQueryKey("admin", adminId || "anonymous", "users", { role: role || "student" }),
    [adminId, role],
  );

  return useCachedQuery(key, {
    enabled: Boolean(adminId),
    staleTime: 60 * 1000,
    fetcher: async () => {
      const [users, classes] = await Promise.all([
        adminListUsersRemote(adminId!, role),
        adminListClassesRemote(adminId!),
      ]);
      return { users, classes };
    },
  });
}

export function usePrefetchAdminUsers() {
  const prefetch = usePrefetchQuery();

  return (adminId?: string, role: UserRole = "student") => {
    if (!adminId) return;
    const key = createQueryKey("admin", adminId, "users", { role });
    prefetch(key, {
      staleTime: 60 * 1000,
      fetcher: async () => {
        const [users, classes] = await Promise.all([
          adminListUsersRemote(adminId, role),
          adminListClassesRemote(adminId),
        ]);
        return { users, classes };
      },
    });
  };
}

