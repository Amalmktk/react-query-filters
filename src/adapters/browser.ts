import type { QueryFiltersAdapter } from "./types.js";

/** Fired on `window` after every URL write, so other `useQueryFilters` instances on the page re-read the URL (`pushState` doesn't fire `popstate`). */
const CHANGE_EVENT = "react-query-filters:change";

/** The default adapter: reads `window.location` and writes with `history.pushState`/`replaceState`. */
export const browserAdapter: QueryFiltersAdapter = {
  getSearch: () => (typeof window === "undefined" ? null : window.location.search),

  update: (search, { replace }) => {
    if (typeof window === "undefined") return;

    const url = `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`;
    window.history[replace ? "replaceState" : "pushState"](null, "", url);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  },

  subscribe: (onChange) => {
    window.addEventListener("popstate", onChange);
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => {
      window.removeEventListener("popstate", onChange);
      window.removeEventListener(CHANGE_EVENT, onChange);
    };
  },
};
