# Changelog

## 1.2.0

Backward compatible, and every new feature is opt-in.

### Added

- **Router adapters:** `createNextAdapter` (Next.js App Router) and `createReactRouterAdapter` (React Router v6/v7), via the new `adapter` option. Custom adapters implement `QueryFiltersAdapter`.
- **`initialSearchParams`** option, so server-rendered HTML shows the URL's state.
- **`schema`** option for typed filters (`"number"`, `"boolean"`, `"array"`, `"string"`) with TypeScript inference on `state.filters`.
- **Namespaces and param names:** `prefix` for several instances on one page, and `paramNames` to rename `search`/`sort`/`page`/`pageSize`.
- **Debounced search:** `searchDebounce` option, with `searchInput` for binding inputs.
- **New setters:** `setFilters`, `toggleFilterValue`, `clearFilters` and `setState`.
- **Active filters:** `activeFilterCount` and `isFiltered`, plus the `<QueryChips>` component.
- **Data fetching:** `queryKey` and `toQueryString()` for TanStack Query, SWR and API calls.
- **`persist`** option to save and restore state in `localStorage`.
- **New core helpers:** `getActiveFilters`, `toQueryKey` and `toSearchString`.
- **`react-query-filters/core` entry point:** React-free, so it's safe in Server Components.
- **CommonJS type declarations**, so TypeScript projects that `require` the package under `moduleResolution: node16` type-check.

### Fixed

- Separate `useQueryFilters()` instances on one page now stay in sync with each other.
- React StrictMode no longer adds two history entries per change in development.
- The default adapter no longer causes a hydration mismatch in server-rendered apps.
- The main entry is marked `"use client"`, so it can be imported from Next.js Server Component files without a wrapper.

## 1.1.0

- Date and range filters: `setRangeFilter`, `getRangeFilter`, `removeRangeFilter` and `<QueryRange>`.
