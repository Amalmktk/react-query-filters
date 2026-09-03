"use client";

import type { ReactNode } from "react";
import { useQueryFiltersContext } from "../react/context.js";

export interface QueryPaginationRenderProps {
  page: number;
  pageSize: number;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
}

export interface QueryPaginationProps {
  children: (props: QueryPaginationRenderProps) => ReactNode;
}

export function QueryPagination({ children }: QueryPaginationProps): ReactNode {
  const { state, setPage, setPageSize } = useQueryFiltersContext();

  return children({
    page: state.pagination.page,
    pageSize: state.pagination.pageSize,
    setPage,
    setPageSize,
  });
}
