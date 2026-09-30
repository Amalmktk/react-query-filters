import { StrictMode, type ReactNode } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useQueryFilters } from "../src/react/useQueryFilters.js";
import { createNextAdapter } from "../src/adapters/next.js";
import { createReactRouterAdapter } from "../src/adapters/reactRouter.js";
import type { QueryFiltersAdapter } from "../src/adapters/types.js";

function setLocation(path: string) {
  window.history.pushState(null, "", path);
}

beforeEach(() => {
  setLocation("/products");
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  setLocation("/products");
});

describe("schema option", () => {
  it("parses typed filters from the URL", () => {
    setLocation("/products?price=10&inStock=true&tags=a");
    const { result } = renderHook(() =>
      useQueryFilters({ schema: { price: "number", inStock: "boolean", tags: "array" } }),
    );

    expect(result.current.state.filters).toEqual({ price: 10, inStock: true, tags: ["a"] });
  });

  it("keeps typed values after writing them", () => {
    const { result } = renderHook(() => useQueryFilters({ schema: { price: "number" } }));

    act(() => result.current.setFilter("price", 25));

    expect(result.current.state.filters.price).toBe(25);
    expect(window.location.search).toBe("?price=25");
  });
});

describe("prefix option", () => {
  it("keeps two namespaced instances independent on one URL", () => {
    const { result } = renderHook(() => ({
      orders: useQueryFilters({ prefix: "orders" }),
      users: useQueryFilters({ prefix: "users" }),
    }));

    act(() => result.current.orders.setPage(2));
    act(() => result.current.users.setPage(5));

    expect(result.current.orders.state.pagination.page).toBe(2);
    expect(result.current.users.state.pagination.page).toBe(5);
    expect(window.location.search).toBe("?orders.page=2&users.page=5");
  });

  it("leaves unrelated params in the URL", () => {
    setLocation("/products?utm_source=mail");
    const { result } = renderHook(() => useQueryFilters({ prefix: "orders" }));

    act(() => result.current.setFilter("status", "open"));

    expect(window.location.search).toBe("?utm_source=mail&orders.status=open");
  });
});

describe("paramNames option", () => {
  it("reads and writes renamed params", () => {
    setLocation("/products?q=pen");
    const { result } = renderHook(() => useQueryFilters({ paramNames: { search: "q" } }));

    expect(result.current.state.search).toBe("pen");
    act(() => result.current.setSearch("laptop"));
    expect(window.location.search).toBe("?q=laptop");
  });
});

describe("multiple instances", () => {
  it("keeps separate unprefixed instances in sync", () => {
    const { result } = renderHook(() => ({ a: useQueryFilters(), b: useQueryFilters() }));

    act(() => result.current.a.setFilter("status", "active"));

    expect(result.current.b.state.filters.status).toBe("active");
  });

  it("keeps a written value's type in the instance that wrote it", () => {
    const { result } = renderHook(() => ({ a: useQueryFilters(), b: useQueryFilters() }));

    act(() => result.current.a.setFilter("count", 5));

    expect(result.current.a.state.filters.count).toBe(5);
    expect(result.current.b.state.filters.count).toBe("5");
  });
});

describe("initialSearchParams option", () => {
  it("builds the first render from the given params instead of window.location", () => {
    const { result } = renderHook(() =>
      useQueryFilters({ initialSearchParams: { search: "laptop" } }),
    );

    // The URL (/products) has no search, so after mount the hook follows the real URL.
    expect(result.current.state.search).toBe("");
  });

  it("matches the URL without an extra update when both agree", () => {
    setLocation("/products?search=laptop&sort=price:asc");
    const renders: string[] = [];

    renderHook(() => {
      const { state } = useQueryFilters({
        initialSearchParams: { search: "laptop", sort: "price:asc" },
      });
      renders.push(state.search);
      return state;
    });

    expect(renders.every((search) => search === "laptop")).toBe(true);
  });
});

describe("adapters", () => {
  function fakeAdapter(initial = "") {
    let search = initial;
    const listeners = new Set<() => void>();
    const adapter: QueryFiltersAdapter & { navigate: (next: string) => void } = {
      getSearch: () => search,
      update: vi.fn((next: string) => {
        search = next;
        listeners.forEach((listener) => listener());
      }),
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      navigate: (next) => {
        search = next;
        listeners.forEach((listener) => listener());
      },
    };
    return adapter;
  }

  it("reads from and writes to a custom adapter instead of window.history", () => {
    const adapter = fakeAdapter("status=open");
    const { result } = renderHook(() => useQueryFilters({ adapter }));

    expect(result.current.state.filters.status).toBe("open");

    act(() => result.current.setPage(2));

    expect(adapter.update).toHaveBeenCalledWith("status=open&page=2", { replace: false });
    expect(window.location.search).toBe("");
  });

  it("follows navigation reported by the adapter", () => {
    const adapter = fakeAdapter();
    const { result } = renderHook(() => useQueryFilters({ adapter }));

    act(() => adapter.navigate("search=phone"));

    expect(result.current.state.search).toBe("phone");
  });

  it("works with a router that applies writes asynchronously (Next.js)", () => {
    let current = "";
    const push = vi.fn();
    const router = { push, replace: vi.fn() };

    const { result, rerender } = renderHook(() =>
      useQueryFilters({
        adapter: createNextAdapter({
          router,
          pathname: "/products",
          searchParams: new URLSearchParams(current),
        }),
      }),
    );

    act(() => result.current.setFilter("status", "open"));
    expect(push).toHaveBeenCalledWith("/products?status=open", { scroll: false });

    // Next hasn't navigated yet: the stale URL must not undo the change.
    rerender();
    expect(result.current.state.filters.status).toBe("open");

    // Next navigates, then the user presses back.
    current = "status=open";
    rerender();
    expect(result.current.state.filters.status).toBe("open");

    current = "";
    rerender();
    expect(result.current.state.filters).toEqual({});
  });

  it("doesn't re-parse its own writes when the router catches up (Next.js)", () => {
    let current = "";
    const router = { push: vi.fn(), replace: vi.fn() };

    const { result, rerender } = renderHook(() =>
      useQueryFilters({
        adapter: createNextAdapter({
          router,
          pathname: "/products",
          searchParams: new URLSearchParams(current),
        }),
      }),
    );

    act(() => result.current.setFilter("count", 5));
    act(() => result.current.setPage(2));

    current = "count=5";
    rerender();
    current = "count=5&page=2";
    rerender();

    expect(result.current.state.filters.count).toBe(5);
    expect(result.current.state.pagination.page).toBe(2);
  });

  it("uses router.replace when replace is set (Next.js)", () => {
    const router = { push: vi.fn(), replace: vi.fn() };
    const { result } = renderHook(() =>
      useQueryFilters({
        replace: true,
        adapter: createNextAdapter({ router, pathname: "/p", searchParams: null }),
      }),
    );

    act(() => result.current.reset());
    expect(router.replace).toHaveBeenCalledWith("/p", { scroll: false });
  });

  it("passes the replace flag through to React Router", () => {
    const setSearchParams = vi.fn();
    const { result } = renderHook(() =>
      useQueryFilters({
        adapter: createReactRouterAdapter({
          searchParams: new URLSearchParams("status=open"),
          setSearchParams,
        }),
      }),
    );

    act(() => result.current.setPage(3));

    const [params, options] = setSearchParams.mock.calls[0]!;
    expect((params as URLSearchParams).toString()).toBe("status=open&page=3");
    expect(options).toEqual({ replace: false });
  });
});

describe("searchDebounce option", () => {
  it("updates searchInput immediately and the URL after the delay", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useQueryFilters({ searchDebounce: 300 }));

    act(() => result.current.setSearch("l"));
    act(() => result.current.setSearch("la"));
    act(() => result.current.setSearch("lap"));

    expect(result.current.searchInput).toBe("lap");
    expect(result.current.state.search).toBe("");
    expect(window.location.search).toBe("");

    act(() => vi.advanceTimersByTime(300));

    expect(result.current.state.search).toBe("lap");
    expect(window.location.search).toBe("?search=lap");
  });

  it("writes only one history entry for a burst of typing", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useQueryFilters({ searchDebounce: 300 }));
    const lengthBefore = window.history.length;

    act(() => {
      result.current.setSearch("a");
      result.current.setSearch("ab");
      result.current.setSearch("abc");
    });
    act(() => vi.advanceTimersByTime(300));

    expect(window.history.length).toBe(lengthBefore + 1);
  });

  it("reset cancels a pending search", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useQueryFilters({ searchDebounce: 300 }));

    act(() => result.current.setSearch("lap"));
    act(() => result.current.reset());
    act(() => vi.advanceTimersByTime(300));

    expect(result.current.searchInput).toBe("");
    expect(result.current.state.search).toBe("");
    expect(window.location.search).toBe("");
  });

  it("syncs searchInput when the URL changes from outside", () => {
    const { result } = renderHook(() => useQueryFilters({ searchDebounce: 300 }));

    act(() => {
      setLocation("/products?search=phone");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(result.current.searchInput).toBe("phone");
  });

  it("without a debounce, searchInput always equals state.search", () => {
    const { result } = renderHook(() => useQueryFilters());

    act(() => result.current.setSearch("lap"));

    expect(result.current.searchInput).toBe("lap");
    expect(result.current.state.search).toBe("lap");
  });
});

describe("batch updates", () => {
  it("setFilters applies several filters in one history entry and resets the page", () => {
    setLocation("/products?page=3&role=admin");
    const { result } = renderHook(() => useQueryFilters());
    const lengthBefore = window.history.length;

    act(() => result.current.setFilters({ status: "open", tags: ["a", "b"], role: null }));

    expect(result.current.state.filters).toEqual({ status: "open", tags: ["a", "b"] });
    expect(result.current.state.pagination.page).toBe(1);
    expect(window.history.length).toBe(lengthBefore + 1);
  });

  it("setState merges a partial state without resetting the page", () => {
    setLocation("/products?page=3");
    const { result } = renderHook(() => useQueryFilters());

    act(() => result.current.setState({ search: "pen", sort: { field: "price", direction: "asc" } }));

    expect(result.current.state.search).toBe("pen");
    expect(result.current.state.pagination.page).toBe(3);
    expect(window.location.search).toBe("?search=pen&sort=price%3Aasc&page=3");
  });

  it("setState accepts an updater function", () => {
    const { result } = renderHook(() => useQueryFilters());

    act(() =>
      result.current.setState((prev) => ({ ...prev, filters: { ...prev.filters, a: "1" } })),
    );

    expect(result.current.state.filters).toEqual({ a: "1" });
  });

  it("clearFilters keeps sort and page size", () => {
    setLocation("/products?search=pen&status=open&sort=price:asc&page=3&pageSize=50");
    const { result } = renderHook(() => useQueryFilters());

    act(() => result.current.clearFilters());

    expect(window.location.search).toBe("?search=pen&sort=price%3Aasc&pageSize=50");

    act(() => result.current.clearFilters({ includeSearch: true }));

    expect(window.location.search).toBe("?sort=price%3Aasc&pageSize=50");
  });
});

describe("active-filter helpers", () => {
  it("counts only filters with a value", () => {
    const { result } = renderHook(() => useQueryFilters());

    expect(result.current.activeFilterCount).toBe(0);
    expect(result.current.isFiltered).toBe(false);

    act(() => result.current.setFilters({ status: "open", tags: ["a"] }));
    act(() => result.current.setFilter("empty", ""));

    expect(result.current.activeFilterCount).toBe(2);
    expect(result.current.isFiltered).toBe(true);
  });

  it("isFiltered is true for a search alone", () => {
    setLocation("/products?search=pen");
    const { result } = renderHook(() => useQueryFilters());

    expect(result.current.activeFilterCount).toBe(0);
    expect(result.current.isFiltered).toBe(true);
  });
});

describe("data-fetching helpers", () => {
  it("queryKey stays the same object until the query changes", () => {
    const { result, rerender } = renderHook(() => useQueryFilters());
    const first = result.current.queryKey;

    rerender();
    expect(result.current.queryKey).toBe(first);

    act(() => result.current.setPage(2));
    expect(result.current.queryKey).not.toEqual(first);
  });

  it("toQueryString leaves out the prefix", () => {
    const { result } = renderHook(() => useQueryFilters({ prefix: "orders" }));

    act(() => result.current.setFilter("status", "open"));

    expect(window.location.search).toBe("?orders.status=open");
    expect(result.current.toQueryString()).toBe("status=open");
  });
});

describe("persist option", () => {
  it("saves state to localStorage on every change", () => {
    const { result } = renderHook(() => useQueryFilters({ persist: "products" }));

    act(() => result.current.setFilter("status", "open"));

    expect(window.localStorage.getItem("products")).toBe("status=open");
  });

  it("restores saved state when the URL is empty, without adding a history entry", () => {
    window.localStorage.setItem("products", "status=open&page=2");
    const lengthBefore = window.history.length;

    const { result } = renderHook(() => useQueryFilters({ persist: "products" }));

    expect(result.current.state.filters.status).toBe("open");
    expect(result.current.state.pagination.page).toBe(2);
    expect(window.location.search).toBe("?status=open&page=2");
    expect(window.history.length).toBe(lengthBefore);
  });

  it("prefers the URL over saved state", () => {
    window.localStorage.setItem("products", "status=open");
    setLocation("/products?status=closed");

    const { result } = renderHook(() => useQueryFilters({ persist: "products" }));

    expect(result.current.state.filters.status).toBe("closed");
  });

  it("does not bring back filters the user cleared", () => {
    const first = renderHook(() => useQueryFilters({ persist: "products" }));
    act(() => first.result.current.setFilter("status", "open"));
    act(() => first.result.current.reset());
    first.unmount();

    const second = renderHook(() => useQueryFilters({ persist: "products" }));
    expect(second.result.current.state.filters).toEqual({});
  });

  it("keeps working when localStorage throws", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    const { result } = renderHook(() => useQueryFilters({ persist: "products" }));
    act(() => result.current.setFilter("status", "open"));

    expect(window.location.search).toBe("?status=open");
    getItem.mockRestore();
    setItem.mockRestore();
  });
});

describe("StrictMode", () => {
  it("adds one history entry per change", () => {
    const wrapper = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>;
    const { result } = renderHook(() => useQueryFilters(), { wrapper });
    const lengthBefore = window.history.length;

    act(() => result.current.setFilter("status", "open"));

    expect(window.history.length).toBe(lengthBefore + 1);
  });
});

describe("schema types", () => {
  it("types state.filters from the schema", () => {
    const { result } = renderHook(() =>
      useQueryFilters({ schema: { price: "number", tags: "array" } }),
    );

    const price: number | undefined = result.current.state.filters.price;
    const tags: string[] | undefined = result.current.state.filters.tags;
    // @ts-expect-error price is a number, not a string
    const wrong: string | undefined = result.current.state.filters.price;
    // Keys outside the schema keep the untyped FilterValue.
    const other = result.current.state.filters.status;

    expect([price, tags, wrong, other]).toEqual([undefined, undefined, undefined, undefined]);
  });
});
