# Information Architecture Map — Fur&Fir

Source-of-truth for the page/route audit. Phase 1 deliverable.
Each row: current page → purpose → target section (per the approved IA) → action.

> Routes are kept stable in Phase 1 so the Capacitor APK / PWA deep links
> keep working. Phase 2 will move pages under the new shell; Phase 1 only
> deletes dead code and adds redirects where safe.

## User-facing pages

| File | Route | Purpose today | Target IA section | Action |
|---|---|---|---|---|
| `LandingPage.tsx` | `/` | Marketing landing | Public | Keep |
| `LoginPage.tsx` | `/login` | Sign in | Public / Auth | Keep |
| `RegisterPage.tsx` | `/register` | Sign up | Public / Auth | Keep |
| `ForgotPasswordPage.tsx` | `/forgot-password` | Request reset | Public / Auth | Keep |
| `ResetPasswordPage.tsx` | `/reset-password` | Set new password | Public / Auth | Keep |
| `SuspendedPage.tsx` | `/suspended` | Blocked-user landing | System | Keep |
| `ModeSelectPage.tsx` | `/mode-select` | Light/Dark first-run picker | Onboarding | Keep, fold into post-register flow in Phase 2 |
| `DashboardPage.tsx` | `/dashboard` | Chat list + recent activity + quotas | **Dashboard / Home** + **Chats** | Phase 2: split — keep chat list under `/chats`, surface activity/quotas on `/dashboard` |
| `ChatPage.tsx` | `/chat/:chatId` | 1:1 + group chat thread | **Chats** | Keep |
| `BrowseProfilesPage.tsx` | `/browse` | Find users to chat with | **Dashboard / Recommendations** | Phase 2: move under `/discover` (alias `/browse` redirect) |
| `BrowseGroupsPage.tsx` | `/groups` | Group list + browse | **Groups / Browse + My groups** | Phase 2: split tabs `my` / `browse` / `invites` |
| `CreateGroupRequestPage.tsx` | `/groups/new` | Create group request | **Groups / Create group** | Keep |
| `GroupRequestDetailPage.tsx` | `/groups/:id` | Group request detail / join | **Groups** | Keep |
| `ProfilePage.tsx` | `/profile` | Self profile edit (alias, bio, interests, avatar, photos, verification) | **Profile** | Phase 2: split into tabs (Info / Photos / Interests / Verification) |
| `SettingsPage.tsx` | `/settings` | Account, privacy, notifications, security, theme, language, group/premium prefs (monolithic) | **Settings** | Phase 3: split into 8 tabs |
| `SubscriptionPage.tsx` | `/subscription` | Plans + benefits + manual payment proof + history | **Premium** | Phase 2: split tabs (Plans / Billing / History) |
| `UnlockDarkModePage.tsx` | (orphan, only redirected from) | Legacy dark-mode unlock | — | **DELETE** — already redirected, no inbound links |
| `SitePage.tsx` | `/page/:slug` | Static admin-managed pages | **Help / Content** | Keep |
| `DownloadPage.tsx` | `/download` | APK / PWA download | **Public** | Keep |
| `Index.tsx` | (none) | Stub | — | **DELETE** — not routed, dead file |
| `NotFound.tsx` | `*` | 404 | System | Keep |

## Admin pages

| File | Route | Target module | Action |
|---|---|---|---|
| `AdminDashboard.tsx` | `/admin` | **Dashboard** | Keep |
| `AdminUsers.tsx` | `/admin/users` | **Users** (All / Online / Premium / Banned / Verification tabs in Phase 4) | Keep, add tabs in Phase 4 |
| `AdminModeration.tsx` | `/admin/moderation` | **Moderation** | Keep |
| `AdminReports.tsx` | `/admin/reports` | **Moderation / Reports** | Phase 4: move under Moderation |
| `AdminChats.tsx` | `/admin/chats` | **Chats** | Keep |
| `AdminGroups.tsx` | `/admin/groups` | **Groups** | Keep |
| `AdminTickets.tsx` | `/admin/tickets` | **Moderation / Support** | Phase 4: move under Moderation or Help |
| `AdminSubscriptions.tsx` | `/admin/subscriptions` | **Premium / Plans + Purchases** | Keep |
| `AdminPaymentInfo.tsx` | `/admin/payment-info` | **System / Payment Methods** | Phase 4: move under System |
| `AdminPages.tsx` | `/admin/pages` | **Content / Pages** | Keep |
| `AdminTranslationSettings.tsx` | (orphan — no route!) | **AI / Settings** | **WIRE UP** — currently unreachable |

### Missing admin modules (per spec)
Stubs needed in Phase 4 (no backing data yet — render "Coming soon" behind `has_role('admin')`):
- **Media** (Images / Videos / Temporary / Storage usage)
- **AI** (Settings — wire `AdminTranslationSettings`, plus Prompts / Moderation / Scene generation stubs)
- **Content** (Announcements / Banners / Templates stubs; Pages exists)
- **System** (Site settings / Email / Storage / Security / Maintenance / API)
- **Logs** (User / Admin / Security / Error) — **requires new backend tables; gated on user decision #4**

## Routes to remove / redirect

| Route | Status | Action |
|---|---|---|
| `/unlock-dark-mode` | Already redirects to `/subscription` | Keep redirect, delete `UnlockDarkModePage.tsx` file |
| `/admin/payments` | Already redirects to `/admin/subscriptions` | Keep |
| `Index.tsx` (file) | Not routed | Delete file |

## Components review (Phase 5)
Shared primitives to extract:
- `PageHeader` (title, subtitle, breadcrumbs, actions slot)
- `EmptyState` (icon, title, body, CTA)
- `SectionCard` (consistent card wrapper)
- `DataTable` (replaces ad-hoc tables in admin pages)
- `SearchBar`, `Pagination`, `Modal`, `Loader`

## Pending decisions (blocks Phase 2+)
1. Media hub — new feature or in-chat filter?
2. Request types — are Friend / 3-person / Match new flows, or aliases?
3. Dashboard Feed — real content feed or activity hub?
4. Admin Logs — build audit infra or stub?

Until these are answered, only Phase 1 (this doc + dead-code removal) and Phase 5 (design tokens) can proceed safely.
