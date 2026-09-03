"use client";

import type { ReactNode } from "react";
import { useQueryFiltersContext } from "../react/context.js";

export interface QuerySearchRenderProps {
  value: string;
  setValue: (value: string) => void;
}

export interface QuerySearchProps {
  children: (props: QuerySearchRenderProps) => ReactNode;
}

export function QuerySearch({ children }: QuerySearchProps): ReactNode {
  const { state, setSearch } = useQueryFiltersContext();
  return children({ value: state.search, setValue: setSearch });
}
