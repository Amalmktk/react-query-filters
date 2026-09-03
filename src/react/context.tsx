"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useQueryFilters } from "./useQueryFilters.js";
import type { UseQueryFiltersOptions, UseQueryFiltersResult } from "./useQueryFilters.js";

const QueryFiltersContext = createContext<UseQueryFiltersResult | null>(null);

export interface QueryFiltersProviderProps extends UseQueryFiltersOptions {
  children: ReactNode;
}

/**
 * Runs a single `useQueryFilters()` instance and shares it via context, so
 * multiple components (search box, filter selects, pagination, sort headers)
 * read from and write to the same URL-synced state instead of each syncing
 * the URL independently.
 */
export function QueryFiltersProvider(props: QueryFiltersProviderProps): ReactNode {
  const { children, ...options } = props;
  const queryFilters = useQueryFilters(options);

  return (
    <QueryFiltersContext.Provider value={queryFilters}>{children}</QueryFiltersContext.Provider>
  );
}

export function useQueryFiltersContext(): UseQueryFiltersResult {
  const context = useContext(QueryFiltersContext);

  if (!context) {
    throw new Error("useQueryFiltersContext must be used within a <QueryFiltersProvider>");
  }

  return context;
}
