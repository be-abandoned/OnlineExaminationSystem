import type { PersistedQueryEntry } from "@/lib/query/types";

const STORAGE_KEY = "oex_query_cache_v1";

type PersistedQueryStore = {
  entries: PersistedQueryEntry[];
};

function readStore(): PersistedQueryStore {
  if (typeof window === "undefined") return { entries: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { entries: [] };
    const parsed = JSON.parse(raw) as PersistedQueryStore;
    if (!parsed || !Array.isArray(parsed.entries)) return { entries: [] };
    return parsed;
  } catch {
    return { entries: [] };
  }
}

function writeStore(store: PersistedQueryStore) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function readPersistedEntry(key: string): PersistedQueryEntry | null {
  const store = readStore();
  return store.entries.find((entry) => entry.key === key) || null;
}

export function writePersistedEntry(entry: PersistedQueryEntry) {
  const store = readStore();
  const next = store.entries.filter((item) => item.key !== entry.key);
  next.unshift(entry);
  writeStore({ entries: next.slice(0, 20) });
}

export function clearPersistedEntries() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
