import type { QueryKey } from "@/lib/query/types";

export function createQueryKey(
  role: string,
  userId: string,
  resource: string,
  params: Record<string, unknown> = {},
): QueryKey {
  return [role, userId, resource, params];
}

export function serializeQueryKey(key: QueryKey): string {
  return JSON.stringify(key);
}
