import { useEffect, useMemo, useState } from "react";
import { queryClient, queryDefaults } from "@/lib/query/queryClient";
import type { QueryKey, QueryState, UseCachedQueryOptions } from "@/lib/query/types";

export function useCachedQuery<T>(key: QueryKey, options: UseCachedQueryOptions<T>): QueryState<T> {
  const { enabled = true, revalidateOnMount = true } = options;
  const [state, setState] = useState<QueryState<T>>(() => queryClient.getState<T>(key));

  const stableKey = useMemo(() => key, [JSON.stringify(key)]);

  useEffect(() => {
    const unsubscribe = queryClient.subscribe(stableKey, () => {
      setState(queryClient.getState<T>(stableKey));
    }, options.gcTime ?? queryDefaults.gcTime);
    setState(queryClient.getState<T>(stableKey));
    return unsubscribe;
  }, [stableKey, options.gcTime]);

  useEffect(() => {
    if (!enabled) return;
    if (!revalidateOnMount && state.data !== undefined) return;
    void queryClient.ensureQueryData(stableKey, {
      fetcher: options.fetcher,
      staleTime: options.staleTime,
      gcTime: options.gcTime,
      persist: options.persist,
    });
  }, [enabled, options.fetcher, options.gcTime, options.persist, options.staleTime, revalidateOnMount, stableKey]);

  return state;
}
