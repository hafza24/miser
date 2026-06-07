# Full App Structure & Navigation Audit

This is a very large scope (essentially an IA + navigation + design-system rebuild on top of dozens of existing pages). Shipping it as one change would break the live app, blow past the context window, and burn many credits with high regression risk. I'll plan it as **phases you can approve one at a time**. Each phase is independently shippable and verifiable.

Before phase 1, I need a few decisions from you.

## Decisions needed

1. **Scope of "Media" hub** — Today, media lives inside chats only (view-once images via `chat-media` bucket + `mark_media_viewed`). A standalone Media page (Shared / Saved / Temporary) means storing message_id references per user and a new "saved media" table. Do you want this new feature built, or should "Media" just be a filter inside each chat?
2. **Requests split** — You list Friend / Group / Three-person / Match as separate request types. Today only `chat_requests`, `chat_invites`, and `group_requests` exist. Are "friend requests", "three-person requests", and "match requests" new features to design, or aliases for existing flows?
3. **Feed / Recommendations on Dashboard** — There is no social feed today. Should Dashboard stay as today's activity hub (pending requests, recent chats, quotas), or do you want a real content feed designed and built?
4. **Admin "Logs" module** — User/admin/security/error logs don't exist as tables yet. Build full audit-log infra (new tables + triggers + UI), or stub the module and wire it later?

Your answers determine whether this is **3 phases (~reorg only)** or **6+ phases (~reorg + new features)**.

## Phased plan

### Phase 1 — IA map + route cleanup (no UI feature changes)
- Inventory every file in `src/pages/**` and `src/pages/admin/**`, every route in `App.tsx`, every nav entry in `AppLayout.tsx` / `AdminLayout.tsx`.
- Produce a single `docs/ia-map.md` with: current page → purpose → target section → action (keep / move / merge / delete).
- Delete dead routes, fix broken links, add redirects from old URLs to new ones (so bookmarks / native deep links keep working).
- Standardize URL scheme: `/app/...` for user, `/admin/...` for admin (already partly the case).
- Output: routing PR, no visual changes.

### Phase 2 — User navigation shell
- Replace `AppLayout` with a responsive shell:
  - Desktop: collapsible left sidebar (shadcn `Sidebar`, `collapsible="icon"`) + top header with breadcrumbs.
  - Mobile: bottom nav (Home / Chats / Groups / Notifications / Profile) + drawer for the rest.
- Move existing pages under their new sections (Dashboard, Chats, Groups, Requests, Notifications, Profile, Settings, Premium, Help). No page contents change yet — just where they hang.
- Add a single `EmptyState`, `PageHeader`, and `SectionCard` primitive so subsequent phases can reuse them.

### Phase 3 — User settings consolidation
- Split today's monolithic `SettingsPage` into tabbed sub-pages: Account, Privacy, Notifications, Security, Theme, Language, Group preferences, Premium preferences.
- One route `/settings` with nested tabs; deep links like `/settings/privacy` work directly.

### Phase 4 — Admin panel restructure
- Reorganize `/admin` into the 11 modules you listed, using a sidebar identical in style to the user shell.
- Group existing admin pages (`AdminUsers`, `AdminChats`, `AdminGroups`, `AdminPayments`, `AdminSubscriptions`, `AdminPaymentInfo`, `AdminModeration`, `AdminReports`, `AdminPages`, `AdminTickets`, AI/translation settings) into Dashboard / Users / Chats / Groups / Premium / AI / Moderation / Content / System.
- Stub the modules that have no backing data yet (Media, Logs, Coupons, Maintenance mode) with "Coming soon" cards behind `has_role('admin')`, so navigation is complete without fake data.
- Enforce `has_role('admin')` at the `AdminLayout` boundary (already partially done) + per-route guard.

### Phase 5 — Design system pass
- Audit and unify: button variants, card padding, modal sizes, table styling, form field spacing, loader, empty state, error page.
- Pull all ad-hoc Tailwind colors back into semantic tokens from `index.css` (memory rule).
- Add a single `<DataTable>`, `<Modal>`, `<SearchBar>`, `<Pagination>` and migrate existing usages.

### Phase 6 — Responsive + QA sweep
- Walk every page at 360 / 768 / 1280 / 1920 widths in the preview, screenshot, fix overflow / cropping / horizontal scroll.
- Run typecheck + build, fix all errors.

### Optional Phase 7 — New features (only if you say yes in the decisions above)
- Media hub, feed, request-type expansion, full audit logs.

## Why phased

- Each phase is reviewable in one preview session.
- Each phase keeps the app shippable — nothing is half-migrated.
- You can stop after any phase and the app is still better than before.

## What I need from you

Answer the 4 decisions above, and tell me which phase to start with (default: Phase 1). I will not start implementation until you confirm — this is too large to "just do".
