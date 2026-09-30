"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { browserAdapter } from "../adapters/browser.js";
import type { QueryFiltersAdapter } from "../adapters/types.js";
import { mergeOwnParams } from "../core/keys.js";
import { parseQueryState } from "../core/parser.js";
import type { ParseOptions } from "../core/parser.js";
import { serializeQueryState } from "../core/serializer.js";
import {
  getActiveFilters,
  getRangeFilter,
  getRangeFilterKeys,
  toQueryKey,
  toSearchString,
} from "../core/utils.js";
import type { SearchParamsInput } from "../core/utils.js";
import type {
  FilterSchema,
  FilterValue,
  ParamNames,
  QueryState,
  RangeValue,
  SortDirection,
  TypedQueryState,
} from "../core/types.js";

// useLayoutEffect warns during SSR on React 18; the URL checks only matter in the browser.
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export interface UseQueryFiltersOptions<S extends FilterSchema = Record<never, never>> {
  /** Page number used when no `page` param is present, and restored to on filter/search changes. Defaults to 1. */
  defaultPage?: number | undefined;
  /** Page size used when no `pageSize` param is present. Defaults to 20. */
  defaultPageSize?: number | undefined;
  /** Use `history.replaceState` instead of `pushState`, so filter changes don't pollute browser back/forward. Defaults to false. */
  replace?: boolean | undefined;
  /** Where the URL is read from and written to. Defaults to the browser History API; see `createNextAdapter` and `createReactRouterAdapter`. */
  adapter?: QueryFiltersAdapter | undefined;
  /** Search params to build the first render from, e.g. a Next.js page's `searchParams` prop, so server and client render the same state. */
  initialSearchParams?: SearchParamsInput | undefined;
  /** Parses and serializes the listed filters as typed values, e.g. `{ price: "number", inStock: "boolean", tags: "array" }`. */
  schema?: S | undefined;
  /** Namespaces every param as `${prefix}.${key}`, so several instances can share one URL. */
  prefix?: string | undefined;
  /** Renames the reserved params, e.g. `{ search: "q" }`. */
  paramNames?: ParamNames | undefined;
  /** Waits this many milliseconds after the last `setSearch` before updating `state.search` and the URL. `searchInput` updates immediately, and clearing the search applies immediately. Defaults to 0 (no debounce). */
  searchDebounce?: number | undefined;
  /** A `localStorage` key. The state is saved there whenever it changes and restored when the URL has none of this instance's params. */
  persist?: string | undefined;
}

export interface UseQueryFiltersResult<S extends FilterSchema = Record<never, never>> {
  state: TypedQueryState<S>;
  /** The search text as typed. Same as `state.search`, except while a debounced search is waiting to be applied. Bind inputs to this. */
  searchInput: string;
  setSearch: (search: string) => void;
  setFilter: (key: string, value: FilterValue) => void;
  /** Sets several filters in one URL update. `null`, `""`, and `[]` remove that filter. */
  setFilters: (filters: Record<string, FilterValue>) => void;
  /** Adds `value` to an array filter, or removes it if it's already there (for multi-select checkboxes). */
  toggleFilterValue: (key: string, value: string) => void;
  removeFilter: (key: string) => void;
  /** Sets one or both sides of a range filter (e.g. a date or price range). Omitting a side leaves it unchanged; passing `null` clears it. */
  setRangeFilter: (key: string, range: Partial<RangeValue>) => void;
  /** Clears both sides of a range filter. */
  removeRangeFilter: (key: string) => void;
  /** Reads a range filter back out of the current state (see `RangeValue`). */
  getRangeFilter: (key: string) => RangeValue;
  /** Sets the sort field. Omitting `direction` toggles asc -> desc -> cleared for the given field. */
  setSort: (field: string, direction?: SortDirection) => void;
  clearSort: () => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  reset: () => void;
  /** Clears every filter (and the search, with `includeSearch`) and resets the page, keeping sort and page size. */
  clearFilters: (options?: { includeSearch?: boolean }) => void;
  /** Replaces any part of the state in one URL update. Unlike the other setters, it doesn't reset the page. */
  setState: (next: Partial<QueryState> | ((prev: QueryState) => QueryState)) => void;
  /** Number of filters with a value (`null`, `""`, and `[]` don't count). */
  activeFilterCount: number;
  /** True when there's a search term or at least one active filter. */
  isFiltered: boolean;
  /** A stable cache key for TanStack Query / SWR that changes only when the query does. */
  queryKey: readonly ["react-query-filters", string];
  /** The state as a query string for API calls, without the `prefix`. */
  toQueryString: () => string;
}

function toCodecOptions(options: UseQueryFiltersOptions<FilterSchema>): ParseOptions {
  const codec: ParseOptions = {
    defaultPage: options.defaultPage ?? 1,
    defaultPageSize: options.defaultPageSize ?? 20,
  };
  if (options.prefix !== undefined) codec.prefix = options.prefix;
  if (options.paramNames !== undefined) codec.paramNames = options.paramNames;
  if (options.schema !== undefined) codec.schema = options.schema;
  return codec;
}

/** Sorts params so two query strings with the same params in a different order compare equal. */
function normalize(search: string): string {
  const params = new URLSearchParams(search);
  params.sort();
  return params.toString();
}

/**
 * This instance's part of a URL in a canonical form: parsed and serialized
 * again, so equivalent URLs compare equal (defaults dropped, `sort=price`
 * read as `price:desc`, params in any order).
 */
function canonicalUrl(search: string, codec: ParseOptions): string {
  return normalize(serializeQueryState(parseQueryState(search, codec), codec));
}

/** A state in the same canonical form, i.e. what the URL would read back as. */
function canonicalState(state: QueryState, codec: ParseOptions): string {
  return canonicalUrl(serializeQueryState(state, codec), codec);
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can be full, disabled, or unavailable (private mode); persistence is best-effort.
  }
}

const subscribeToNothing = () => () => {};
const isNotHydrating = () => false;
const isHydrating = () => true;

/**
 * Router adapters apply navigations asynchronously, so until the router
 * re-renders, `getSearch()` still returns the URL from before the last write.
 * If a second instance writes in that window, it has to merge into the URL
 * that's on its way, not the stale one, or the first write is lost. Shared
 * by all instances; `base` is the stale URL the write was made against.
 * It only applies on the same page, and is dropped when its writer unmounts
 * (a write that never landed must not leak into later ones).
 */
let inFlight: { base: string; result: string; path: string; owner: object } | null = null;

function currentPath(): string {
  return typeof window === "undefined" ? "" : window.location.pathname;
}

export function useQueryFilters<S extends FilterSchema = Record<never, never>>(
  options: UseQueryFiltersOptions<S> = {},
): UseQueryFiltersResult<S> {
  const { adapter = browserAdapter, searchDebounce = 0 } = options;

  // Callbacks read the latest options/adapter through refs, so they stay
  // stable even when options (e.g. an inline `schema`) change identity.
  const optionsRef = useRef<UseQueryFiltersOptions<FilterSchema>>(options);
  optionsRef.current = options;
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;
  const codec = () => toCodecOptions(optionsRef.current);

  // True only while hydrating server-rendered HTML: React uses the server
  // snapshot then. Client-only apps never hydrate, so they read the URL on
  // the first render as before.
  const hydrating = useSyncExternalStore(subscribeToNothing, isNotHydrating, isHydrating);

  const [initialState] = useState(() => {
    let source: string;
    if (options.initialSearchParams !== undefined) {
      source = toSearchString(options.initialSearchParams);
    } else if (hydrating && adapter === browserAdapter) {
      // The server had no `window`, so it rendered the default state. Match
      // it to avoid a hydration mismatch; the real URL is adopted right after.
      source = "";
    } else {
      source = adapter.getSearch() ?? "";
    }
    return parseQueryState(source, toCodecOptions(options));
  });

  const [state, setStateValue] = useState<QueryState>(initialState);
  // The source of truth for setters. Only `apply` writes it, never render, so
  // a render that skips a pending transition can't roll it back.
  const stateRef = useRef(initialState);

  // Debounced search: the typed text lives here until the timer applies it.
  const [typedSearch, setTypedSearch] = useState(initialState.search);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelSearchTimer = useCallback(() => {
    if (timerRef.current === null) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  useEffect(() => cancelSearchTimer, [cancelSearchTimer]);

  const apply = useCallback(
    (next: QueryState) => {
      const prev = stateRef.current;
      stateRef.current = next;
      setStateValue(next);
      // A search change from anywhere but the timer itself makes a pending debounced search obsolete.
      if (next.search !== prev.search) {
        cancelSearchTimer();
        setTypedSearch(next.search);
      }
    },
    [cancelSearchTimer],
  );

  /** Takes on the URL's state after navigation that didn't come from this instance. */
  const adoptUrl = useCallback(
    (search: string) => {
      const next = parseQueryState(search, codec());
      // A navigation that changed the search (back/forward, a link) replaces
      // text still being typed; one that only changed other params (another
      // component setting a filter) leaves it alone.
      if (next.search !== stateRef.current.search) {
        cancelSearchTimer();
        setTypedSearch(next.search);
      }
      apply(next);
    },
    [apply, cancelSearchTimer],
  );

  // Adapters with `subscribe` (the browser adapter) report outside navigation
  // as events. Adapters without it (routers) re-render with new search params,
  // and the effect further down compares on every commit.
  const subscribe = adapter.subscribe;
  const writingRef = useRef(false);
  const [instance] = useState(() => ({}));
  useEffect(
    () => () => {
      if (inFlight?.owner === instance) inFlight = null;
    },
    [instance],
  );
  // Router mode: this instance's writes the router hasn't shown yet. `from`
  // is the URL (canonical) from before them, which the router keeps
  // reporting until it catches up.
  const awaitingRef = useRef<{ from: string; writes: string[] } | null>(null);

  useIsomorphicLayoutEffect(() => {
    if (!subscribe) return;
    return subscribe(() => {
      if (writingRef.current) return; // This instance's own write.
      const search = adapterRef.current.getSearch();
      if (search === null) return;
      if (canonicalUrl(search, codec()) === canonicalState(stateRef.current, codec())) return;
      adoptUrl(search);
    });
  }, [subscribe, adoptUrl]);

  // Event mode: one check after mount, for a URL that changed before the
  // subscription existed or differs from `initialSearchParams`.
  useIsomorphicLayoutEffect(() => {
    if (!adapterRef.current.subscribe) return;
    const search = adapterRef.current.getSearch();
    if (search === null) return;
    if (canonicalUrl(search, codec()) !== canonicalState(stateRef.current, codec())) {
      adoptUrl(search);
    }
  }, []);

  const externalSearch = subscribe ? null : adapter.getSearch();

  // Router mode: after every commit, compare the URL with the state.
  useIsomorphicLayoutEffect(() => {
    if (externalSearch === null) return;

    if (inFlight && normalize(externalSearch) !== inFlight.base) inFlight = null;

    const url = canonicalUrl(externalSearch, codec());
    if (url === canonicalState(stateRef.current, codec())) {
      awaitingRef.current = null;
      return;
    }

    // Known limits, since routers don't say which navigation a render belongs
    // to: a link back to exactly the pre-write URL, clicked before the router
    // shows the write, looks like "not caught up yet" and is missed until the
    // next navigation; and a router that renders each of several quick writes
    // separately can briefly show an intermediate one.
    const awaiting = awaitingRef.current;
    if (awaiting && (url === awaiting.from || awaiting.writes.includes(url))) return;

    awaitingRef.current = null;
    adoptUrl(externalSearch);
  });

  const write = useCallback((next: QueryState, replace: boolean) => {
    const current = codec();
    const target = adapterRef.current;
    const own = serializeQueryState(next, current);
    const reported = normalize(target.getSearch() ?? "");

    if (target.subscribe) {
      writingRef.current = true;
      try {
        target.update(mergeOwnParams(reported, own, current), { replace });
      } finally {
        writingRef.current = false;
      }
      return;
    }

    const path = currentPath();
    const base =
      inFlight && inFlight.base === reported && inFlight.path === path ? inFlight.result : reported;
    const merged = mergeOwnParams(base, own, current);
    inFlight = { base: reported, result: normalize(merged), path, owner: instance };

    const awaiting = awaitingRef.current;
    awaitingRef.current = {
      from: awaiting ? awaiting.from : canonicalUrl(reported, current),
      writes: [...(awaiting ? awaiting.writes : []), canonicalUrl(own, current)],
    };
    target.update(merged, { replace });
  }, [instance]);

  const update = useCallback(
    (updater: (prev: QueryState) => QueryState, replace?: boolean) => {
      const next = updater(stateRef.current);
      apply(next);
      write(next, replace ?? optionsRef.current.replace ?? false);
    },
    [apply, write],
  );

  const firstPage = () => optionsRef.current.defaultPage ?? 1;

  // Restore persisted state once, after mount, so the server render and the
  // first client render match. Declared before the save effect below, so it
  // reads storage before the first save can overwrite it.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    const key = optionsRef.current.persist;
    if (!key || serializeQueryState(stateRef.current, codec()) !== "") return;

    const stored = readStorage(key);
    if (!stored) return;

    const restored = parseQueryState(stored, codec());
    update(() => restored, true);
  }, [update]);

  const ownQuery = serializeQueryState(state, toCodecOptions(options));
  const persistKey = options.persist;
  useEffect(() => {
    if (persistKey) writeStorage(persistKey, ownQuery);
  }, [persistKey, ownQuery]);

  const commitSearch = useCallback(
    (search: string) => {
      update((prev) => ({
        ...prev,
        search,
        pagination: { ...prev.pagination, page: firstPage() },
      }));
    },
    [update],
  );

  const setSearch = useCallback(
    (search: string) => {
      cancelSearchTimer();
      const delay = optionsRef.current.searchDebounce ?? 0;
      // Clearing (an "×" button, a removed chip) shouldn't wait for the debounce.
      if (delay <= 0 || search === "") {
        setTypedSearch(search);
        commitSearch(search);
        return;
      }

      setTypedSearch(search);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        commitSearch(search);
      }, delay);
    },
    [cancelSearchTimer, commitSearch],
  );

  const setFilter = useCallback(
    (key: string, value: FilterValue) => {
      update((prev) => ({
        ...prev,
        filters: { ...prev.filters, [key]: value },
        pagination: { ...prev.pagination, page: firstPage() },
      }));
    },
    [update],
  );

  const setFilters = useCallback(
    (changes: Record<string, FilterValue>) => {
      update((prev) => {
        const filters = { ...prev.filters };
        for (const [key, value] of Object.entries(changes)) {
          if (value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
            delete filters[key];
          } else {
            filters[key] = value;
          }
        }
        return {
          ...prev,
          filters,
          pagination: { ...prev.pagination, page: firstPage() },
        };
      });
    },
    [update],
  );

  const toggleFilterValue = useCallback(
    (key: string, value: string) => {
      update((prev) => {
        const current = prev.filters[key];
        // Without a schema, a one-item array comes back from the URL as a plain string.
        const items = Array.isArray(current)
          ? current
          : typeof current === "string" && current !== ""
            ? [current]
            : [];
        const next = items.includes(value)
          ? items.filter((item) => item !== value)
          : [...items, value];

        const filters = { ...prev.filters };
        if (next.length > 0) filters[key] = next;
        else delete filters[key];

        return {
          ...prev,
          filters,
          pagination: { ...prev.pagination, page: firstPage() },
        };
      });
    },
    [update],
  );

  const removeFilter = useCallback(
    (key: string) => {
      update((prev) => {
        const filters = { ...prev.filters };
        delete filters[key];
        return {
          ...prev,
          filters,
          pagination: { ...prev.pagination, page: firstPage() },
        };
      });
    },
    [update],
  );

  const setRangeFilter = useCallback(
    (key: string, range: Partial<RangeValue>) => {
      update((prev) => {
        const { fromKey, toKey } = getRangeFilterKeys(key);
        const filters = { ...prev.filters };

        if (range.from !== undefined) {
          if (range.from === null || range.from === "") delete filters[fromKey];
          else filters[fromKey] = range.from;
        }

        if (range.to !== undefined) {
          if (range.to === null || range.to === "") delete filters[toKey];
          else filters[toKey] = range.to;
        }

        return {
          ...prev,
          filters,
          pagination: { ...prev.pagination, page: firstPage() },
        };
      });
    },
    [update],
  );

  const removeRangeFilter = useCallback(
    (key: string) => {
      update((prev) => {
        const { fromKey, toKey } = getRangeFilterKeys(key);
        const filters = { ...prev.filters };
        delete filters[fromKey];
        delete filters[toKey];
        return {
          ...prev,
          filters,
          pagination: { ...prev.pagination, page: firstPage() },
        };
      });
    },
    [update],
  );

  const getRangeFilterValue = useCallback(
    (key: string) => getRangeFilter(state.filters, key),
    [state.filters],
  );

  const setSort = useCallback(
    (field: string, direction?: SortDirection) => {
      update((prev) => {
        if (direction) {
          return { ...prev, sort: { field, direction } };
        }

        if (prev.sort?.field === field) {
          return {
            ...prev,
            sort: prev.sort.direction === "asc" ? { field, direction: "desc" } : null,
          };
        }

        return { ...prev, sort: { field, direction: "asc" } };
      });
    },
    [update],
  );

  const clearSort = useCallback(() => {
    update((prev) => ({ ...prev, sort: null }));
  }, [update]);

  const setPage = useCallback(
    (page: number) => {
      update((prev) => ({ ...prev, pagination: { ...prev.pagination, page } }));
    },
    [update],
  );

  const setPageSize = useCallback(
    (pageSize: number) => {
      update((prev) => ({ ...prev, pagination: { page: firstPage(), pageSize } }));
    },
    [update],
  );

  const reset = useCallback(() => {
    cancelSearchTimer();
    setTypedSearch("");
    update(() => ({
      search: "",
      filters: {},
      sort: null,
      pagination: {
        page: firstPage(),
        pageSize: optionsRef.current.defaultPageSize ?? 20,
      },
    }));
  }, [cancelSearchTimer, update]);

  const clearFilters = useCallback(
    (clearOptions: { includeSearch?: boolean } = {}) => {
      if (clearOptions.includeSearch) {
        cancelSearchTimer();
        setTypedSearch("");
      }
      update((prev) => ({
        ...prev,
        search: clearOptions.includeSearch ? "" : prev.search,
        filters: {},
        pagination: { ...prev.pagination, page: firstPage() },
      }));
    },
    [cancelSearchTimer, update],
  );

  const setState = useCallback(
    (next: Partial<QueryState> | ((prev: QueryState) => QueryState)) => {
      update((prev) => (typeof next === "function" ? next(prev) : { ...prev, ...next }));
    },
    [update],
  );

  const apiCodec = (): ParseOptions => {
    const { prefix: _prefix, ...rest } = codec();
    return rest;
  };

  const toApiQueryString = useCallback(() => serializeQueryState(stateRef.current, apiCodec()), []);

  const queryKeyString = toQueryKey(state, apiCodec())[1];
  const queryKey = useMemo(
    () => ["react-query-filters", queryKeyString] as const,
    [queryKeyString],
  );

  const activeFilterCount = getActiveFilters(state.filters).length;

  return {
    state: state as TypedQueryState<S>,
    searchInput: searchDebounce > 0 ? typedSearch : state.search,
    setSearch,
    setFilter,
    setFilters,
    toggleFilterValue,
    removeFilter,
    setRangeFilter,
    removeRangeFilter,
    getRangeFilter: getRangeFilterValue,
    setSort,
    clearSort,
    setPage,
    setPageSize,
    reset,
    clearFilters,
    setState,
    activeFilterCount,
    isFiltered: state.search !== "" || activeFilterCount > 0,
    queryKey,
    toQueryString: toApiQueryString,
  };
}
