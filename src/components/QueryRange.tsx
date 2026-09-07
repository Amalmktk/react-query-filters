"use client";

import type { ReactNode } from "react";
import { useQueryFiltersContext } from "../react/context.js";
import type { RangeValue } from "../core/types.js";

export interface QueryRangeRenderProps {
  from: string | null;
  to: string | null;
  setFrom: (value: string | null) => void;
  setTo: (value: string | null) => void;
  setRange: (range: Partial<RangeValue>) => void;
  clear: () => void;
}

export interface QueryRangeProps {
  /** The filter key this range controls, e.g. "price" or "createdAt" — reads/writes `${name}From` and `${name}To`. */
  name: string;
  children: (props: QueryRangeRenderProps) => ReactNode;
}

export function QueryRange({ name, children }: QueryRangeProps): ReactNode {
  const { getRangeFilter, setRangeFilter, removeRangeFilter } = useQueryFiltersContext();
  const { from, to } = getRangeFilter(name);

  return children({
    from,
    to,
    setFrom: (value) => setRangeFilter(name, { from: value }),
    setTo: (value) => setRangeFilter(name, { to: value }),
    setRange: (range) => setRangeFilter(name, range),
    clear: () => removeRangeFilter(name),
  });
}
