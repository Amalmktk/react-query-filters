import { encodeArrayItem, resolveKeys } from "./keys.js";
import type { QueryKeyOptions, QueryState } from "./types.js";

export interface SerializeOptions extends QueryKeyOptions {
  defaultPage?: number;
  defaultPageSize?: number;
}

export function serializeQueryState(
  state: QueryState,
  options: SerializeOptions = {},
): string {
  const { defaultPage = 1, defaultPageSize = 20, schema = {} } = options;
  const keys = resolveKeys(options);
  const params = new URLSearchParams();

  if (state.search) {
    params.set(keys.toParam(keys.search), state.search);
  }

  for (const [key, value] of Object.entries(state.filters)) {
    if (value === null || value === "") continue;

    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      const typed = Object.prototype.hasOwnProperty.call(schema, key);
      const items = typed ? value.map(encodeArrayItem) : value;
      params.set(keys.toParam(key), items.join(","));
      continue;
    }

    params.set(keys.toParam(key), String(value));
  }

  if (state.sort) {
    params.set(keys.toParam(keys.sort), `${state.sort.field}:${state.sort.direction}`);
  }

  if (state.pagination.page !== defaultPage) {
    params.set(keys.toParam(keys.page), String(state.pagination.page));
  }

  if (state.pagination.pageSize !== defaultPageSize) {
    params.set(keys.toParam(keys.pageSize), String(state.pagination.pageSize));
  }

  return params.toString();
}
