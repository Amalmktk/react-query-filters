"use client";

import type { ReactNode } from "react";
import { useQueryFiltersContext } from "../react/context.js";

export interface QueryResetRenderProps {
  reset: () => void;
}

export interface QueryResetProps {
  children: (props: QueryResetRenderProps) => ReactNode;
}

export function QueryReset({ children }: QueryResetProps): ReactNode {
  const { reset } = useQueryFiltersContext();
  return children({ reset });
}
