import { describe, expect, it } from "vitest";
import { serializeQueryState } from "../src/core/serializer.js";
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

describe("serializeQueryState", () => {
  it("returns an empty string for the default state", () => {
    expect(serializeQueryState(baseState())).toBe("");
  });

  it("serializes search", () => {
    expect(serializeQueryState(baseState({ search: "laptop" }))).toBe("search=laptop");
  });

  it("serializes string filters", () => {
    const query = serializeQueryState(
      baseState({ filters: { status: "active", category: "electronics" } }),
    );
    expect(query).toBe("status=active&category=electronics");
  });

  it("joins array filters with commas", () => {
    const query = serializeQueryState(baseState({ filters: { tags: ["a", "b", "c"] } }));
    expect(query).toBe("tags=a%2Cb%2Cc");
  });

  it("omits null, empty string, and empty array filters", () => {
    const query = serializeQueryState(
      baseState({ filters: { a: null, b: "", c: [], d: "kept" } }),
    );
    expect(query).toBe("d=kept");
  });

  it("serializes sort as field:direction", () => {
    const query = serializeQueryState(
      baseState({ sort: { field: "price", direction: "desc" } }),
    );
    expect(query).toBe("sort=price%3Adesc");
  });

  it("omits page/pageSize when they match the defaults", () => {
    const query = serializeQueryState(baseState({ pagination: { page: 1, pageSize: 20 } }));
    expect(query).toBe("");
  });

  it("includes page/pageSize when they differ from the defaults", () => {
    const query = serializeQueryState(baseState({ pagination: { page: 2, pageSize: 50 } }));
    expect(query).toBe("page=2&pageSize=50");
  });

  it("respects custom defaultPage/defaultPageSize options", () => {
    const query = serializeQueryState(baseState({ pagination: { page: 5, pageSize: 10 } }), {
      defaultPage: 5,
      defaultPageSize: 10,
    });
    expect(query).toBe("");
  });

  it("percent-encodes special characters and unicode", () => {
    const query = serializeQueryState(baseState({ search: "hello world é", filters: { status: "a&b" } }));
    expect(query).toBe("search=hello+world+%C3%A9&status=a%26b");
  });

  it("combines search, filters, sort, and pagination", () => {
    const query = serializeQueryState(
      baseState({
        search: "laptop",
        filters: { status: "active" },
        sort: { field: "price", direction: "desc" },
        pagination: { page: 2, pageSize: 20 },
      }),
    );
    expect(query).toBe("search=laptop&status=active&sort=price%3Adesc&page=2");
  });
});
