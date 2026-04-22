import { useCallback } from "react";
import { queryClient } from "@/lib/query/queryClient";
import type { QueryKey, QueryOptions } from "@/lib/query/types";

export function usePrefetchQuery() {
  return useCallback(<T,>(key: QueryKey, options: QueryOptions<T>) => {
    void queryClient.prefetchQuery(key, options);
  }, []);
}
