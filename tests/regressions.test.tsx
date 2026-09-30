// @ts-ignore -- @types/react-dom isn't a dev dependency
import { flushSync } from "react-dom";
import { startTransition, useState } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useQueryFilters } from "../src/react/useQueryFilters.js";
import { createNextAdapter } from "../src/adapters/next.js";
import type { QueryFiltersAdapter } from "../src/adapters/types.js";

function setLocation(path: string) {
  window.history.pushState(null, "", path);
}

async function goBack() {
  await act(async () => {
    const done = new Promise<void>((resolve) =>
      window.addEventListener("popstate", () => resolve(), { once: true }),
    );
    window.history.back();
    await done;
  });
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

describe("history navigation after writes that return to the start URL", () => {
  it("back button after a batch whose final URL equals the start URL re-syncs state", async () => {
    setLocation("/products?status=open");
    const { result } = renderHook(() => useQueryFilters());

    // e.g. onClick={() => { reset(); setFilter("status", "open"); }} -- "only this status"
    act(() => {
      result.current.reset();
      result.current.setFilter("status", "open");
    });
    expect(window.location.search).toBe("?status=open");

    // History is now [?status=open, (empty), ?status=open]. Press back once.
    await goBack();
    expect(window.location.search).toBe("");
    expect(result.current.state.filters).toEqual({});
  });
});

describe("router adapter timing", () => {
  it("double-toggle before the router catches up, then back, re-syncs state", () => {
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

    // User clicks a checkbox on, then off, quickly; Next batches both pushes into one transition.
    act(() => result.current.setFilter("inStock", "true"));
    act(() => result.current.removeFilter("inStock"));
    // Router renders only the final URL, which equals the URL we started on.
    rerender();
    expect(result.current.state.filters).toEqual({});

    // History has [/products, ?inStock=true, /products]; user presses back.
    current = "inStock=true";
    rerender();
    expect(result.current.state.filters).toEqual({ inStock: "true" });
  });

  it("two prefixed instances writing before the router catches up don't clobber each other", () => {
    let current = "";
    const router = { push: vi.fn(), replace: vi.fn() };
    const { result } = renderHook(() => {
      const adapter = createNextAdapter({
        router,
        pathname: "/products",
        searchParams: new URLSearchParams(current),
      });
      return {
        a: useQueryFilters({ prefix: "a", adapter }),
        b: useQueryFilters({ prefix: "b", adapter }),
      };
    });

    act(() => {
      result.current.a.setPage(2);
      result.current.b.setPage(3);
    });

    const last = router.push.mock.calls.at(-1)![0] as string;
    expect(last).toBe("/products?a.page=2&b.page=3");
  });
});

describe("concurrent rendering", () => {
  it("a sync render while a transition is pending doesn't drop the transition's change", () => {
    const { result } = renderHook(() => {
      const [, bump] = useState(0);
      return { filters: useQueryFilters(), bump };
    });

    act(() => {
      startTransition(() => result.current.filters.setFilter("category", "shoes"));
      // An urgent render of the same component before the transition commits.
      flushSync(() => result.current.bump((n) => n + 1));
      result.current.filters.setFilter("color", "red");
    });

    expect(result.current.filters.state.filters).toEqual({ category: "shoes", color: "red" });
    expect(window.location.search).toBe("?category=shoes&color=red");
  });
});

describe("default-mode and option edge cases", () => {
  it("default options: a third-party replaceState (no popstate) is not adopted on an unrelated re-render", () => {
    const { result } = renderHook(() => {
      const [, bump] = useState(0);
      return { f: useQueryFilters(), bump };
    });
    window.history.replaceState(null, "", "/products?modal=login");
    act(() => result.current.bump((n) => n + 1));
    expect(result.current.f.state.filters).toEqual({});
  });

  it("searchDebounce: a pending debounced search doesn't overwrite a back/forward navigation", async () => {
    vi.useFakeTimers();
    setLocation("/products?search=old");
    setLocation("/products?search=new");
    const { result } = renderHook(() => useQueryFilters({ searchDebounce: 300 }));
    act(() => result.current.setSearch("typing"));
    act(() => {
      window.history.replaceState(null, "", "/products?search=old");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(result.current.state.search).toBe("old");
    act(() => vi.advanceTimersByTime(300));
    expect(result.current.state.search).toBe("old");
  });

  it("persist: state that came from the URL is saved even if the user never changes anything", () => {
    window.localStorage.setItem("k", "status=closed");
    setLocation("/products?status=open");
    renderHook(() => useQueryFilters({ persist: "k" }));
    expect(window.localStorage.getItem("k")).toBe("status=open");
  });
});

describe("router mode stability", () => {
  it("doesn't loop or navigate on a URL that isn't in canonical form", () => {
    const router = { push: vi.fn(), replace: vi.fn() };
    let renders = 0;
    const { result, rerender } = renderHook(() => {
      renders++;
      return useQueryFilters({
        adapter: createNextAdapter({
          router,
          pathname: "/products",
          // page=1 is the default, sort has no direction, params are out of order.
          searchParams: new URLSearchParams("page=1&status=&sort=price&search=x"),
        }),
      });
    });

    rerender();
    rerender();

    expect(renders).toBeLessThan(6);
    expect(router.push).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    expect(result.current.state.search).toBe("x");
    expect(result.current.state.sort).toEqual({ field: "price", direction: "desc" });
  });

  it("settles when the state can't be represented exactly in the URL", () => {
    let current = "";
    const router = { push: vi.fn((href: string) => (current = href.split("?")[1] ?? "")), replace: vi.fn() };
    const { result, rerender } = renderHook(() =>
      useQueryFilters({
        adapter: createNextAdapter({ router, pathname: "/p", searchParams: new URLSearchParams(current) }),
      }),
    );

    // page 0 isn't a valid page; the URL reads it back as the default page.
    act(() => result.current.setPage(0));
    rerender();
    rerender();

    // A later back navigation is still picked up.
    current = "status=open";
    rerender();
    expect(result.current.state.filters).toEqual({ status: "open" });
  });

  it("keeps the URL hash (Next.js)", () => {
    const router = { push: vi.fn(), replace: vi.fn() };
    window.history.replaceState(null, "", "/products#results");
    const { result } = renderHook(() =>
      useQueryFilters({
        adapter: createNextAdapter({ router, pathname: "/products", searchParams: new URLSearchParams() }),
      }),
    );

    act(() => result.current.setPage(2));
    expect(router.push).toHaveBeenCalledWith("/products?page=2#results", { scroll: false });
  });
});

describe("toggleFilterValue", () => {
  it("adds and removes values of an array filter", () => {
    const { result } = renderHook(() => useQueryFilters());

    act(() => result.current.toggleFilterValue("tags", "a"));
    act(() => result.current.toggleFilterValue("tags", "b"));
    expect(result.current.state.filters.tags).toEqual(["a", "b"]);
    expect(window.location.search).toBe("?tags=a%2Cb");

    act(() => result.current.toggleFilterValue("tags", "a"));
    act(() => result.current.toggleFilterValue("tags", "b"));
    expect(result.current.state.filters).toEqual({});
    expect(window.location.search).toBe("");
  });

  it("treats a single untyped value from the URL as a one-item list", () => {
    setLocation("/products?tags=a&page=3");
    const { result } = renderHook(() => useQueryFilters());

    act(() => result.current.toggleFilterValue("tags", "b"));
    expect(result.current.state.filters.tags).toEqual(["a", "b"]);
    expect(result.current.state.pagination.page).toBe(1);
  });

  it("composes several toggles in one handler", () => {
    const { result } = renderHook(() => useQueryFilters());

    act(() => {
      result.current.toggleFilterValue("tags", "a");
      result.current.toggleFilterValue("tags", "b");
      result.current.toggleFilterValue("tags", "a");
    });
    expect(result.current.state.filters.tags).toEqual(["b"]);
  });
});

describe("searchDebounce clearing", () => {
  it("clearing the search applies immediately", () => {
    vi.useFakeTimers();
    setLocation("/products?search=pen");
    const { result } = renderHook(() => useQueryFilters({ searchDebounce: 300 }));

    act(() => result.current.setSearch(""));
    expect(result.current.state.search).toBe("");
    expect(window.location.search).toBe("");
  });

  it("setState with a search cancels a pending debounced search", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useQueryFilters({ searchDebounce: 300 }));

    act(() => result.current.setSearch("typing"));
    act(() => result.current.setState({ search: "chosen" }));
    act(() => vi.advanceTimersByTime(300));

    expect(result.current.state.search).toBe("chosen");
    expect(result.current.searchInput).toBe("chosen");
  });
});

describe("types", () => {
  it("accepts explicitly undefined options (exactOptionalPropertyTypes)", () => {
    function useWrapped(prefix?: string, adapter?: QueryFiltersAdapter) {
      return useQueryFilters({ prefix, adapter, persist: undefined, schema: undefined });
    }
    const { result } = renderHook(() => useWrapped());
    expect(result.current.state.search).toBe("");
  });
});

describe("hydration", () => {
  it("hydrates server HTML without a mismatch, then follows the URL (no options)", async () => {
    // @ts-ignore -- @types/react-dom isn't a dev dependency
    const { renderToString } = await import("react-dom/server");
    // @ts-ignore -- @types/react-dom isn't a dev dependency
    const { hydrateRoot } = await import("react-dom/client");

    function App() {
      const { state } = useQueryFilters();
      return <span id="status">{String(state.filters.status ?? "none")}</span>;
    }

    setLocation("/products?status=open");
    const container = document.createElement("div");
    document.body.appendChild(container);
    container.innerHTML = renderToString(<App />);
    expect(container.textContent).toBe("none");

    const recoverable: unknown[] = [];
    let root: { unmount: () => void } | undefined;
    await act(async () => {
      root = hydrateRoot(container, <App />, {
        onRecoverableError: (error: unknown) => recoverable.push(error),
      });
    });

    expect(recoverable).toEqual([]);
    expect(container.textContent).toBe("open");
    act(() => root?.unmount());
    container.remove();
  });

  it("client-only apps still read the URL on the first render", () => {
    setLocation("/products?status=open");
    const firstRender: unknown[] = [];
    renderHook(() => {
      const { state } = useQueryFilters();
      firstRender.push(state.filters.status);
      return state;
    });
    expect(firstRender[0]).toBe("open");
  });
});

describe("second review round", () => {
  it("clearing while a first debounced search is pending also clears searchInput", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useQueryFilters({ searchDebounce: 300 }));

    act(() => result.current.setSearch("a")); // state.search is still ""
    act(() => result.current.setSearch("")); // "x" button
    expect(result.current.searchInput).toBe("");
  });
  it("another instance's filter write doesn't throw away text still being typed", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => ({
      searchBar: useQueryFilters({ searchDebounce: 300 }),
      sidebar: useQueryFilters(),
    }));

    act(() => result.current.searchBar.setSearch("lapt"));
    act(() => result.current.sidebar.setFilter("brand", "acme")); // user clicks a checkbox mid-typing
    expect(result.current.searchBar.searchInput).toBe("lapt");
    act(() => vi.advanceTimersByTime(300));
    expect(result.current.searchBar.state.search).toBe("lapt");
  });
  it("a write that never landed doesn't leak into a later instance's write", () => {
    let current = "";
    const router = { push: vi.fn(), replace: vi.fn() };
    const a = renderHook(() =>
      useQueryFilters({
        prefix: "a",
        adapter: createNextAdapter({ router, pathname: "/products", searchParams: new URLSearchParams(current) }),
      }),
    );
    act(() => a.result.current.setPage(2)); // push in flight, then the user navigates to /orders
    a.unmount();

    const b = renderHook(() =>
      useQueryFilters({
        prefix: "b",
        adapter: createNextAdapter({ router, pathname: "/orders", searchParams: new URLSearchParams("") }),
      }),
    );
    act(() => b.result.current.setPage(3));
    expect(router.push.mock.calls.at(-1)![0]).toBe("/orders?b.page=3");
  });
});
