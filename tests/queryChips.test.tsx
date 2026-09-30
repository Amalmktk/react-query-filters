import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryFiltersProvider } from "../src/react/context.js";
import { QueryChips, type QueryChipsRenderProps } from "../src/components/QueryChips.js";
import { QuerySearch } from "../src/components/QuerySearch.js";

function setLocation(path: string) {
  window.history.pushState(null, "", path);
}

describe("QueryChips", () => {
  beforeEach(() => setLocation("/products"));
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    setLocation("/products");
  });

  function renderChips(includeSearch = false) {
    let props!: QueryChipsRenderProps;
    render(
      <QueryFiltersProvider>
        <QueryChips includeSearch={includeSearch}>
          {(chipProps) => {
            props = chipProps;
            return (
              <ul>
                {chipProps.chips.map((chip) => (
                  <li key={chip.id}>{`${chip.key}:${String(chip.value)}`}</li>
                ))}
              </ul>
            );
          }}
        </QueryChips>
      </QueryFiltersProvider>,
    );
    return () => props;
  }

  it("shows one chip per filter and per array item", () => {
    setLocation("/products?status=open&tags=a,b&search=pen");
    renderChips();

    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "status:open",
      "tags:a",
      "tags:b",
    ]);
  });

  it("removing an array chip removes only that item", () => {
    setLocation("/products?tags=a,b");
    const props = renderChips();

    act(() => props().chips[0]!.remove());
    expect(window.location.search).toBe("?tags=b");

    act(() => props().chips[0]!.remove());
    expect(window.location.search).toBe("");
  });

  it("includes the search term when asked", () => {
    setLocation("/products?search=pen&status=open");
    const props = renderChips(true);

    expect(props().chips.map((chip) => chip.key)).toEqual(["search", "status"]);

    act(() => props().chips[0]!.remove());
    expect(window.location.search).toBe("?status=open");
  });

  it("clearAll clears filters but keeps sort", () => {
    setLocation("/products?status=open&tags=a&sort=price:asc&page=2");
    const props = renderChips();

    act(() => props().clearAll());
    expect(window.location.search).toBe("?sort=price%3Aasc");
  });
});

describe("QuerySearch with searchDebounce", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    setLocation("/products");
  });

  it("shows typed text immediately and updates the URL after the delay", () => {
    vi.useFakeTimers();
    setLocation("/products");
    let setValue!: (value: string) => void;

    render(
      <QueryFiltersProvider searchDebounce={200}>
        <QuerySearch>
          {(props) => {
            setValue = props.setValue;
            return <span data-testid="value">{props.value}</span>;
          }}
        </QuerySearch>
      </QueryFiltersProvider>,
    );

    act(() => setValue("lap"));
    expect(screen.getByTestId("value").textContent).toBe("lap");
    expect(window.location.search).toBe("");

    act(() => vi.advanceTimersByTime(200));
    expect(window.location.search).toBe("?search=lap");
  });
});

describe("QueryChips removal", () => {
  afterEach(() => {
    cleanup();
    setLocation("/products");
  });

  it("removing two chips of one array filter in one handler removes both", () => {
    setLocation("/products?tags=a,b,c");
    let props!: QueryChipsRenderProps;
    render(
      <QueryFiltersProvider>
        <QueryChips>
          {(chipProps) => {
            props = chipProps;
            return null;
          }}
        </QueryChips>
      </QueryFiltersProvider>,
    );

    act(() => {
      props.chips[0]!.remove();
      props.chips[1]!.remove();
    });
    expect(window.location.search).toBe("?tags=c");
  });
});
