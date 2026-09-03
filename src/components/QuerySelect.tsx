"use client";

import type { ReactNode } from "react";
import { useQueryFiltersContext } from "../react/context.js";
import type { FilterValue } from "../core/types.js";

export interface QuerySelectRenderProps {
  value: FilterValue;
  setValue: (value: FilterValue) => void;
}

export interface QuerySelectProps {
  /** The filter key this select controls, e.g. "status". */
  name: string;
  children: (props: QuerySelectRenderProps) => ReactNode;
}

export function QuerySelect({ name, children }: QuerySelectProps): ReactNode {
  const { state, setFilter, removeFilter } = useQueryFiltersContext();
  const value = state.filters[name] ?? null;

  const setValue = (next: FilterValue) => {
    if (next === null || next === "") {
      removeFilter(name);
    } else {
      setFilter(name, next);
    }
  };

  return children({ value, setValue });
}
