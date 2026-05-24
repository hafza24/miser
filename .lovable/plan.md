## Premium Group Requests — Threesome + Friend Circle Matching

A premium-only feature for creating curated private group chats (3–10 people) with gender composition, topic, AI-generated scene, opt-in matching, admin moderation, and auto-created group chat when filled.

---

### 1. Access Control
- Gated by `user_has_dark_access` / active premium subscription (reuse `has_active_subscription` + plan flag).
- Add new plan flag `group_requests_access boolean` on `subscription_plans` (default false), and a new helper `user_has_group_access(_user_id)`.
- Global admin toggle in `app_settings`: `group_requests_enabled`.

### 2. User Opt-in
- New column `profiles.receive_group_invites boolean default false`.
- Toggle on `SettingsPage` under a new "Group Invitations" card. Users with OFF excluded from matching pool & discovery.

### 3. Database (migration)

**`group_requests`**
- id, creator_id, type (`threesome` | `circle`), member_limit (3–10), gender_requirements (jsonb: `{men, women, any}`), topic (text, from allowed list), ai_scene_title, ai_scene_description, ai_icebreakers (text[]), mood_tags (text[]), status (`pending_review` | `open` | `filled` | `closed` | `rejected`), chat_id (nullable, set when filled), admin_note, created_at, expires_at (24h).

**`group_participants`**
- id, request_id, user_id, join_status (`pending` | `approved` | `rejected` | `left`), joined_at, unique(request_id, user_id).

**`app_settings`** keys
- `group_requests_enabled` (bool), `group_allowed_topics` (string[]), `group_require_admin_approval` (bool), `group_daily_create_limit` (int, default 3).

**RLS**
- `group_requests`: creator can SELECT/INSERT/UPDATE own; eligible premium+opted-in users can SELECT rows with `status='open'`; admins all.
- `group_participants`: user sees own + creator sees all rows of their request; insert requires opted-in + premium + not already joined + seats remaining.
- Security definer RPCs handle the heavy logic:
  - `create_group_request(...)` — validates premium, opt-in, daily limit, allowed topic, gender math == member_limit, calls scene generator marker (scene filled by edge function after insert), returns id.
  - `join_group_request(_request_id)` — validates eligibility, gender slot availability; auto-creates `chats` row + `chat_participants` when filled.
  - `respond_group_join(_participant_id, _approve bool)` — creator/admin approval flow when `require_admin_approval=true`.

### 4. AI Scene Generation
- New edge function `generate-group-scene` (Lovable AI Gateway, `google/gemini-3-flash-preview`, tool-calling for structured `{title, description, icebreakers[], mood_tags[]}`).
- Called from frontend immediately after `create_group_request` returns; updates the row with the scene.
- System prompt tuned to topic + gender composition + size; safe-for-platform for `light` mode requests; spicier tone only allowed when creator has dark access AND topic is in adult set.

### 5. Matching / Discovery
- `BrowseGroupsPage` (new) lists `status='open'` requests where current user:
  - has premium + group access
  - has `receive_group_invites=true`
  - matches at least one open gender slot
  - is not the creator and hasn't already joined
- Server-side filtering via a security-definer view or RPC `list_eligible_group_requests()` to avoid leaking ineligible rows.

### 6. UI
- **`SettingsPage`**: new "Group Invitations" card with switch.
- **`SubscriptionPage`**: surface group access under premium plan benefits.
- **`CreateGroupRequestPage`** (`/groups/new`): wizard — type → size → gender composition (validated to sum = size) → topic → review → submit. Shows AI scene after creation.
- **`BrowseGroupsPage`** (`/groups`): grid of group cards (topic, type, seats left, gender mix, scene preview, creator alias/emoji, Join button).
- **`GroupRequestDetailPage`** (`/groups/:id`): full scene, icebreakers, participants (anonymized), join/leave actions.
- **`AppLayout` nav**: add "Groups" entry for premium users.
- On group filled → redirect to `/chat/:chatId` (existing `ChatPage`). Pin AI scene as first system message in the new chat (insert a message with `sender_id = creator` and a `[SCENE]` prefix, or store on `chats` table — simpler: insert a system-style first message).

### 7. Admin
- **`AdminGroups.tsx`** (new, linked from `AdminDashboard`):
  - Toggle global enable, edit allowed topics, set daily create limit, toggle admin-approval-required.
  - Table of all requests with filters (status, creator, topic), actions: approve / reject / close / remove participant / ban creator from feature.
  - Usage analytics: total requests, filled rate, by topic.

### 8. Safety
- Explicit join action required (no auto-add).
- Leave button removes participant; if creator leaves, request auto-closes.
- Existing block / report systems reused inside the group chat.
- Opted-out users filtered at the DB function level — never see or receive requests.

### 9. Files

**New**
- `supabase/migrations/<ts>_group_requests.sql`
- `supabase/functions/generate-group-scene/index.ts`
- `src/pages/CreateGroupRequestPage.tsx`
- `src/pages/BrowseGroupsPage.tsx`
- `src/pages/GroupRequestDetailPage.tsx`
- `src/pages/admin/AdminGroups.tsx`
- `src/hooks/useGroupAccess.ts`
- `src/lib/groupTopics.ts`

**Edited**
- `src/App.tsx` — routes
- `src/components/AppLayout.tsx` — nav entry
- `src/pages/SettingsPage.tsx` — opt-in switch
- `src/pages/admin/AdminDashboard.tsx` — link to AdminGroups
- `src/pages/SubscriptionPage.tsx` — benefit row
- `src/integrations/supabase/types.ts` — regenerated

### Out of scope
- Cross-language matching weighting beyond reusing `primary_language`.
- Voice/video group features.
- Group-level subscription billing tiers (uses existing premium plan).

---

### Technical notes
- All eligibility checks duplicated in RLS + RPC so the client can't bypass.
- `create_group_request` enforces `sum(gender_requirements) == member_limit` (or `any` mode).
- Daily limit tracked via `count(*) where creator_id=auth.uid() and created_at >= today`.
- Auto-create chat uses existing `chats` + `chat_participants` schema; `is_group=true`, `mode` inherited from creator's current mode.
- Realtime: subscribe to `group_participants` for live seat counts on detail page.