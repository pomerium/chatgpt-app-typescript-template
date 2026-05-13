---
name: vercel-react-best-practices
description: "React and Next.js performance optimization guidelines from Vercel Engineering. Parallelizes async waterfalls with Promise.all(), eliminates barrel file imports, applies next/dynamic code splitting, and audits re-render patterns. Use when fixing slow page loads, reducing bundle size, optimizing React re-renders, eliminating fetch waterfalls, or reviewing Next.js data fetching performance."
license: MIT
metadata:
  author: vercel
  version: "1.0.0"
---

# Vercel React Best Practices

45 performance rules across 8 categories from Vercel Engineering, prioritized by impact. Covers async waterfalls, bundle size, server-side caching, client fetching, re-renders, rendering, JS micro-optimizations, and advanced patterns.

## Audit Workflow

1. **Check for waterfalls** — search for sequential `await` calls that could use `Promise.all()` (rules: `async-*`)
2. **Audit imports** — find barrel file imports from icon/component libraries and replace with direct imports (rules: `bundle-*`)
3. **Review server components** — verify `React.cache()` usage for repeated queries, minimize data serialized to client (rules: `server-*`)
4. **Profile re-renders** — identify components subscribing to unnecessary state or missing memoization (rules: `rerender-*`)
5. **Verify** — run `npm run build` and check bundle analyzer output for regressions. If bundle size increased, revisit steps 2-3 and re-audit imports

## Critical Patterns (Inline Examples)

### Parallelize independent async operations

```typescript
// Bad: sequential — 3 round trips
const user = await fetchUser()
const posts = await fetchPosts()
const comments = await fetchComments()

// Good: parallel — 1 round trip (2-10× faster)
const [user, posts, comments] = await Promise.all([
  fetchUser(), fetchPosts(), fetchComments()
])
```

See `rules/async-parallel.md` for full details.

### Eliminate barrel file imports

```tsx
// Bad: loads 1,583 modules (~2.8s in dev, 200-800ms cold start)
import { Check, X, Menu } from 'lucide-react'

// Good: loads only 3 modules (~2KB vs ~1MB)
import Check from 'lucide-react/dist/esm/icons/check'
import X from 'lucide-react/dist/esm/icons/x'
import Menu from 'lucide-react/dist/esm/icons/menu'
```

See `rules/bundle-barrel-imports.md` for Next.js `optimizePackageImports` alternative.

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | Eliminating Waterfalls | CRITICAL | `async-` |
| 2 | Bundle Size Optimization | CRITICAL | `bundle-` |
| 3 | Server-Side Performance | HIGH | `server-` |
| 4 | Client-Side Data Fetching | MEDIUM-HIGH | `client-` |
| 5 | Re-render Optimization | MEDIUM | `rerender-` |
| 6 | Rendering Performance | MEDIUM | `rendering-` |
| 7 | JavaScript Performance | LOW-MEDIUM | `js-` |
| 8 | Advanced Patterns | LOW | `advanced-` |

## Quick Reference

### 1. Eliminating Waterfalls (CRITICAL)

- `async-defer-await` - Move await into branches where actually used
- `async-parallel` - Use Promise.all() for independent operations
- `async-dependencies` - Use better-all for partial dependencies
- `async-api-routes` - Start promises early, await late in API routes
- `async-suspense-boundaries` - Use Suspense to stream content

### 2. Bundle Size Optimization (CRITICAL)

- `bundle-barrel-imports` - Import directly, avoid barrel files
- `bundle-dynamic-imports` - Use next/dynamic for heavy components
- `bundle-defer-third-party` - Load analytics/logging after hydration
- `bundle-conditional` - Load modules only when feature is activated
- `bundle-preload` - Preload on hover/focus for perceived speed

### 3. Server-Side Performance (HIGH)

- `server-cache-react` - Use React.cache() for per-request deduplication
- `server-cache-lru` - Use LRU cache for cross-request caching
- `server-serialization` - Minimize data passed to client components
- `server-parallel-fetching` - Restructure components to parallelize fetches
- `server-after-nonblocking` - Use after() for non-blocking operations

### 4. Client-Side Data Fetching (MEDIUM-HIGH)

- `client-swr-dedup` - Use SWR for automatic request deduplication
- `client-event-listeners` - Deduplicate global event listeners

### 5. Re-render Optimization (MEDIUM)

- `rerender-defer-reads` - Don't subscribe to state only used in callbacks
- `rerender-memo` - Extract expensive work into memoized components
- `rerender-dependencies` - Use primitive dependencies in effects
- `rerender-derived-state` - Subscribe to derived booleans, not raw values
- `rerender-functional-setstate` - Use functional setState for stable callbacks
- `rerender-lazy-state-init` - Pass function to useState for expensive values
- `rerender-transitions` - Use startTransition for non-urgent updates

### 6. Rendering Performance (MEDIUM)

- `rendering-animate-svg-wrapper` - Animate div wrapper, not SVG element
- `rendering-content-visibility` - Use content-visibility for long lists
- `rendering-hoist-jsx` - Extract static JSX outside components
- `rendering-svg-precision` - Reduce SVG coordinate precision
- `rendering-hydration-no-flicker` - Use inline script for client-only data
- `rendering-activity` - Use Activity component for show/hide
- `rendering-conditional-render` - Use ternary, not && for conditionals

### 7. JavaScript Performance (LOW-MEDIUM)

- `js-batch-dom-css` - Group CSS changes via classes or cssText
- `js-index-maps` - Build Map for repeated lookups
- `js-cache-property-access` - Cache object properties in loops
- `js-cache-function-results` - Cache function results in module-level Map
- `js-cache-storage` - Cache localStorage/sessionStorage reads
- `js-combine-iterations` - Combine multiple filter/map into one loop
- `js-length-check-first` - Check array length before expensive comparison
- `js-early-exit` - Return early from functions
- `js-hoist-regexp` - Hoist RegExp creation outside loops
- `js-min-max-loop` - Use loop for min/max instead of sort
- `js-set-map-lookups` - Use Set/Map for O(1) lookups
- `js-tosorted-immutable` - Use toSorted() for immutability

### 8. Advanced Patterns (LOW)

- `advanced-event-handler-refs` - Store event handlers in refs
- `advanced-use-latest` - useLatest for stable callback refs

## Detailed Rules

Each rule file in `rules/` contains: explanation, incorrect example, correct example, and references. For the complete compiled guide: `AGENTS.md`
