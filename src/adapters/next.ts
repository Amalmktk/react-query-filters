import type { QueryFiltersAdapter } from "./types.js";

export interface NextAdapterOptions {
  /** From `useRouter()` in `next/navigation`. */
  router: {
    push: (href: string, options?: { scroll?: boolean }) => void;
    replace: (href: string, options?: { scroll?: boolean }) => void;
  };
  /** From `usePathname()`. */
  pathname: string;
  /** From `useSearchParams()`. */
  searchParams: { toString: () => string } | null;
  /** Scroll to the top on each filter change. Defaults to false. */
  scroll?: boolean;
}

/**
 * Adapter for the Next.js App Router. Call Next's hooks yourself and pass
 * the results in, so this package doesn't depend on `next`:
 *
 * ```ts
 * const adapter = createNextAdapter({
 *   router: useRouter(),
 *   pathname: usePathname(),
 *   searchParams: useSearchParams(),
 * });
 * const filters = useQueryFilters({ adapter });
 * ```
 */
export function createNextAdapter(options: NextAdapterOptions): QueryFiltersAdapter {
  const { router, pathname, searchParams, scroll = false } = options;

  return {
    getSearch: () => searchParams?.toString() ?? "",
    update: (search, { replace }) => {
      const hash = typeof window === "undefined" ? "" : window.location.hash;
      const href = `${pathname}${search ? `?${search}` : ""}${hash}`;
      router[replace ? "replace" : "push"](href, { scroll });
    },
  };
}
