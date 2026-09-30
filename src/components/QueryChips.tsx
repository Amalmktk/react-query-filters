"use client";

import type { ReactNode } from "react";
import { useQueryFiltersContext } from "../react/context.js";
import { getActiveFilters } from "../core/utils.js";

export interface QueryChip {
  /** Unique per chip, for React's `key`. */
  id: string;
  /** The filter key, or `"search"` for the search chip. */
  key: string;
  /** The value this chip shows. An array filter gets one chip per item. */
  value: string | number | boolean;
  /** Removes just this chip: the filter, one item of an array filter, or the search term. */
  remove: () => void;
}

export interface QueryChipsRenderProps {
  chips: QueryChip[];
  /** Clears every filter (and the search, with `includeSearch`), keeping sort and page size. */
  clearAll: () => void;
}

export interface QueryChipsProps {
  /** Also show the search term as a chip. Defaults to false. */
  includeSearch?: boolean;
  children: (props: QueryChipsRenderProps) => ReactNode;
}

export function QueryChips({ includeSearch = false, children }: QueryChipsProps): ReactNode {
  const { state, setSearch, toggleFilterValue, removeFilter, clearFilters } = useQueryFiltersContext();
  const chips: QueryChip[] = [];

  if (includeSearch && state.search) {
    chips.push({ id: "search", key: "search", value: state.search, remove: () => setSearch("") });
  }

  const active = getActiveFilters(state.filters);
  for (const { key, value } of active) {
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        chips.push({
          id: `${key}:${index}:${item}`,
          key,
          value: item,
          remove: () => toggleFilterValue(key, item),
        });
      });
      continue;
    }

    chips.push({ id: `${key}:${String(value)}`, key, value, remove: () => removeFilter(key) });
  }

  const clearAll = () => clearFilters({ includeSearch });

  return children({ chips, clearAll });
}
