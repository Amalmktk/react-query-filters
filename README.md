# react-query-filters

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

### Core (framework-agnostic)

`parseQueryState`, `serializeQueryState`, `createDefaultQueryState`, and `isEqualQueryState` operate on plain `URLSearchParams`/strings with no React dependency, and are exported for advanced use (e.g. server-side parsing of `searchParams` in a Next.js Server Component).

## Filter value encoding

- Reserved keys (`search`, `sort`, `page`, `pageSize`) are parsed as such; every other query param becomes a filter.
- A filter value containing a comma (`tags=a,b,c`) is parsed as a string array.
- `null`, `""`, and empty arrays are omitted from the URL when serialized.

## Roadmap

- [ ] Date/range filters
- [ ] Debounced search
- [ ] `localStorage` persistence
- [ ] Optional headless UI primitives (`QuerySearch`, `QuerySelect`, `QueryPagination`, `QuerySort`, `QueryReset`)
- [ ] `QueryFiltersProvider` for sharing one query state across multiple components
- [ ] Storybook documentation

## License

MIT
