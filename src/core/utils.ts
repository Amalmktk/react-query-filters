import type { PaginationState, QueryState } from "./types.js";

export interface DefaultQueryStateOptions {
  defaultPage?: number;
  defaultPageSize?: number;
}

export function createDefaultQueryState(
  options: DefaultQueryStateOptions = {},
): QueryState {
  const { defaultPage = 1, defaultPageSize = 20 } = options;

  return {
    search: "",
    filters: {},
    sort: null,
    pagination: { page: defaultPage, pageSize: defaultPageSize },
  };
}

export function isEqualQueryState(a: QueryState, b: QueryState): boolean {
  return (
    a.search === b.search &&
    isEqualPagination(a.pagination, b.pagination) &&
    isEqualSort(a, b) &&
    isEqualFilters(a, b)
  );
}

function isEqualPagination(a: PaginationState, b: PaginationState): boolean {
  return a.page === b.page && a.pageSize === b.pageSize;
}

function isEqualSort(a: QueryState, b: QueryState): boolean {
  if (a.sort === b.sort) return true;
  if (!a.sort || !b.sort) return false;
  return a.sort.field === b.sort.field && a.sort.direction === b.sort.direction;
}

function isEqualFilters(a: QueryState, b: QueryState): boolean {
  const aKeys = Object.keys(a.filters);
  const bKeys = Object.keys(b.filters);
  if (aKeys.length !== bKeys.length) return false;

  return aKeys.every((key) => {
    const aValue = a.filters[key];
    const bValue = b.filters[key];

    if (Array.isArray(aValue) && Array.isArray(bValue)) {
      return aValue.length === bValue.length && aValue.every((v, i) => v === bValue[i]);
    }

    return aValue === bValue;
  });
}
