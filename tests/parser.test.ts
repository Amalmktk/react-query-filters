import { describe, expect, it } from "vitest";
import { parseQueryState } from "../src/core/parser.js";

describe("parseQueryState", () => {
  it("returns defaults for an empty query", () => {
    expect(parseQueryState("")).toEqual({
      search: "",
      filters: {},
      sort: null,
      pagination: { page: 1, pageSize: 20 },
    });
  });

  it("parses search", () => {
    expect(parseQueryState("search=laptop").search).toBe("laptop");
  });

  it("parses unknown params as string filters", () => {
    const state = parseQueryState("status=active&category=electronics");
    expect(state.filters).toEqual({ status: "active", category: "electronics" });
  });

  it("splits comma-separated values into array filters", () => {
    const state = parseQueryState("tags=a,b,c");
    expect(state.filters.tags).toEqual(["a", "b", "c"]);
  });

  it("parses sort as field:direction", () => {
    expect(parseQueryState("sort=price:desc").sort).toEqual({
      field: "price",
      direction: "desc",
    });
  });

  it("defaults sort direction to desc when omitted or invalid", () => {
    expect(parseQueryState("sort=price").sort).toEqual({ field: "price", direction: "desc" });
  });

  it("parses page and pageSize", () => {
    expect(parseQueryState("page=3&pageSize=50").pagination).toEqual({
      page: 3,
      pageSize: 50,
    });
  });

  it("falls back to defaults for invalid page/pageSize", () => {
    expect(parseQueryState("page=abc&pageSize=-5").pagination).toEqual({
      page: 1,
      pageSize: 20,
    });
  });

  it("respects custom defaultPage/defaultPageSize options", () => {
    expect(parseQueryState("", { defaultPage: 1, defaultPageSize: 10 }).pagination).toEqual({
      page: 1,
      pageSize: 10,
    });
  });

  it("accepts a URLSearchParams instance directly", () => {
    const params = new URLSearchParams("search=phone&status=active");
    const state = parseQueryState(params);
    expect(state.search).toBe("phone");
    expect(state.filters.status).toBe("active");
  });

  it("round-trips with serializeQueryState", async () => {
    const { serializeQueryState } = await import("../src/core/serializer.js");
    const original = parseQueryState(
      "search=laptop&status=active&tags=a,b&sort=price:desc&page=2&pageSize=50",
    );
    const query = serializeQueryState(original);
    const reparsed = parseQueryState(query);
    expect(reparsed).toEqual(original);
  });
});
