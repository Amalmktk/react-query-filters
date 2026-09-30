import { describe, expect, it } from "vitest";
import { parseQueryState } from "../src/core/parser.js";
import { serializeQueryState } from "../src/core/serializer.js";
import { mergeOwnParams, pickOwnParams } from "../src/core/keys.js";
import { getActiveFilters, toQueryKey, toSearchString } from "../src/core/utils.js";
import type { QueryState } from "../src/core/types.js";

function baseState(overrides: Partial<QueryState> = {}): QueryState {
  return {
    search: "",
    filters: {},
    sort: null,
    pagination: { page: 1, pageSize: 20 },
    ...overrides,
  };
}

describe("schema-typed filters", () => {
  const schema = { price: "number", inStock: "boolean", tags: "array", note: "string" } as const;

  it("parses numbers and booleans into typed values", () => {
    const state = parseQueryState("price=9.5&inStock=true", { schema });
    expect(state.filters).toEqual({ price: 9.5, inStock: true });
  });

  it("accepts 1/0 for booleans", () => {
    expect(parseQueryState("inStock=0", { schema }).filters.inStock).toBe(false);
    expect(parseQueryState("inStock=1", { schema }).filters.inStock).toBe(true);
  });

  it("drops values that don't fit their type", () => {
    const state = parseQueryState("price=abc&inStock=maybe&tags=", { schema });
    expect(state.filters).toEqual({});
  });

  it("keeps a single-item array as an array", () => {
    expect(parseQueryState("tags=a", { schema }).filters.tags).toEqual(["a"]);
  });

  it("does not split commas in a string-typed filter", () => {
    expect(parseQueryState("note=eco,friendly", { schema }).filters.note).toBe("eco,friendly");
  });

  it("accepts repeated params for arrays", () => {
    expect(parseQueryState("tags=a&tags=b", { schema }).filters.tags).toEqual(["a", "b"]);
  });

  it("round-trips array items that contain commas and percent signs", () => {
    const original = baseState({ filters: { tags: ["eco,friendly", "100%", "plain"] } });
    const query = serializeQueryState(original, { schema });
    expect(parseQueryState(query, { schema }).filters.tags).toEqual([
      "eco,friendly",
      "100%",
      "plain",
    ]);
  });

  it("reads existing comma-joined links the same as before", () => {
    expect(parseQueryState("tags=a,b", { schema }).filters.tags).toEqual(["a", "b"]);
  });

  it("round-trips every type", () => {
    const original = baseState({
      filters: { price: 10, inStock: false, tags: ["a"], note: "x,y", other: "untyped" },
    });
    const reparsed = parseQueryState(serializeQueryState(original, { schema }), { schema });
    expect(reparsed).toEqual(original);
  });

  it("leaves filters outside the schema untyped", () => {
    expect(parseQueryState("status=a,b&count=5", { schema }).filters).toEqual({
      status: ["a", "b"],
      count: "5",
    });
  });
});

describe("prefix and paramNames", () => {
  it("reads only params under the prefix", () => {
    const state = parseQueryState(
      "orders.search=pen&orders.status=open&orders.page=2&users.page=5&utm=x",
      { prefix: "orders" },
    );
    expect(state.search).toBe("pen");
    expect(state.filters).toEqual({ status: "open" });
    expect(state.pagination.page).toBe(2);
  });

  it("writes every param under the prefix", () => {
    const query = serializeQueryState(
      baseState({
        search: "pen",
        filters: { status: "open" },
        sort: { field: "date", direction: "asc" },
        pagination: { page: 2, pageSize: 20 },
      }),
      { prefix: "orders" },
    );
    expect(query).toBe(
      "orders.search=pen&orders.status=open&orders.sort=date%3Aasc&orders.page=2",
    );
  });

  it("renames reserved params", () => {
    const state = parseQueryState("q=laptop&p=3", { paramNames: { search: "q", page: "p" } });
    expect(state.search).toBe("laptop");
    expect(state.pagination.page).toBe(3);
    expect(state.filters).toEqual({});
  });

  it("lets a filter use a reserved name once that param is renamed", () => {
    const state = parseQueryState("page=home&p=2", { paramNames: { page: "p" } });
    expect(state.filters).toEqual({ page: "home" });
    expect(state.pagination.page).toBe(2);

    const query = serializeQueryState(state, { paramNames: { page: "p" } });
    expect(query).toBe("page=home&p=2");
  });

  it("combines prefix and paramNames", () => {
    const query = serializeQueryState(baseState({ search: "pen" }), {
      prefix: "orders",
      paramNames: { search: "q" },
    });
    expect(query).toBe("orders.q=pen");
  });

  it("pickOwnParams and mergeOwnParams keep other namespaces intact", () => {
    const url = "users.page=5&orders.page=2&utm=x";
    expect(pickOwnParams(url, { prefix: "orders" })).toBe("orders.page=2");
    expect(mergeOwnParams(url, "orders.page=3", { prefix: "orders" })).toBe(
      "users.page=5&utm=x&orders.page=3",
    );
  });

  it("mergeOwnParams without a prefix replaces the whole query, as before", () => {
    expect(mergeOwnParams("a=1&b=2", "c=3")).toBe("c=3");
  });
});

describe("getActiveFilters", () => {
  it("skips values the serializer would omit", () => {
    expect(getActiveFilters({ a: null, b: "", c: [], d: "x", e: 0, f: false })).toEqual([
      { key: "d", value: "x" },
      { key: "e", value: 0 },
      { key: "f", value: false },
    ]);
  });
});

describe("toQueryKey", () => {
  it("is the same regardless of the order filters were set in", () => {
    const a = baseState({ filters: { status: "open", role: "admin" } });
    const b = baseState({ filters: { role: "admin", status: "open" } });
    expect(toQueryKey(a)).toEqual(toQueryKey(b));
  });

  it("changes when the query changes", () => {
    expect(toQueryKey(baseState({ search: "a" }))).not.toEqual(toQueryKey(baseState()));
  });
});

describe("toSearchString", () => {
  it("accepts strings, URLSearchParams, and Next.js-style records", () => {
    expect(toSearchString("?a=1")).toBe("a=1");
    expect(toSearchString(new URLSearchParams("a=1"))).toBe("a=1");
    expect(toSearchString({ a: "1", tags: ["x", "y"], none: undefined })).toBe(
      "a=1&tags=x&tags=y",
    );
  });
});
