export type FilterValue = string | number | boolean | string[] | null;

export type SortDirection = "asc" | "desc";

export interface SortState {
  field: string;
  direction: SortDirection;
}

export interface PaginationState {
  page: number;
  pageSize: number;
}

export interface QueryState {
  search: string;
  filters: Record<string, FilterValue>;
  sort: SortState | null;
  pagination: PaginationState;
}
