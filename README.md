# react-query-filters

[![CI](https://github.com/Amalmktk/react-query-filters/actions/workflows/ci.yml/badge.svg)](https://github.com/Amalmktk/react-query-filters/actions/workflows/ci.yml)

Headless URL state management for React. Keep search, filters, sorting, and pagination synchronized with the URL — without imposing any UI or styling.

```
/products
```

becomes

```
/products?search=laptop&status=active&sort=price:desc&page=2
```

so filtered views are shareable, bookmarkable, and survive a page refresh.

## Features

- 🔎 Search state synchronized with the URL
- 🎛️ Arbitrary filters — any query param you name becomes a filter
- ↕️ Sorting with `asc → desc → cleared` cycling
- 📄 Pagination
- 🔗 Shareable, bookmarkable URLs
- 🔄 Browser back/forward support
- ⚛️ React 18 & 19
- 🎨 Completely headless — bring your own UI
- 🧩 `QueryFiltersProvider` for sharing one state across components
- 🛠️ Framework-agnostic core utilities (`parseQueryState`, `serializeQueryState`)
- 📦 TypeScript-first, zero runtime dependencies

## Why headless

`react-query-filters` does not ship `<Select>`, `<Pagination>`, or any other rendered component. It manages state and URL synchronization; you keep your own UI:

```tsx
const { state, setFilter } = useQueryFilters();

<Select
  value={state.filters.status}
  onValueChange={(value) => setFilter("status", value)}
/>
```

## Install

```bash
npm install react-query-filters
# or
yarn add react-query-filters
# or
pnpm add react-query-filters
```

React 18 or 19 is a peer dependency.

## Usage

```tsx
"use client";

import { useQueryFilters } from "react-query-filters";

function ProductList() {
  const { state, setSearch, setFilter, setSort, setPage, reset } = useQueryFilters();

  return (
    <div>
      <input
        value={state.search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search products..."
      />

      <select
        value={(state.filters.status as string) ?? ""}
        onChange={(e) => setFilter("status", e.target.value)}
      >
        <option value="">All</option>
        <option value="active">Active</option>
        <option value="pending">Pending</option>
      </select>

      <button onClick={() => setSort("price")}>Sort by price</button>
      <button onClick={() => setPage(state.pagination.page + 1)}>Next page</button>
      <button onClick={reset}>Reset filters</button>
    </div>
  );
}
```

## Sharing state across components

Calling `useQueryFilters()` in multiple components each creates an independent state instance. To share one URL-synced state across a search box, filter selects, pagination, and sort headers, wrap them in `QueryFiltersProvider` and use the headless render-prop components (or `useQueryFiltersContext()` directly):

```tsx
"use client";

import {
  QueryFiltersProvider,
  QuerySearch,
  QuerySelect,
  QueryPagination,
  QuerySort,
  QueryReset,
} from "react-query-filters";

function ProductList() {
  return (
    <QueryFiltersProvider>
      <QuerySearch>
        {({ value, setValue }) => (
          <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Search..." />
        )}
      </QuerySearch>

      <QuerySelect name="status">
        {({ value, setValue }) => (
          <select value={(value as string) ?? ""} onChange={(e) => setValue(e.target.value)}>
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
          </select>
        )}
      </QuerySelect>

      <QuerySort field="price">
        {({ direction, toggle }) => (
          <button onClick={toggle}>Price {direction === "asc" ? "↑" : direction === "desc" ? "↓" : ""}</button>
        )}
      </QuerySort>

      <QueryPagination>
        {({ page, setPage }) => <button onClick={() => setPage(page + 1)}>Next page</button>}
      </QueryPagination>

      <QueryReset>{({ reset }) => <button onClick={reset}>Reset</button>}</QueryReset>
    </QueryFiltersProvider>
  );
}
```

Each component takes a `children` render function and passes back only the slice of state (and setters) relevant to it — there's no rendered markup to override, so your own components stay in full control of markup and styling.

`QueryFiltersProvider` accepts the same options as `useQueryFilters` (`defaultPage`, `defaultPageSize`, `replace`).

## Date & range filters

A single date (or any single value) needs no special support — it's just a plain filter, same as `status` or `category`, via `<QuerySelect>` or `setFilter`:

```tsx
<QuerySelect name="eventDate">
  {({ value, setValue }) => (
    <input type="date" value={(value as string) ?? ""} onChange={(e) => setValue(e.target.value)} />
  )}
</QuerySelect>
```

produces `?eventDate=2024-01-15`.

A **range** — two bounds, like a date range or a price range — is different: it's two ordinary filters under the hood, `${name}From` and `${name}To`. `setRangeFilter`/`getRangeFilter`/`removeRangeFilter` (and the `<QueryRange>` component) update both atomically in a single URL change, and either side can be left unset for an open-ended range (e.g. "$10 and up"):

```tsx
"use client";

import { QueryFiltersProvider, QueryRange } from "react-query-filters";

function ProductList() {
  return (
    <QueryFiltersProvider>
      {/* Date range */}
      <QueryRange name="createdAt">
        {({ from, to, setFrom, setTo }) => (
          <>
            <input type="date" value={from ?? ""} onChange={(e) => setFrom(e.target.value)} />
            <input type="date" value={to ?? ""} onChange={(e) => setTo(e.target.value)} />
          </>
        )}
      </QueryRange>

      {/* Numeric range */}
      <QueryRange name="price">
        {({ from, to, setFrom, setTo, clear }) => (
          <>
            <input type="number" value={from ?? ""} onChange={(e) => setFrom(e.target.value)} placeholder="Min price" />
            <input type="number" value={to ?? ""} onChange={(e) => setTo(e.target.value)} placeholder="Max price" />
            <button onClick={clear}>Clear price range</button>
          </>
        )}
      </QueryRange>
    </QueryFiltersProvider>
  );
}
```

produces URLs like `?createdAtFrom=2024-01-01&createdAtTo=2024-01-31&priceFrom=10&priceTo=100`.

The library doesn't parse or validate dates/numbers itself — it stays a plain string in the URL either way, same as every other filter — so it has no date-parsing dependency and no opinion on `from <= to` ordering; validate that in your own UI if you need to.

With the raw `useQueryFilters()` hook (no Provider), the equivalent is:

```ts
const { setRangeFilter, getRangeFilter, removeRangeFilter } = useQueryFilters();

setRangeFilter("price", { from: "10", to: "100" }); // ?priceFrom=10&priceTo=100
setRangeFilter("price", { from: "20" });             // updates only `from`, `to` untouched
getRangeFilter("price");                             // { from: "20", to: "100" }
removeRangeFilter("price");                          // clears both
```

## API

### `useQueryFilters(options?)`

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `defaultPage` | `number` | `1` | Page used when no `page` param is in the URL, and restored to whenever search/filters change. |
| `defaultPageSize` | `number` | `20` | Page size used when no `pageSize` param is in the URL. |
| `replace` | `boolean` | `false` | Use `history.replaceState` instead of `pushState`, so filter changes don't pollute browser back/forward. |

Returns:

| Field | Description |
| --- | --- |
| `state.search` | Current search string. |
| `state.filters` | `Record<string, FilterValue>` of active filters. |
| `state.sort` | `{ field, direction } \| null`. |
| `state.pagination` | `{ page, pageSize }`. |
| `setSearch(value)` | Updates search and resets to the default page. |
| `setFilter(key, value)` | Sets a filter and resets to the default page. |
| `removeFilter(key)` | Removes a single filter. |
| `setRangeFilter(key, range)` | Sets one or both sides of a range filter (`${key}From`/`${key}To`). Omitting a side leaves it unchanged; `null` clears it. Resets to the default page. |
| `getRangeFilter(key)` | Reads a range filter back as `{ from, to }`. |
| `removeRangeFilter(key)` | Clears both sides of a range filter in one update. |
| `setSort(field, direction?)` | Sets sort. Omitting `direction` toggles `asc -> desc -> cleared` for that field. |
| `clearSort()` | Clears the current sort. |
| `setPage(page)` | Sets the current page. |
| `setPageSize(pageSize)` | Sets page size and resets to the default page. |
| `reset()` | Clears search, filters, and sort, and resets pagination to defaults. |

### `QueryFiltersProvider` / `useQueryFiltersContext()`

`useQueryFiltersContext()` returns the same shape as `useQueryFilters()`, sourced from the nearest `QueryFiltersProvider`. It throws if called outside one.

### Headless components

| Component | Render prop args |
| --- | --- |
| `<QuerySearch>` | `{ value, setValue }` |
| `<QuerySelect name="...">` | `{ value, setValue }` for that filter key |
| `<QueryPagination>` | `{ page, pageSize, setPage, setPageSize }` |
| `<QueryRange name="...">` | `{ from, to, setFrom, setTo, setRange, clear }` for that range |
| `<QuerySort field="...">` | `{ direction, toggle }` — `toggle` cycles `asc -> desc -> cleared` |
| `<QueryReset>` | `{ reset }` |

All of them must be rendered inside a `QueryFiltersProvider`.

### Core (framework-agnostic)

`parseQueryState`, `serializeQueryState`, `createDefaultQueryState`, `isEqualQueryState`, `getRangeFilter`, and `getRangeFilterKeys` operate on plain `URLSearchParams`/strings/filter records with no React dependency, and are exported for advanced use (e.g. server-side parsing of `searchParams` in a Next.js Server Component).

## Filter value encoding

- Reserved keys (`search`, `sort`, `page`, `pageSize`) are parsed as such; every other query param becomes a filter.
- A filter value containing a comma (`tags=a,b,c`) is parsed as a string array. A filter whose own value legitimately contains a comma (e.g. `"eco,friendly"`) is indistinguishable from a two-item array under this convention — a known limitation of the comma-separated encoding, not a bug.
- `null`, `""`, and empty arrays are omitted from the URL when serialized.
- Invalid `page`/`pageSize` values (non-numeric, zero, negative) fall back to their defaults; a decimal like `page=3.5` is truncated to `3`.
- An unrecognized or missing sort `direction` (e.g. `sort=price` or `sort=price:up`) defaults to `desc`.
- A range filter named `key` is two plain filters, `${key}From` and `${key}To` — no new URL syntax, so it parses/serializes with the same rules as everything else above.

## Environment & framework support

- **React**: 18 or 19 (peer dependency).
- **Browser**: anything with `URLSearchParams` and the History API (`pushState`/`replaceState`, `popstate`) — all evergreen browsers.
- **Client-only**: `useQueryFilters`, `QueryFiltersProvider`, and the headless components all read `window.location`/`window.history`, so they only run in the browser. The package does not embed a `"use client"` directive in its build output — add it yourself in the file where you call the hook, as shown in every example above.
- **SSR**: on a server-rendered first pass (no `window`), `useQueryFilters` initializes to the default empty state, then reads the real URL once mounted on the client. If you need the *server-rendered* HTML itself to reflect the URL's filters (e.g. for SEO or to avoid a flash of default state), read the query params yourself from the framework (e.g. Next.js's `searchParams` page prop) and use the framework-agnostic `parseQueryState` for that — it has no dependency on the DOM.

### Next.js App Router

```tsx
"use client";

import { useQueryFilters } from "react-query-filters";
```

The framework-agnostic core (`parseQueryState`, `serializeQueryState`) has no browser dependency and can be used inside Server Components — for example, parsing a page's `searchParams` prop server-side.

## Roadmap

- [ ] Debounced search
- [ ] `localStorage` persistence
- [ ] Storybook documentation

## License

MIT
