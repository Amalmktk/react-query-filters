"use client";

import type { ReactNode } from "react";
import { useQueryFiltersContext } from "../react/context.js";

export interface QuerySearchRenderProps {
  /** The text as typed. With `searchDebounce`, it updates on every keystroke while the URL waits for typing to pause. */
  value: string;
  setValue: (value: string) => void;
}

export interface QuerySearchProps {
  children: (props: QuerySearchRenderProps) => ReactNode;
}

export function QuerySearch({ children }: QuerySearchProps): ReactNode {
  const { searchInput, setSearch } = useQueryFiltersContext();
  return children({ value: searchInput, setValue: setSearch });
}
