export type FilterValue = string | number | boolean | string[] | null;

/**
 * A two-sided bound filter (a date range, a price range, etc). Not a
 * distinct `FilterValue` variant — it's a convenience shape read from, and
 * written to, two ordinary string filters (`${key}From` / `${key}To`), so it
 * needs no changes to `parseQueryState`/`serializeQueryState` and works with
 * every existing filter mechanism. Either side may be `null` for an
 * open-ended range (e.g. "$10 and up").
 */
export interface RangeValue {
  from: string | null;
  to: string | null;
}

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
