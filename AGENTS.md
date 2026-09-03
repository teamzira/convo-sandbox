# AGENTS.md

Guidance for AI coding agents (Claude Code, v0, Cursor, etc.) and human contributors working on apps built from this template.

## What this template is

A Next.js starter for apps embedded inside the Teambridge interface (iframe). All apps built from this template should look and feel like Teambridge by following the **Alloy design system** — replicated locally via Tailwind tokens + shadcn/ui (no runtime dependency on the Alloy package).

## ⚠️ Example code — replace before shipping a real app

These files exist only as a working demonstration of how to read Teambridge data and render it with the design system. Treat them as scaffolding to learn from, not a foundation to build on:

- `app/page.tsx` — sample shifts dashboard (file required by Next.js — replace its contents, don't delete the file)
- `app/create-shift-modal.tsx` — sample modal (delete or replace)
- `app/actions.ts` — sample server action (delete or replace)

When the user starts building their actual app, **replace this content** before adding real features. Don't extend the demo — start fresh from these files.

The Teambridge integration in `lib/teambridge/`, the API route handlers in `app/api/teambridge/`, the layout in `app/layout.tsx`, the styling in `app/globals.css`, and the shadcn components in `components/ui/` are all part of the template and should be kept.

## Navigation & data fetching

Apps render inside the Teambridge proxy at `https://api.teambridge.com/apps/<slug>/…`. Next.js's `basePath` config (set in `next.config.ts` from the `APP_SLUG` env var) tells the framework about the prefix, so the routing primitives all handle it automatically — `<Link>`, `useRouter`, `redirect`, and `usePathname` from `next/link` and `next/navigation` work the way you'd expect, and you write app-local paths (`/dashboards/123`, not `/apps/<slug>/dashboards/123`).

```tsx
// ✓ on-template — write paths relative to your app, Next adds the prefix
import Link from 'next/link';
import { useRouter, redirect } from 'next/navigation';

const router = useRouter();
router.push('/dashboards/123');                // navigates to /apps/<slug>/dashboards/123
redirect('/dashboards/789');                   // server actions
<Link href="/reports/456">View report</Link>
```

**The one exception is `fetch`.** Native `fetch` doesn't honor `basePath`, so a bare `fetch('/api/dashboards')` hits `/api/dashboards` instead of `/apps/<slug>/api/dashboards` and 404s through the proxy. Use `tbFetch` from `@/lib/teambridge/fetch` for same-origin requests. ESLint will error on bare `fetch` calls.

```tsx
import { tbFetch } from '@/lib/teambridge/fetch';

await tbFetch('/api/dashboards');              // prepends /apps/<slug>
```

Import `tbFetch` (and `tbPath` / `TB_APP_BASE_PATH`) from their sub-paths rather than the top-level `@/lib/teambridge` barrel. The barrel also re-exports `TBProvider`, which imports `next/headers` and is server-only; pulling it into a Client Component's import graph trips Turbopack's server/client boundary check. Sub-path imports load only the helper itself.

In dev mode (`TB_DEV_MODE=true`), `basePath` is empty and `tbFetch` is a no-op — paths pass through unchanged. The prefix is derived at build time from `APP_SLUG` and inlined into the client bundle via `NEXT_PUBLIC_TB_APP_BASE_PATH` (also accessible via `import { TB_APP_BASE_PATH } from '@/lib/teambridge/url'`) for the rare cases where you need to construct a same-origin URL manually.

A few cases to be careful with manually:

- Raw `<a href="/foo">` and `<form action="/foo">` — `basePath` only applies to Next.js's own primitives. For native HTML, prepend the prefix yourself with `tbPath()` (imported from `@/lib/teambridge/url`) if the URL needs to be same-origin.
- Self-fetching your own route handlers from a server component. Don't; call the underlying logic directly instead (per [Vercel's guidance](https://vercel.com/blog/common-mistakes-with-the-next-js-app-router-and-how-to-fix-them)).
- `lib/teambridge/client/TBClient.ts` deliberately uses raw `fetch` — it talks to external Teambridge APIs at absolute URLs, not to your app's own routes.

## Design system rules

### Use shadcn primitives, not hand-rolled HTML

Buttons, inputs, dialogs, tables, alerts, etc. live in `components/ui/`. They're already styled to match Alloy. Reaching for raw `<button>` or `<input>` with custom Tailwind drifts off-system and forces inconsistency across apps.

```tsx
// ✓ on-system
import { Button } from '@/components/ui/button';
<Button>Save</Button>

// ✗ drift
<button className="bg-blue-600 px-4 py-2 rounded text-white">Save</button>
```

To add primitives the template doesn't already include:

```bash
npx shadcn@latest add <name>
```

Already installed: `alert`, `avatar`, `badge`, `button`, `card`, `checkbox`, `dialog`, `dropdown-menu`, `input`, `label`, `popover`, `radio-group`, `scroll-area`, `select`, `separator`, `skeleton`, `sonner`, `switch`, `table`, `tabs`, `textarea`, `tooltip`.

### Colors

Two namespaces, both already wired into Tailwind:

**Semantic aliases (preferred for surfaces and text)** — adapt to light/dark automatically:

| Class | Use for |
|---|---|
| `bg-background` / `text-foreground` | Page surface and primary text |
| `bg-card` / `text-card-foreground` | Card surface |
| `bg-popover` / `text-popover-foreground` | Floating menus, tooltips |
| `bg-primary` / `text-primary-foreground` | Primary action (Alloy blue) |
| `bg-secondary` / `text-secondary-foreground` | Secondary surface |
| `bg-muted` / `text-muted-foreground` | Recessed surface, supporting text |
| `bg-accent` / `text-accent-foreground` | Hover / selected state |
| `bg-destructive` / `text-destructive-foreground` | Destructive action (Alloy red) |
| `border-border`, `border-input`, `ring-ring` | Borders, input edges, focus ring |

**Alloy palette (for color accents — badges, charts, status tags)**:

`blue`, `azure`, `purple`, `pink`, `red`, `orange`, `yellow`, `matcha`, `green`, `slate`, `grey`/`gray`. Each has stops `50, 100, 150, 200, 300, 400, 500, 600, 700, 800, 850, 900, 950`. Examples: `bg-azure-500`, `text-matcha-700`, `border-purple-200`.

`gray` is aliased to Alloy `grey`. `gray-*` and `grey-*` resolve to the same value.

Do not introduce new hex values in component code. If you find a need for a color outside this palette, raise it — the design system needs to grow rather than be bypassed.

Direct CSS variable access for places where utilities aren't a fit: `var(--color-content-secondary)`, `var(--color-bg-tertiary)`, `var(--color-border-opaque)`, etc. (defined in `app/globals.css`).

### Spacing

4 px scale. Tailwind's defaults already match Alloy: `p-1` = 4 px, `p-2` = 8 px, `p-4` = 16 px. Stay on this scale; don't introduce arbitrary values like `px-[7px]`.

### Border radius

| Class | Value | Use |
|---|---|---|
| `rounded-button` | 6 px | Buttons, inputs, selects, textareas (Alloy convention) |
| `rounded-sm` | 4 px | Inset elements (menu items, etc.) |
| `rounded-md` | 8 px | General surfaces |
| `rounded-lg` | 12 px | Cards, dialogs, alerts |
| `rounded-xl` | 16 px | Large cards |
| `rounded-2xl` | 24 px | Hero surfaces |
| `rounded-full` | pill | Avatars, badges, switches, status dots |

### Shadows

Use `shadow-sm` / `shadow-md` / `shadow-lg` (mapped to Alloy `below-low` / `below-md` / `below-high`). For shadows projecting upward (toasts, bottom sheets), use `shadow-above-low` / `shadow-above-md` / `shadow-above-high`.

### Charts

Use the `Chart*` primitives from `components/ui/chart.tsx` (Recharts under the hood). Reference series colors via `var(--chart-1)` through `var(--chart-5)` in your `ChartConfig` — these map to Alloy's default chart palette (blue, green, yellow, red, purple). Don't reach for raw hex values or pick arbitrary palette stops.

### Typography

Geist (sans) and Geist Mono are the only sanctioned faces — already loaded via `next/font` in `app/layout.tsx`. Use `font-mono` for IDs / code, default sans everywhere else. Don't introduce other fonts.

Type scale: Tailwind defaults (`text-xs` 12 px → `text-7xl` 96 px) match Alloy.

### Icons

Use `lucide-react`. Import the **`Icon`-suffixed** names to match the convention shadcn uses internally:

```tsx
import { CalendarDaysIcon, UserIcon, AlertTriangleIcon } from 'lucide-react';

<UserIcon className="size-4 text-muted-foreground" />
```

Default size in shadcn buttons / alerts / badges is `size-4` (16 px). Use `size-3.5` inside small chips, `size-5` for prominent action icons.

Don't hand-roll inline `<svg>` icons — lucide covers the same coverage as Alloy's icon set.

### Dark mode

`.dark` class on `<html>` flips all semantic aliases automatically. Don't write `dark:` variants for surface colors — they're handled. Only add `dark:` overrides when a specific element needs different behavior than the semantic token implies (rare).

### Iframe context

Apps render inside an iframe within Teambridge. Keep this in mind:

- No top-level nav, app shell, or breadcrumbs — Teambridge owns those.
- Default to full width. Constrain to a max-width (e.g., `max-w-6xl`) only inside main content containers, not at the page root.
- Don't set `min-h-screen` on the body. The iframe sizes itself.
- Background on the page should be `bg-background` (Alloy white), not a colored hero. The host already provides chrome.

## Data access

All app data — shifts, users, jobs, placements, anything — lives in **collections** (custom data tables). Every read and write goes through the Unified Collections API: `client.collections.list()`, `client.collections.getFields(id)`, `client.collections.records.{list,get,create,update}`. The full canonical workflow with examples lives in README → "Using the API Client". The notes below cover gotchas that have tripped up agents in practice.

### API constraints

- **Page size limit**: the Teambridge API enforces a max of **50 records per page** (default 20). The template client forwards `pageSize` as the API's `size` query param; it does not clamp the value for you. Never request more than 50 in a single call. To fetch all records, loop with `pageSize: 50`, incrementing `page` (0-indexed), until either `data.length < 50` or you've consumed `totalCount`.

### User-scoped Teambridge clients

For user-scoped reads and writes in Server Components, Server Actions, and app API routes, pass the signed Teambridge user context into the OpenAPI client:

```ts
import { getTBClient, getTBContext } from '@/lib/teambridge';

export async function GET() {
  const { userContext } = await getTBContext();
  const client = getTBClient(userContext);
  // ...
}
```

Do **not** use a module-level singleton or plain `getTBClient()` for user-scoped collection operations. Embedded production requests include a signed `X-User-Context` header. `getTBContext()` reads that header on the server, and `getTBClient(userContext)` forwards it to OpenAPI so Teambridge evaluates collection access as the current embedded user. If you drop that context, the app can work locally but show empty or incorrectly scoped data in production.

Use `getTBContext()` only in Server Components, Server Actions, and app API routes; it depends on `next/headers`. In Client Components, read current account/user metadata through `TBProvider` and `useTBContext()`. Client Components should call your app's API routes with `tbFetch()` rather than instantiating `TBClient` directly.

### Large collection performance

Do not assume the first page is the full dataset. For data-heavy views, fetch and filter records in API routes, then return a paged response to the browser:

```ts
type PagedResponse<T> = {
  data: T[];
  page: number;
  size: number;
  totalCount: number;
  hasMore: boolean;
};
```

Recommended pattern:

- Scope records to the current Teambridge user before returning anything.
- Fetch records in batches of 50.
- Use page-based pagination with `page` and `pageSize`; this template's Teambridge client exposes those pagination inputs.
- Deduplicate records by `id` when querying multiple owner/user aliases.
- Enforce a max page cap and log when the cap is hit.
- Return only the requested browser page, even if the backend scanned more records to compute exact counts or search matches.

Search must also be backend-backed. Do not implement global or page-level search by filtering only the records currently loaded in the browser; that silently misses matches beyond the first 50 records. The client should send `search`, `page`, and `pageSize`; the API route should search the full current-user-scoped dataset and return `totalCount` / `hasMore`. If the app owns a database, use indexed database queries for search. If the app only uses Teambridge Collections, search in the API route after batched owner-scoped loading, with caching where appropriate.

Board views need special care: do not derive columns or counts from only the first loaded page. Return group metadata from the server, such as `{ key, label, count }`, or load cards per group/column with a per-column "Load more". Field options are fine for select-like columns such as status, role, or candidate status; dynamic groups such as state, client, facility, or owner need server-computed group counts.

Cache batched datasets carefully. Include owner/user scope, search, filters, archived flags, group-by fields, page size, and page in cache keys. Never cache unscoped collection results for user-specific views.

### Collection name matching

Match by **exact, case-insensitive equality** — never `includes()` or other partial matching. Accounts often have additional collections whose names contain the substring you want (e.g. `"Shifts Group"`, `"Archived Users"`); a partial match grabs whichever appears first.

```ts
// ✓ Exact, case-insensitive
const shifts = collections.find((c) => c.name.toLowerCase() === 'shifts');

// ✗ Partial — silently picks "Shifts Group" or similar
const shifts = collections.find((c) => c.name.toLowerCase().includes('shift'));
```

### Record field mapping

Records come back **keyed by field UUID, not by semantic property name**. There is no `record.locationId` or `record.startTime` — only `record["<uuid>"]`. The workflow:

1. Fetch field definitions: `const fields = await client.collections.getFields(collectionId)`.
2. Look up each field by name (exact, case-insensitive): `const locationField = fields.find((f) => f.name.toLowerCase() === 'location')`.
3. Read the value via the field's `id`: `const locationId = locationField ? record[locationField.id] : null`.

```ts
// ✓ Look up the field, then index by its id
const fields = await client.collections.getFields(shiftsCollection.id);
const locationField = fields.find((f) => f.name.toLowerCase() === 'location');
const locationId = locationField ? record[locationField.id] : null;

// ✗ Records have no semantic keys — this is always undefined
const locationId = record.locationId;
```

**Reference fields** (e.g. `Location` on a Shift, `Assignee` linking to Users) store the **record ID** of the related record, not its display name. To render names, fetch the related collection's records, build a `recordId → name` map keyed by that collection's name fields (e.g. `First Name` + `Last Name` on Users), and look up by ID at render time. The `app/page.tsx` demo does this for the Assignee column — copy that pattern.

## Project structure

```
app/
  layout.tsx          # Root layout, TBProvider wired in
  page.tsx            # ⚠ Example — replace
  globals.css         # Alloy tokens + Tailwind theme bridge — keep
  api/teambridge/
    install/route.ts  # Lifecycle webhook
    uninstall/route.ts
components/ui/        # shadcn primitives (own them, edit freely)
lib/
  teambridge/         # Teambridge integration — keep
  utils.ts            # cn() helper
middleware.ts         # Request validation
```

## Common mistakes to avoid

- Adding hex colors or `text-[#...]` arbitrary values. Use the tokens.
- Using `<button>` / `<input>` directly instead of shadcn's `Button` / `Input`.
- Importing fonts other than Geist.
- Editing `app/globals.css` to inject app-specific colors. Extend the Alloy palette there only with semantic justification.
- Treating `app/page.tsx` as the starting point of a real app instead of replacing it.
- Adding `dark:` variants for surface colors that the semantic tokens already handle.
- Setting `min-h-screen` on root containers (breaks iframe sizing).

## When in doubt

If a component or pattern doesn't have a shadcn equivalent already in this template, prefer composing it from existing primitives over reaching for new dependencies. When stuck on visual choices, lean on the semantic tokens (`bg-muted`, `text-muted-foreground`, etc.) — they're calibrated to match Alloy without you needing to remember the exact values.
