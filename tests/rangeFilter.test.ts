import { describe, expect, it } from "vitest";
import { getRangeFilter, getRangeFilterKeys } from "../src/core/utils.js";
import { parseQueryState } from "../src/core/parser.js";
import { serializeQueryState } from "../src/core/serializer.js";

describe("getRangeFilterKeys", () => {
  it("derives the From/To key pair for a range name", () => {
    expect(getRangeFilterKeys("price")).toEqual({ fromKey: "priceFrom", toKey: "priceTo" });
  });
});

describe("getRangeFilter", () => {
  it("reads both sides when both keys are present", () => {
    const state = parseQueryState("priceFrom=10&priceTo=100");
    expect(getRangeFilter(state.filters, "price")).toEqual({ from: "10", to: "100" });
  });

  it("treats a missing side as null (open-ended range)", () => {
    const onlyFrom = parseQueryState("priceFrom=10");
    expect(getRangeFilter(onlyFrom.filters, "price")).toEqual({ from: "10", to: null });

    const onlyTo = parseQueryState("priceTo=100");
    expect(getRangeFilter(onlyTo.filters, "price")).toEqual({ from: null, to: "100" });
  });

  it("returns nulls when neither side is set", () => {
    expect(getRangeFilter({}, "price")).toEqual({ from: null, to: null });
  });

  it("is unaffected by unrelated filters, including ones with overlapping prefixes", () => {
    const state = parseQueryState("priceFrom=10&priceTo=100&priceFromDate=ignored");
    expect(getRangeFilter(state.filters, "price")).toEqual({ from: "10", to: "100" });
  });

  it("round-trips through serialize/parse", () => {
    const original = parseQueryState("priceFrom=10&priceTo=100&status=active");
    const query = serializeQueryState(original);
    const reparsed = parseQueryState(query);
    expect(getRangeFilter(reparsed.filters, "price")).toEqual({ from: "10", to: "100" });
  });
});
