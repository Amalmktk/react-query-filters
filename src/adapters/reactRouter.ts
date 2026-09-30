import type { QueryFiltersAdapter } from "./types.js";

export interface ReactRouterAdapterOptions {
  /** Both values from `useSearchParams()` in `react-router` (v6 or v7). */
  searchParams: URLSearchParams;
  setSearchParams: (next: URLSearchParams, options?: { replace?: boolean }) => void;
}

/**
 * Adapter for React Router. Call its hook yourself and pass the results in,
 * so this package doesn't depend on `react-router`:
 *
 * ```ts
 * const [searchParams, setSearchParams] = useSearchParams();
 * const filters = useQueryFilters({
 *   adapter: createReactRouterAdapter({ searchParams, setSearchParams }),
 * });
 * ```
 */
export function createReactRouterAdapter(options: ReactRouterAdapterOptions): QueryFiltersAdapter {
  const { searchParams, setSearchParams } = options;

  return {
    getSearch: () => searchParams.toString(),
    update: (search, { replace }) => setSearchParams(new URLSearchParams(search), { replace }),
  };
}
