import { readPersistedEntry, writePersistedEntry } from "@/lib/query/persist";
import { serializeQueryKey } from "@/lib/query/queryKey";
import type { QueryEntry, QueryKey, QueryOptions, QueryState, QuerySubscriber } from "@/lib/query/types";

const DEFAULT_STALE_TIME = 60 * 1000;
const DEFAULT_GC_TIME = 10 * 60 * 1000;

function createEmptyEntry<T>(): QueryEntry<T> {
  return {
    status: "idle",
    updatedAt: 0,
    subscribers: new Set(),
    isInvalidated: false,
    isFetching: false,
  };
}

class QueryClient {
  private cache = new Map<string, QueryEntry>();
  private gcTimers = new Map<string, number>();

  private getOrCreateEntry<T>(key: string): QueryEntry<T> {
    const existing = this.cache.get(key) as QueryEntry<T> | undefined;
    if (existing) return existing;

    const entry = createEmptyEntry<T>();
    const persisted = readPersistedEntry(key);
    if (persisted) {
      entry.data = persisted.data as T;
      entry.updatedAt = persisted.updatedAt;
      entry.status = "success";
    }
    this.cache.set(key, entry);
    return entry;
  }

  private notify(key: string) {
    const entry = this.cache.get(key);
    if (!entry) return;
    entry.subscribers.forEach((subscriber) => subscriber());
  }

  private scheduleGc(key: string, gcTime: number) {
    const timer = this.gcTimers.get(key);
    if (timer) {
      window.clearTimeout(timer);
    }
    if (typeof window === "undefined") return;
    const nextTimer = window.setTimeout(() => {
      const entry = this.cache.get(key);
      if (!entry || entry.subscribers.size > 0) return;
      this.cache.delete(key);
      this.gcTimers.delete(key);
    }, gcTime);
    this.gcTimers.set(key, nextTimer);
  }

  private isStale(entry: QueryEntry, staleTime: number) {
    return entry.isInvalidated || entry.updatedAt === 0 || Date.now() - entry.updatedAt > staleTime;
  }

  subscribe(key: QueryKey, subscriber: QuerySubscriber, gcTime = DEFAULT_GC_TIME) {
    const serializedKey = serializeQueryKey(key);
    const entry = this.getOrCreateEntry(serializedKey);
    entry.subscribers.add(subscriber);
    const timer = this.gcTimers.get(serializedKey);
    if (timer) {
      window.clearTimeout(timer);
      this.gcTimers.delete(serializedKey);
    }
    return () => {
      const current = this.cache.get(serializedKey);
      if (!current) return;
      current.subscribers.delete(subscriber);
      if (current.subscribers.size === 0) {
        this.scheduleGc(serializedKey, gcTime);
      }
    };
  }

  getState<T>(key: QueryKey): QueryState<T> {
    const entry = this.getOrCreateEntry<T>(serializeQueryKey(key));
    return {
      data: entry.data,
      error: entry.error,
      status: entry.status,
      isLoading: entry.status === "loading" && !entry.data,
      isFetching: entry.isFetching,
      isRefreshing: Boolean(entry.data) && entry.isFetching,
      updatedAt: entry.updatedAt,
    };
  }

  async fetchQuery<T>(key: QueryKey, options: QueryOptions<T>): Promise<T> {
    const serializedKey = serializeQueryKey(key);
    const entry = this.getOrCreateEntry<T>(serializedKey);

    if (entry.promise) {
      return entry.promise;
    }

    entry.isFetching = true;
    entry.status = entry.data ? entry.status : "loading";
    entry.error = undefined;
    this.notify(serializedKey);

    const task = options
      .fetcher()
      .then((data) => {
        entry.data = data;
        entry.error = undefined;
        entry.status = "success";
        entry.updatedAt = Date.now();
        entry.isInvalidated = false;
        if (options.persist) {
          writePersistedEntry({ key: serializedKey, data, updatedAt: entry.updatedAt });
        }
        return data;
      })
      .catch((error: unknown) => {
        entry.error = error instanceof Error ? error : new Error("请求失败");
        entry.status = entry.data ? "success" : "error";
        throw entry.error;
      })
      .finally(() => {
        entry.promise = undefined;
        entry.isFetching = false;
        this.notify(serializedKey);
      });

    entry.promise = task;
    return task;
  }

  ensureQueryData<T>(key: QueryKey, options: QueryOptions<T>) {
    const serializedKey = serializeQueryKey(key);
    const entry = this.getOrCreateEntry<T>(serializedKey);
    const staleTime = options.staleTime ?? DEFAULT_STALE_TIME;
    if (entry.data !== undefined && !this.isStale(entry, staleTime)) {
      return Promise.resolve(entry.data);
    }
    return this.fetchQuery(key, options);
  }

  prefetchQuery<T>(key: QueryKey, options: QueryOptions<T>) {
    return this.ensureQueryData(key, options).catch(() => undefined);
  }

  invalidateQueries(predicate: (key: QueryKey) => boolean) {
    this.cache.forEach((entry, serializedKey) => {
      const key = JSON.parse(serializedKey) as QueryKey;
      if (!predicate(key)) return;
      entry.isInvalidated = true;
      this.notify(serializedKey);
    });
  }

  removeQueries(predicate: (key: QueryKey) => boolean) {
    this.cache.forEach((_entry, serializedKey) => {
      const key = JSON.parse(serializedKey) as QueryKey;
      if (!predicate(key)) return;
      this.cache.delete(serializedKey);
      this.notify(serializedKey);
    });
  }

  setQueryData<T>(key: QueryKey, updater: T | ((current: T | undefined) => T)) {
    const serializedKey = serializeQueryKey(key);
    const entry = this.getOrCreateEntry<T>(serializedKey);
    const nextData = typeof updater === "function" ? (updater as (current: T | undefined) => T)(entry.data) : updater;
    entry.data = nextData;
    entry.status = "success";
    entry.error = undefined;
    entry.updatedAt = Date.now();
    entry.isInvalidated = false;
    this.notify(serializedKey);
  }
}

export const queryClient = new QueryClient();

export const queryDefaults = {
  staleTime: DEFAULT_STALE_TIME,
  gcTime: DEFAULT_GC_TIME,
};
