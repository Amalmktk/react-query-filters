"use client";

import type { ReactNode } from "react";
import { useQueryFiltersContext } from "../react/context.js";
import type { SortDirection } from "../core/types.js";

export interface QuerySortRenderProps {
  /** Current sort direction for this field, or null if it isn't the active sort field. */
  direction: SortDirection | null;
  /** Cycles this field through asc -> desc -> cleared. */
  toggle: () => void;
}

export interface QuerySortProps {
  /** The field this sort control represents, e.g. "price". */
  field: string;
  children: (props: QuerySortRenderProps) => ReactNode;
}

export function QuerySort({ field, children }: QuerySortProps): ReactNode {
  const { state, setSort } = useQueryFiltersContext();
  const direction = state.sort?.field === field ? state.sort.direction : null;

  return children({ direction, toggle: () => setSort(field) });
}
