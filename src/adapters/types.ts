/**
 * Connects `useQueryFilters` to wherever the URL lives: the browser's
 * History API (the default), a framework router, or anything else.
 */
export interface QueryFiltersAdapter {
  /** The current query string (with or without a leading `?`), or `null` when it can't be read yet (e.g. during SSR). */
  getSearch: () => string | null;
  /** Navigates to a new query string (no leading `?`; empty means no query). */
  update: (search: string, options: { replace: boolean }) => void;
  /**
   * Calls `onChange` when the URL changes outside the hook (back/forward,
   * another instance). Optional: router adapters don't need it, because the
   * router re-renders the component with fresh search params. Pass a stable
   * function; a new one on every render re-subscribes every render.
   */
  subscribe?: (onChange: () => void) => () => void;
}
