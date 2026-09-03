import type { QueryState } from "./types.js";

export interface SerializeOptions {
  defaultPage?: number;
  defaultPageSize?: number;
}

export function serializeQueryState(
  state: QueryState,
  options: SerializeOptions = {},
): string {
  const { defaultPage = 1, defaultPageSize = 20 } = options;
  const params = new URLSearchParams();

  if (state.search) {
    params.set("search", state.search);
  }

  for (const [key, value] of Object.entries(state.filters)) {
    if (value === null || value === "") continue;

    if (Array.isArray(value)) {
      if (value.length > 0) params.set(key, value.join(","));
      continue;
    }

    params.set(key, String(value));
  }

  if (state.sort) {
    params.set("sort", `${state.sort.field}:${state.sort.direction}`);
  }

  if (state.pagination.page !== defaultPage) {
    params.set("page", String(state.pagination.page));
  }

  if (state.pagination.pageSize !== defaultPageSize) {
    params.set("pageSize", String(state.pagination.pageSize));
  }

  return params.toString();
}
