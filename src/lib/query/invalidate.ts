import { queryClient } from "@/lib/query/queryClient";
import type { QueryKey } from "@/lib/query/types";

export function invalidateByResource(role: string, userId: string, resource: string) {
  queryClient.invalidateQueries((key: QueryKey) => key[0] === role && key[1] === userId && key[2] === resource);
}

export function invalidateByPrefix(role: string, userId: string, resources: string[]) {
  queryClient.invalidateQueries((key: QueryKey) => key[0] === role && key[1] === userId && resources.includes(key[2]));
}

export function removeByResource(role: string, userId: string, resource: string) {
  queryClient.removeQueries((key: QueryKey) => key[0] === role && key[1] === userId && key[2] === resource);
}
