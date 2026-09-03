"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { parseQueryState } from "../core/parser.js";
import { serializeQueryState } from "../core/serializer.js";
import type { FilterValue, QueryState, SortDirection } from "../core/types.js";

export interface UseQueryFiltersOptions {
  /** Page number used when no `page` param is present, and restored to on filter/search changes. Defaults to 1. */
  defaultPage?: number;
  /** Page size used when no `pageSize` param is present. Defaults to 20. */
  defaultPageSize?: number;
  /** Use `history.replaceState` instead of `pushState`, so filter changes don't pollute browser back/forward. Defaults to false. */
  replace?: boolean;
}

export interface UseQueryFiltersResult {
  state: QueryState;
  setSearch: (search: string) => void;
  setFilter: (key: string, value: FilterValue) => void;
  removeFilter: (key: string) => void;
  /** Sets the sort field. Omitting `direction` toggles asc -> desc -> cleared for the given field. */
  setSort: (field: string, direction?: SortDirection) => void;
  clearSort: () => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  reset: () => void;
}

function readLocationSearch(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

export function useQueryFilters(
  options: UseQueryFiltersOptions = {},
): UseQueryFiltersResult {
  const { defaultPage = 1, defaultPageSize = 20, replace = false } = options;

  const parseOptions = useMemo(
    () => ({ defaultPage, defaultPageSize }),
    [defaultPage, defaultPageSize],
  );

  const [state, setState] = useState<QueryState>(() =>
    parseQueryState(readLocationSearch(), parseOptions),
  );

  useEffect(() => {
    const handlePopState = () => {
      setState(parseQueryState(readLocationSearch(), parseOptions));
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [parseOptions]);

  const syncUrl = useCallback(
    (next: QueryState) => {
      if (typeof window === "undefined") return;

      const query = serializeQueryState(next, { defaultPage, defaultPageSize });
      const url = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
      const method = replace ? "replaceState" : "pushState";
      window.history[method](null, "", url);
    },
    [defaultPage, defaultPageSize, replace],
  );

  const update = useCallback(
    (updater: (prev: QueryState) => QueryState) => {
      setState((prev: QueryState) => {
        const next = updater(prev);
        syncUrl(next);
        return next;
      });
    },
    [syncUrl],
  );

  const setSearch = useCallback(
    (search: string) => {
      update((prev) => ({
        ...prev,
        search,
        pagination: { ...prev.pagination, page: defaultPage },
      }));
    },
    [update, defaultPage],
  );

  const setFilter = useCallback(
    (key: string, value: FilterValue) => {
      update((prev) => ({
        ...prev,
        filters: { ...prev.filters, [key]: value },
        pagination: { ...prev.pagination, page: defaultPage },
      }));
    },
    [update, defaultPage],
  );

  const removeFilter = useCallback(
    (key: string) => {
      update((prev) => {
        const filters = { ...prev.filters };
        delete filters[key];
        return {
          ...prev,
          filters,
          pagination: { ...prev.pagination, page: defaultPage },
        };
      });
    },
    [update, defaultPage],
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
      update((prev) => ({ ...prev, pagination: { page: defaultPage, pageSize } }));
    },
    [update, defaultPage],
  );

  const reset = useCallback(() => {
    update(() => ({
      search: "",
      filters: {},
      sort: null,
      pagination: { page: defaultPage, pageSize: defaultPageSize },
    }));
  }, [update, defaultPage, defaultPageSize]);

  return {
    state,
    setSearch,
    setFilter,
    removeFilter,
    setSort,
    clearSort,
    setPage,
    setPageSize,
    reset,
  };
}
