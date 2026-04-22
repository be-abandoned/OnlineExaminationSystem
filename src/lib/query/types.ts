export type QueryKeyPart = string | number | boolean | null | undefined | Record<string, unknown> | QueryKeyPart[];

export type QueryKey = [string, string, string, Record<string, unknown>?];

export type QueryStatus = "idle" | "loading" | "success" | "error";

export type QuerySubscriber = () => void;

export type QueryEntry<T = unknown> = {
  data?: T;
  error?: Error;
  status: QueryStatus;
  updatedAt: number;
  promise?: Promise<T>;
  subscribers: Set<QuerySubscriber>;
  isInvalidated: boolean;
  isFetching: boolean;
};

export type QueryOptions<T> = {
  fetcher: () => Promise<T>;
  staleTime?: number;
  gcTime?: number;
  persist?: boolean;
};

export type UseCachedQueryOptions<T> = QueryOptions<T> & {
  enabled?: boolean;
  revalidateOnMount?: boolean;
};

export type QueryState<T> = {
  data?: T;
  error?: Error;
  status: QueryStatus;
  isLoading: boolean;
  isFetching: boolean;
  isRefreshing: boolean;
  updatedAt: number;
};

export type PersistedQueryEntry = {
  key: string;
  data: unknown;
  updatedAt: number;
};
