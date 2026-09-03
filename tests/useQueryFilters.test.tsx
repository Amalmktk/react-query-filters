import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useQueryFilters } from "../src/react/useQueryFilters.js";

function setLocation(path: string) {
  window.history.pushState(null, "", path);
}

describe("useQueryFilters", () => {
  beforeEach(() => {
    setLocation("/products");
  });

  afterEach(() => {
    cleanup();
    setLocation("/products");
  });

  it("reads the initial state from the current URL", () => {
    setLocation("/products?search=laptop&status=active&page=2");
    const { result } = renderHook(() => useQueryFilters());

    expect(result.current.state.search).toBe("laptop");
    expect(result.current.state.filters.status).toBe("active");
    expect(result.current.state.pagination.page).toBe(2);
  });

  it("setSearch updates state and the URL, resetting the page", () => {
    setLocation("/products?page=3");
    const { result } = renderHook(() => useQueryFilters());

    act(() => result.current.setSearch("laptop"));

    expect(result.current.state.search).toBe("laptop");
    expect(result.current.state.pagination.page).toBe(1);
    expect(window.location.search).toBe("?search=laptop");
  });

  it("setFilter adds a filter and updates the URL", () => {
    const { result } = renderHook(() => useQueryFilters());

    act(() => result.current.setFilter("status", "active"));

    expect(result.current.state.filters.status).toBe("active");
    expect(window.location.search).toBe("?status=active");
  });

  it("removeFilter clears a single filter", () => {
    const { result } = renderHook(() => useQueryFilters());

    act(() => result.current.setFilter("status", "active"));
    act(() => result.current.setFilter("role", "admin"));
    act(() => result.current.removeFilter("status"));

    expect(result.current.state.filters).toEqual({ role: "admin" });
  });

  it("setSort toggles asc -> desc -> cleared for the same field", () => {
    const { result } = renderHook(() => useQueryFilters());

    act(() => result.current.setSort("price"));
    expect(result.current.state.sort).toEqual({ field: "price", direction: "asc" });

    act(() => result.current.setSort("price"));
    expect(result.current.state.sort).toEqual({ field: "price", direction: "desc" });

    act(() => result.current.setSort("price"));
    expect(result.current.state.sort).toBeNull();
  });

  it("setPage and setPageSize update pagination", () => {
    const { result } = renderHook(() => useQueryFilters());

    act(() => result.current.setPage(3));
    expect(result.current.state.pagination.page).toBe(3);

    act(() => result.current.setPageSize(50));
    expect(result.current.state.pagination).toEqual({ page: 1, pageSize: 50 });
  });

  it("reset restores search, filters, sort, and pagination to defaults", () => {
    const { result } = renderHook(() => useQueryFilters());

    act(() => result.current.setSearch("laptop"));
    act(() => result.current.setFilter("status", "active"));
    act(() => result.current.setSort("price"));
    act(() => result.current.setPage(3));
    act(() => result.current.reset());

    expect(result.current.state).toEqual({
      search: "",
      filters: {},
      sort: null,
      pagination: { page: 1, pageSize: 20 },
    });
    expect(window.location.search).toBe("");
  });

  it("syncs state when the browser back/forward buttons fire popstate", () => {
    const { result } = renderHook(() => useQueryFilters());

    act(() => result.current.setSearch("laptop"));
    expect(result.current.state.search).toBe("laptop");

    act(() => {
      setLocation("/products?search=phone");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(result.current.state.search).toBe("phone");
  });

  it("uses replaceState instead of pushState when replace is true", () => {
    const { result } = renderHook(() => useQueryFilters({ replace: true }));
    const lengthBefore = window.history.length;

    act(() => result.current.setSearch("laptop"));

    expect(window.history.length).toBe(lengthBefore);
    expect(window.location.search).toBe("?search=laptop");
  });
});
