<div align="center">

# react-query-filters

**Search, filters, sorting, and pagination that live in the URL.**
A headless React hook: you bring the UI, it keeps the state in sync with the address bar.

[![npm version](https://img.shields.io/npm/v/react-query-filters?color=cb3837&logo=npm)](https://www.npmjs.com/package/react-query-filters)
[![npm downloads](https://img.shields.io/npm/dm/react-query-filters?color=blue)](https://www.npmjs.com/package/react-query-filters)
[![bundle size](https://img.shields.io/bundlephobia/minzip/react-query-filters?label=min%2Bgzip)](https://bundlephobia.com/package/react-query-filters)
[![CI](https://github.com/Amalmktk/react-query-filters/actions/workflows/ci.yml/badge.svg)](https://github.com/Amalmktk/react-query-filters/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-ready-3178c6?logo=typescript&logoColor=white)](#typed-filters)
[![license](https://img.shields.io/npm/l/react-query-filters)](./LICENSE)

</div>

```
/products  →  /products?search=laptop&status=active&sort=price:desc&page=2
```

Filtered views become **shareable**, **bookmarkable**, and **survive a refresh**. The back button just works.

```tsx
const { state, setSearch, setFilter, setSort, setPage } = useQueryFilters();
```

## Why react-query-filters

- 🎨 **Headless.** No components to restyle. Use your own inputs, or shadcn/ui, MUI, Radix, anything.
- 🧭 **Works with your router.** Next.js App Router, React Router, or the plain History API with zero setup.
- 🔢 **Typed filters.** Numbers come back as numbers and booleans as booleans, with full TypeScript inference.
- ⚡ **Built for real UIs.** Debounced search, multi-select, date and price ranges, filter chips, several tables on one page.
- 🖥️ **SSR-friendly.** No hydration mismatches, and a server-safe core for Server Components.
- 🪶 **Tiny.** About 4.4 kB min+gzip, zero dependencies. React 18 and 19.

## Contents

- [Install](#install)
- [Quick start](#quick-start)
- [Guides](#guides): [shared state](#share-state-across-components) · [Next.js](#nextjs-app-router) · [React Router](#react-router) · [typed filters](#typed-filters) · [multi-select](#multi-select) · [ranges](#date--range-filters) · [debounced search](#debounced-search) · [chips](#active-filters-and-chips) · [data fetching](#data-fetching) · [several tables](#several-tables-on-one-page) · [remembering filters](#remembering-filters) · [batch updates](#batch-updates)
- [API reference](#api-reference)
- [URL format](#url-format)
- [Compatibility](#compatibility)
- [Upgrading from 1.1](#upgrading-from-11)

## Install

```bash
npm install react-query-filters
```

<sub>Also works with `yarn add` and `pnpm add`. React 18 or 19 is a peer dependency.</sub>

## Quick start

```tsx
"use client";

import { useQueryFilters } from "react-query-filters";

export function ProductList() {
  const { state, setSearch, setFilter, setSort, setPage, reset } = useQueryFilters();

  return (
    <>
      <input
        value={state.search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search products…"
      />

      <select
        value={(state.filters.status as string) ?? ""}
        onChange={(e) => setFilter("status", e.target.value)}
      >
        <option value="">All</option>
        <option value="active">Active</option>
        <option value="archived">Archived</option>
      </select>

      <button onClick={() => setSort("price")}>Sort by price</button>
      <button onClick={() => setPage(state.pagination.page + 1)}>Next page</button>
      <button onClick={reset}>Reset</button>
    </>
  );
}
```

That's it. Every change updates the URL. Changing the search or a filter sends you back to page 1, and `setSort("price")` cycles `asc → desc → off`.

Use `state` to fetch your data. `state.search`, `state.filters`, `state.sort`, and `state.pagination` are always in sync with the URL. See [Data fetching](#data-fetching) for a TanStack Query / SWR recipe.

## Guides

### Share state across components

Your search box, sidebar filters, table headers, and pagination usually live in different components. Wrap them in `QueryFiltersProvider` and read the shared state with `useQueryFiltersContext()` or the headless render-prop components:

```tsx
import {
  QueryFiltersProvider, QuerySearch, QuerySelect, QuerySort, QueryPagination, QueryReset,
} from "react-query-filters";

<QueryFiltersProvider>
  <QuerySearch>
    {({ value, setValue }) => <input value={value} onChange={(e) => setValue(e.target.value)} />}
  </QuerySearch>

  <QuerySelect name="status">
    {({ value, setValue }) => (
      <select value={(value as string) ?? ""} onChange={(e) => setValue(e.target.value)}>
        <option value="">All</option>
        <option value="active">Active</option>
      </select>
    )}
  </QuerySelect>

  <QuerySort field="price">
    {({ direction, toggle }) => (
      <button onClick={toggle}>Price {direction === "asc" ? "↑" : direction === "desc" ? "↓" : ""}</button>
    )}
  </QuerySort>

  <QueryPagination>
    {({ page, setPage }) => <button onClick={() => setPage(page + 1)}>Next</button>}
  </QueryPagination>

  <QueryReset>{({ reset }) => <button onClick={reset}>Reset</button>}</QueryReset>
</QueryFiltersProvider>
```

The components render nothing themselves. They hand you the relevant slice of state and its setters, so markup and styling stay yours. `QueryFiltersProvider` accepts every [`useQueryFilters` option](#options).

> Separate `useQueryFilters()` calls also stay in sync through the URL. The provider is still the better choice, because it gives you one shared instance instead of several copies.

### Next.js App Router

Pass the Next.js router in through `createNextAdapter`. Navigation then goes through Next, so `useSearchParams()` everywhere in your app stays current:

```tsx
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createNextAdapter, useQueryFilters } from "react-query-filters";

export function ProductList() {
  const { state, setFilter } = useQueryFilters({
    adapter: createNextAdapter({
      router: useRouter(),
      pathname: usePathname(),
      searchParams: useSearchParams(),
    }),
  });
  // …
}
```

- **Scroll:** filter changes don't scroll to the top. Pass `scroll: true` to `createNextAdapter` if you want them to.
- **Suspense:** as with any component that calls `useSearchParams()`, wrap it in `<Suspense>` on statically rendered pages.
- **No dependency on Next:** the adapter takes Next's hook results as arguments, so this package doesn't depend on `next`.

**Server Components.** The parsing utilities are available from a React-free entry point that's safe to import on the server:

```tsx
// app/products/page.tsx (Server Component)
import { parseQueryState } from "react-query-filters/core";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { search, filters, sort, pagination } = parseQueryState(new URLSearchParams(await searchParams));
  const products = await db.products.find({ search, filters, sort, ...pagination });
  return <ProductList products={products} />;
}
```

**Without the adapter.** If you use the default adapter in Next.js, pass the page's `searchParams` as `initialSearchParams`. The server-rendered HTML then already shows the filtered view:

```tsx
<ProductList initialSearchParams={await searchParams} />
// …inside ProductList (a client component):
useQueryFilters({ initialSearchParams });
```

Without it, the server renders the default state and the URL's filters appear right after hydration. There's no mismatch error either way.

### React Router

Works with React Router v6 and v7:

```tsx
import { useSearchParams } from "react-router";
import { createReactRouterAdapter, useQueryFilters } from "react-query-filters";

export function ProductList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { state } = useQueryFilters({
    adapter: createReactRouterAdapter({ searchParams, setSearchParams }),
  });
  // …
}
```

Using a different router? Write a [custom adapter](#custom-adapters). It's three small functions.

### Typed filters

URLs only hold text. Declare a `schema` and filters come back typed, with TypeScript inference:

```tsx
const { state, setFilter } = useQueryFilters({
  schema: { price: "number", inStock: "boolean", tags: "array", note: "string" },
});

state.filters.price;   // number | undefined
state.filters.inStock; // boolean | undefined
state.filters.tags;    // string[] | undefined
```

| Type | URL → value | Notes |
| --- | --- | --- |
| `"number"` | `price=9.5` → `9.5` | Values that aren't numbers are ignored. |
| `"boolean"` | `true`/`1` → `true`, `false`/`0` → `false` | Anything else is ignored. |
| `"array"` | `tags=a,b` or `tags=a&tags=b` → `["a", "b"]` | A single item stays an array. Items containing commas round-trip safely. |
| `"string"` | `note=a,b` → `"a,b"` | Never split on commas. |

Filters you don't list keep the default behavior. Existing links keep working after you add a schema.

### Multi-select

For checkbox groups, `toggleFilterValue` adds a value to an array filter or removes it:

```tsx
const { state, toggleFilterValue } = useQueryFilters({ schema: { brand: "array" } });

{["acme", "globex", "initech"].map((brand) => (
  <label key={brand}>
    <input
      type="checkbox"
      checked={state.filters.brand?.includes(brand) ?? false}
      onChange={() => toggleFilterValue("brand", brand)}
    />
    {brand}
  </label>
))}
// → ?brand=acme,initech
```

### Date & range filters

A range is two filters under the hood, `${name}From` and `${name}To`. Both sides update in a single URL change, and either side can be left open ("$10 and up"):

```tsx
<QueryRange name="price">
  {({ from, to, setFrom, setTo, clear }) => (
    <>
      <input type="number" value={from ?? ""} onChange={(e) => setFrom(e.target.value)} placeholder="Min" />
      <input type="number" value={to ?? ""} onChange={(e) => setTo(e.target.value)} placeholder="Max" />
      <button onClick={clear}>Clear</button>
    </>
  )}
</QueryRange>
// → ?priceFrom=10&priceTo=100
```

The same works with `<input type="date">` (`?createdAtFrom=2024-01-01&createdAtTo=2024-01-31`). With the hook alone:

```ts
setRangeFilter("price", { from: "10", to: "100" });
setRangeFilter("price", { from: "20" }); // updates only `from`
getRangeFilter("price");                 // { from: "20", to: "100" }
removeRangeFilter("price");              // clears both
```

Values stay strings in the URL. The library doesn't parse dates or check that `from <= to`, so validate in your UI if you need to.

### Debounced search

Without debouncing, every keystroke adds a history entry and triggers a fetch. Set `searchDebounce`, and bind the input to `searchInput`:

```tsx
const { searchInput, setSearch, state } = useQueryFilters({ searchDebounce: 300 });

<input value={searchInput} onChange={(e) => setSearch(e.target.value)} />
// searchInput updates on every keystroke; state.search and the URL update 300 ms after typing stops.
```

Clearing the search applies immediately. `<QuerySearch>` handles all of this for you when the provider has `searchDebounce` set.

### Active filters and chips

`activeFilterCount` and `isFiltered` cover badges and "Clear all" buttons. `<QueryChips>` gives you one removable chip per active filter (and per item of an array filter):

```tsx
<QueryChips includeSearch>
  {({ chips, clearAll }) => (
    <div>
      {chips.map((chip) => (
        <button key={chip.id} onClick={chip.remove}>
          {chip.key}: {String(chip.value)} ✕
        </button>
      ))}
      {chips.length > 0 && <button onClick={clearAll}>Clear all</button>}
    </div>
  )}
</QueryChips>
```

### Data fetching

`queryKey` is a stable cache key that only changes when the query does. `toQueryString()` serializes the state for your API:

```tsx
const { queryKey, toQueryString } = useQueryFilters();

// TanStack Query
const { data } = useQuery({
  queryKey,
  queryFn: () => fetch(`/api/products?${toQueryString()}`).then((r) => r.json()),
});

// SWR
const { data } = useSWR(queryKey, () => fetch(`/api/products?${toQueryString()}`).then((r) => r.json()));
```

### Several tables on one page

Two tables on one page would share `page` and `sort`. Give each its own `prefix`:

```tsx
const orders = useQueryFilters({ prefix: "orders" }); // ?orders.page=2&orders.status=open
const users = useQueryFilters({ prefix: "users" });   // &users.page=5
```

Each instance only touches its own params and leaves the rest of the URL alone. That includes other tables, `utm_*` tags, and anything else. Give every instance on the page a prefix: an instance without one treats the whole query string as its own.

To rename the reserved params, use `paramNames`. This also frees up the name for a filter:

```tsx
useQueryFilters({ paramNames: { search: "q", page: "p" } });
// ?q=laptop&p=2, and a filter can now be called "page"
```

### Remembering filters

Pass `persist` with a `localStorage` key to bring filters back when someone returns to the page:

```tsx
useQueryFilters({ persist: "products-table" });
```

- **The URL wins.** Shared links always show exactly what was shared. Saved filters are only restored when the URL has none.
- **Cleared means cleared.** Resetting the filters saves the empty state, so old filters don't come back.
- **Best-effort.** If storage is blocked (private mode, disabled), everything else keeps working.

### Batch updates

Each setter is one URL change and one history entry. To change several things at once:

```ts
setFilters({ status: "open", brand: ["acme"], color: null }); // null, "" or [] removes a filter
setState({ search: "pen", sort: { field: "price", direction: "asc" } });
clearFilters();                        // all filters; keeps search, sort and page size
clearFilters({ includeSearch: true }); // …and the search
```

## API reference

### `useQueryFilters(options?)`

#### Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `defaultPage` | `number` | `1` | Page used when the URL has none. Search and filter changes return to it. |
| `defaultPageSize` | `number` | `20` | Page size used when the URL has none. |
| `replace` | `boolean` | `false` | Replace the current history entry instead of adding one. |
| `adapter` | `QueryFiltersAdapter` | browser History API | Where the URL is read and written. See [Next.js](#nextjs-app-router), [React Router](#react-router), [custom adapters](#custom-adapters). |
| `initialSearchParams` | `string \| URLSearchParams \| Record<string, string \| string[] \| undefined>` | | The state for the first render, e.g. a Next.js page's `searchParams`. |
| `schema` | `Record<string, "string" \| "number" \| "boolean" \| "array">` | | Parse these filters as typed values. See [typed filters](#typed-filters). |
| `prefix` | `string` | | Namespace every param as `${prefix}.${key}`. |
| `paramNames` | `{ search?, sort?, page?, pageSize? }` | | Rename the reserved params. |
| `searchDebounce` | `number` (ms) | `0` | Delay applying `setSearch` to `state.search` and the URL. |
| `persist` | `string` | | `localStorage` key to save and restore the state. |

#### Returns

| Field | Description |
| --- | --- |
| `state` | `{ search, filters, sort, pagination }`, always in sync with the URL. |
| `searchInput` | The search text as typed. Bind inputs to this when using `searchDebounce`. |
| `setSearch(value)` | Set the search and return to the default page. |
| `setFilter(key, value)` | Set a filter and return to the default page. |
| `setFilters(filters)` | Set several filters in one URL change. `null`, `""`, or `[]` removes one. |
| `toggleFilterValue(key, value)` | Add a value to an array filter, or remove it if present. |
| `removeFilter(key)` | Remove a filter. |
| `setRangeFilter(key, { from?, to? })` | Set one or both sides of a range. `null` clears a side. |
| `getRangeFilter(key)` | Read a range as `{ from, to }`. |
| `removeRangeFilter(key)` | Clear both sides of a range. |
| `setSort(field, direction?)` | Set the sort. Without `direction`, cycles `asc → desc → off`. |
| `clearSort()` | Clear the sort. |
| `setPage(page)` | Go to a page. |
| `setPageSize(size)` | Change the page size and return to the default page. |
| `reset()` | Clear everything back to the defaults. |
| `clearFilters({ includeSearch? })` | Clear the filters, keeping sort and page size. |
| `setState(partial \| updater)` | Change any part of the state in one URL change. Doesn't reset the page. |
| `activeFilterCount` | How many filters have a value. |
| `isFiltered` | `true` if there's a search or an active filter. |
| `queryKey` | Stable cache key for TanStack Query / SWR. |
| `toQueryString()` | The state as a query string for API calls (without the `prefix`). |

### Components

All components must be inside a `QueryFiltersProvider` and render only what their `children` function returns.

| Component | `children` receives |
| --- | --- |
| `<QuerySearch>` | `{ value, setValue }` |
| `<QuerySelect name>` | `{ value, setValue }` for that filter. `null` or `""` removes it. |
| `<QueryRange name>` | `{ from, to, setFrom, setTo, setRange, clear }` |
| `<QuerySort field>` | `{ direction, toggle }` |
| `<QueryPagination>` | `{ page, pageSize, setPage, setPageSize }` |
| `<QueryChips includeSearch?>` | `{ chips, clearAll }`, where each chip is `{ id, key, value, remove }` |
| `<QueryReset>` | `{ reset }` |

`useQueryFiltersContext()` returns the same object as `useQueryFilters()`, from the nearest provider.

### Core utilities

Framework-agnostic and React-free. Import them from `react-query-filters/core` (safe in Server Components and plain Node) or from the main entry.

| Function | Description |
| --- | --- |
| `parseQueryState(search, options?)` | URL query → state. Accepts `schema`, `prefix`, `paramNames`, `defaultPage`, `defaultPageSize`. |
| `serializeQueryState(state, options?)` | State → URL query string. Same options. |
| `createDefaultQueryState(options?)` | An empty state. |
| `isEqualQueryState(a, b)` | Deep equality for two states. |
| `getActiveFilters(filters)` | The filters that have a value, as `{ key, value }[]`. |
| `getRangeFilter(filters, key)` / `getRangeFilterKeys(key)` | Read a range filter / get its two param names. |
| `toQueryKey(state, options?)` | A stable cache key for a state. |
| `toSearchString(input)` | Normalize a string, `URLSearchParams`, or Next.js-style `searchParams` object to a query string. |

### Custom adapters

An adapter tells the hook how to read and write the URL:

```ts
import type { QueryFiltersAdapter } from "react-query-filters";

const adapter: QueryFiltersAdapter = {
  getSearch: () => myRouter.location.search,                    // current query string (or null if unknown yet)
  update: (search, { replace }) => myRouter.navigate({ search, replace }),
  subscribe: (onChange) => myRouter.listen(onChange),           // optional; see below
};
```

- **With `subscribe`:** the hook re-reads the URL whenever `onChange` fires.
- **Without it:** the hook expects your component to re-render with the new URL, as router hooks do. Pass a stable `subscribe` function.

## URL format

| State | URL |
| --- | --- |
| Search | `search=laptop` |
| Filter | `status=active`, any param that isn't reserved |
| Array filter | `tags=a,b,c` |
| Range | `priceFrom=10&priceTo=100` |
| Sort | `sort=price:desc` |
| Pagination | `page=2&pageSize=50` (omitted when equal to the defaults) |

- **Reserved names:** `search`, `sort`, `page`, and `pageSize` are reserved. Rename them with `paramNames`.
- **Empty values:** `null`, `""`, and `[]` are left out of the URL.
- **Commas:** without a schema, a value containing a comma is read as an array. Declare the filter as `"string"` or `"array"` to avoid that.
- **Invalid values:** a non-numeric, zero or negative `page`/`pageSize` falls back to the default, and `page=3.9` becomes `3`.
- **Sort direction:** `sort=price` (no direction) or an unknown direction means `desc`.

## Compatibility

- **React:** 18 and 19.
- **Frameworks:** Next.js App Router (via the adapter, or the default adapter as a client component), React Router v6/v7, Vite, Create React App, Remix, and any React app with the History API.
- **Server rendering:** safe. The main entry is marked `"use client"`, and `react-query-filters/core` runs anywhere.
- **Modules:** ESM and CommonJS, with types for both.
- **Browsers:** every evergreen browser.

<details>
<summary><strong>Known limits of router adapters</strong></summary>

Routers apply navigations asynchronously and don't tell the hook which navigation a render belongs to. So in two rare cases, both within the moment before the router shows a change, the hook can't tell a new navigation apart from "the router hasn't caught up yet":

- A link to exactly the URL from before your click isn't picked up until the next navigation.
- If a router renders each of several very quick changes separately, an intermediate one can flash briefly. Next.js normally batches them.

The default browser adapter isn't affected.

</details>

## Upgrading from 1.1

Nothing to change: 1.2 is backward compatible, and every new feature is opt-in. Along the way it fixes:

- **Separate instances stay in sync.** Separate `useQueryFilters()` calls on one page now pick up each other's changes. Before, they went stale until a reload.
- **One history entry per change in StrictMode** (development). Before, there were two.
- **No hydration mismatch** when the default adapter is used in a server-rendered app.
- **Core functions work in Server Components.** Import them from `react-query-filters/core`. The main entry never worked there, because it contains React code.

See the [changelog](./CHANGELOG.md) for the full list.

## Roadmap

- [x] Debounced search
- [x] `localStorage` persistence
- [x] Router adapters (Next.js App Router, React Router)
- [x] Typed filters
- [ ] Storybook documentation
- [ ] Multi-column sort
- [ ] Cursor pagination

Ideas and bug reports are welcome in [GitHub issues](https://github.com/Amalmktk/react-query-filters/issues).

## License

[MIT](./LICENSE) © Amal M
