# react-query-filters

[![CI](https://github.com/Amalmktk/react-query-filters/actions/workflows/ci.yml/badge.svg)](https://github.com/Amalmktk/react-query-filters/actions/workflows/ci.yml)

Headless React hook for search, filters, sorting, and pagination that stay synchronized with the URL.

```
/products
```

becomes

```
/products?search=laptop&status=active&sort=price:desc&page=2
```

so filtered views are shareable, bookmarkable, and survive a page refresh — with zero UI opinions imposed on you.

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
| `<QuerySort field="...">` | `{ direction, toggle }` — `toggle` cycles `asc -> desc -> cleared` |
| `<QueryReset>` | `{ reset }` |

All of them must be rendered inside a `QueryFiltersProvider`.

### Core (framework-agnostic)

`parseQueryState`, `serializeQueryState`, `createDefaultQueryState`, and `isEqualQueryState` operate on plain `URLSearchParams`/strings with no React dependency, and are exported for advanced use (e.g. server-side parsing of `searchParams` in a Next.js Server Component).

## Filter value encoding

- Reserved keys (`search`, `sort`, `page`, `pageSize`) are parsed as such; every other query param becomes a filter.
- A filter value containing a comma (`tags=a,b,c`) is parsed as a string array.
- `null`, `""`, and empty arrays are omitted from the URL when serialized.

## Roadmap

- [x] Optional headless UI primitives (`QuerySearch`, `QuerySelect`, `QueryPagination`, `QuerySort`, `QueryReset`)
- [x] `QueryFiltersProvider` for sharing one query state across multiple components
- [ ] Date/range filters
- [ ] Debounced search
- [ ] `localStorage` persistence
- [ ] Storybook documentation

## License

MIT
