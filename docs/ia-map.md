# Information Architecture & Route Mapping

This document inventories the app's current page structure and defines the target organization for the redesign.

## Core Navigation (Desktop Sidebar / Mobile Bottom Nav)

| Feature | Current Route | Target Section | Notes |
| :--- | :--- | :--- | :--- |
| **Dashboard** | `/dashboard` | Home | Overview of activity, stats, and quick actions. |
| **Chats** | `/chats` (alias) | Chats | Active 1:1 and small group conversations. |
| **Mood Rooms** | `/mood-rooms` | Communities | Public/semi-public themed chat spaces. |
| **Browse** | `/browse` | Discovery | Finding new people based on mode and interests. |
| **Groups** | `/groups` | Communities | Formal group browsing and requests. |
| **Requests** | N/A (part of dashboard) | Inbox | Dedicated space for incoming/outgoing chat/group requests. |
| **Notifications** | N/A (part of header) | Inbox | Full notifications center (was just a dropdown). |
| **Profile** | `/profile` | Profile | User's own presence, bio, and interests. |
| **Settings** | `/settings` | Profile | Account, Privacy, Theme, and App preferences. |
| **Premium** | `/subscription` | Profile | Billing, plans, and feature unlocks. |
| **Help** | `/page/faq` / `/download` | Support | FAQs, app downloads, and support tickets. |

## User Route Map

| Current Page | File Path | Action | New Route (Internal) |
| :--- | :--- | :--- | :--- |
| Landing Page | `src/pages/LandingPage.tsx` | Keep | `/` |
| Login / Register | `...LoginPage.tsx`, `...RegisterPage.tsx` | Keep | `/login`, `/register` |
| Mode Select | `src/pages/ModeSelectPage.tsx` | Keep | `/mode-select` |
| Dashboard | `src/pages/DashboardPage.tsx` | Merge | `/app/home` |
| Chat List | `src/pages/DashboardPage.tsx` | Merge | `/app/chats` |
| Chat Detail | `src/pages/ChatPage.tsx` | Keep | `/app/chat/:id` |
| Profile | `src/pages/ProfilePage.tsx` | Keep | `/app/profile` |
| Browse | `src/pages/BrowseProfilesPage.tsx` | Keep | `/app/browse` |
| Mood Rooms | `src/pages/MoodRoomsPage.tsx` | Keep | `/app/mood-rooms` |
| Group Browse | `src/pages/BrowseGroupsPage.tsx` | Keep | `/app/groups` |
| Group Detail | `src/pages/GroupRequestDetailPage.tsx` | Keep | `/app/groups/:id` |
| Settings | `src/pages/SettingsPage.tsx` | Split | `/app/settings/*` |
| Subscription | `src/pages/SubscriptionPage.tsx` | Keep | `/app/premium` |

## Admin Route Map

Current prefix `/admin` is consistent. Targeted reorg into modules:

| Current Page | Target Module | New Sidebar Group |
| :--- | :--- | :--- |
| `AdminDashboard` | Dashboard | Overview |
| `AdminUsers` | Users | User Management |
| `AdminModeration`, `AdminReports` | Moderation | Safety |
| `AdminChats`, `AdminMoodRooms`, `AdminGroups` | Content | Communication |
| `AdminSubscriptions`, `AdminPayments` | Finance | Revenue |
| `AdminTickets` | Support | Inbox |
| `AdminPages` | CMS | Content |
| `AdminTranslationSettings`, `AdminNotifications` | System | Configuration |

## Redirection & Cleanup

1. **Dead Routes**: 
   - `/chats` (current alias for `/dashboard`) -> `/app/chats`.
   - `/unlock-dark-mode` (legacy) -> `/app/premium`.
2. **Path Consolidation**:
   - Move user routes under `/app/` prefix to clearly separate from public and admin routes.
   - Example: `/dashboard` -> `/app/home`.
