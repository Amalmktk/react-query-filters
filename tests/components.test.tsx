import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { QueryFiltersProvider } from "../src/react/context.js";
import { QuerySearch } from "../src/components/QuerySearch.js";
import { QuerySelect } from "../src/components/QuerySelect.js";
import { QueryPagination } from "../src/components/QueryPagination.js";
import { QuerySort } from "../src/components/QuerySort.js";
import { QueryReset } from "../src/components/QueryReset.js";

function setLocation(path: string) {
  window.history.pushState(null, "", path);
}

describe("QueryFiltersProvider + headless components", () => {
  beforeEach(() => setLocation("/products"));
  afterEach(() => {
    cleanup();
    setLocation("/products");
  });

  it("shares one query state across independent consumers", () => {
    render(
      <QueryFiltersProvider>
        <QuerySearch>
          {({ value, setValue }) => (
            <input
              aria-label="search"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          )}
        </QuerySearch>
        <QuerySelect name="status">
          {({ value }) => <span data-testid="status">{String(value ?? "none")}</span>}
        </QuerySelect>
      </QueryFiltersProvider>,
    );

    const input = screen.getByLabelText("search") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "laptop" } });

    expect(window.location.search).toBe("?search=laptop");
    expect(screen.getByTestId("status").textContent).toBe("none");
  });

  it("QuerySelect sets and clears a filter", () => {
    let setStatus!: (value: string | null) => void;

    render(
      <QueryFiltersProvider>
        <QuerySelect name="status">
          {({ value, setValue }) => {
            setStatus = setValue;
            return <span data-testid="status">{String(value ?? "none")}</span>;
          }}
        </QuerySelect>
      </QueryFiltersProvider>,
    );

    act(() => setStatus("active"));
    expect(screen.getByTestId("status").textContent).toBe("active");
    expect(window.location.search).toBe("?status=active");

    act(() => setStatus(null));
    expect(screen.getByTestId("status").textContent).toBe("none");
    expect(window.location.search).toBe("");
  });

  it("QueryPagination exposes and updates page state", () => {
    let goToPage!: (page: number) => void;

    render(
      <QueryFiltersProvider>
        <QueryPagination>
          {({ page, setPage }) => {
            goToPage = setPage;
            return <span data-testid="page">{page}</span>;
          }}
        </QueryPagination>
      </QueryFiltersProvider>,
    );

    expect(screen.getByTestId("page").textContent).toBe("1");
    act(() => goToPage(3));
    expect(screen.getByTestId("page").textContent).toBe("3");
    expect(window.location.search).toBe("?page=3");
  });

  it("QuerySort toggles direction for its field", () => {
    let toggleSort!: () => void;

    render(
      <QueryFiltersProvider>
        <QuerySort field="price">
          {({ direction, toggle }) => {
            toggleSort = toggle;
            return <span data-testid="sort">{direction ?? "none"}</span>;
          }}
        </QuerySort>
      </QueryFiltersProvider>,
    );

    expect(screen.getByTestId("sort").textContent).toBe("none");
    act(() => toggleSort());
    expect(screen.getByTestId("sort").textContent).toBe("asc");
    act(() => toggleSort());
    expect(screen.getByTestId("sort").textContent).toBe("desc");
    act(() => toggleSort());
    expect(screen.getByTestId("sort").textContent).toBe("none");
  });

  it("QueryReset clears search, filters, sort, and pagination", () => {
    setLocation("/products?search=laptop&status=active&sort=price:asc&page=3");
    let doReset!: () => void;

    render(
      <QueryFiltersProvider>
        <QueryReset>
          {({ reset }) => {
            doReset = reset;
            return null;
          }}
        </QueryReset>
      </QueryFiltersProvider>,
    );

    act(() => doReset());
    expect(window.location.search).toBe("");
  });

  it("throws when a component is used outside QueryFiltersProvider", () => {
    const consoleError = console.error;
    console.error = () => {};

    expect(() =>
      render(<QuerySearch>{() => null}</QuerySearch>),
    ).toThrow(/QueryFiltersProvider/);

    console.error = consoleError;
  });
});
