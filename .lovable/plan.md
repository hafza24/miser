## M2 — Groups, 1:1 → Group upgrade, Ephemeral media

Builds on the existing `chats.is_group` schema. No new "free group request" flow — any user can convert a 1:1 chat into a group and add members, and the premium curated request flow already handles group creation from scratch.

---

### 1. Database (single migration)

**`chats`** — add metadata
- `name text` (null for 1:1)
- `image_url text`
- `created_by uuid` (null for legacy rows; set on new groups)
- `member_limit int default 10`

**`chat_participants`** — add role
- `role text default 'member'` check in ('owner','admin','member')
- `removed_at timestamptz` (soft kick)

**`messages`** — add ephemeral fields
- `media_type text` check in ('image','video','audio','file') null
- `media_path text` (storage object key, not URL)
- `media_size int`
- `view_once boolean default false`
- `expires_at timestamptz` (timed expiry, distinct from `self_destruct_minutes` which already exists for text)
- `viewed_by uuid[] default '{}'` (for view-once tracking in groups)
- `deleted_for_all boolean default false` (set when media expires/viewed)

**New table: `chat_invites`**
- id, chat_id, inviter_id, invitee_id, status ('pending'|'accepted'|'declined'|'cancelled'), created_at, responded_at
- unique(chat_id, invitee_id) where status='pending'

**New table: `media_views`** (per-user view tracking)
- id, message_id, viewer_id, viewed_at, unique(message_id, viewer_id)

**RPCs (security definer)**
- `upgrade_chat_to_group(p_chat_id, p_name)` — owner = caller, both existing participants become members, sets `is_group=true`, preserves message history, stops timer.
- `invite_to_chat(p_chat_id, p_user_id)` — only owner/admin, validates not blocked/restricted, not already member, under member_limit; creates `chat_invites` row.
- `respond_chat_invite(p_invite_id, p_accept)` — invitee accepts → adds to `chat_participants`.
- `remove_chat_member(p_chat_id, p_user_id)` — owner/admin only, can't remove owner; sets `removed_at`.
- `leave_chat(p_chat_id)` — soft-removes self; if owner leaves, promote oldest admin or close chat.
- `update_group_meta(p_chat_id, p_name, p_image_url)` — owner/admin only.
- `mark_media_viewed(p_message_id)` — appends to `viewed_by`, inserts `media_views`; if `view_once` and all non-sender participants viewed → set `deleted_for_all=true`, schedule storage deletion via cleanup function.

**RLS updates**
- `chat_participants` insert: relax to also allow inserts from `chat_invites.status='accepted'` (via security definer RPC, so RLS just blocks raw client inserts outside the invite/request flow).
- `messages` select: also hide rows where `deleted_for_all=true` from non-senders.
- New tables: standard auth-scoped policies; service_role full access.

**Realtime**: add `chat_invites`, `chat_participants` UPDATE events already covered.

### 2. Storage

- New private bucket `chat-media` (signed URLs, 60s TTL).
- RLS on `storage.objects`:
  - INSERT: authenticated user uploading under `{chat_id}/{message_id}/...` where they are a participant.
  - SELECT: participants of the chat referenced in the path.
  - DELETE: service_role only (cleanup function).

### 3. Edge function

`cleanup-ephemeral-media` — cron every 5 min:
- Find `messages` rows where (`expires_at < now()` OR `deleted_for_all=true`) AND `media_path IS NOT NULL`.
- Delete storage objects, null out `media_path`, set `content='[expired]'`.

Schedule via `supabase--insert` (pg_cron + pg_net), per the scheduled-jobs guide.

### 4. Frontend

**`ChatPage.tsx`** (edits)
- Group-aware header: shows group name + image when `is_group`, otherwise existing 1:1 alias.
- "Convert to group" action in chat menu when 1:1 → opens dialog (name + first invitee).
- "Group info" sheet: members list with roles, invite, rename, change image, leave, remove member (owner/admin).
- Message composer: paperclip → media picker with toggles "View once" and "Expires in" (1h/24h/7d/never).
- Render media messages with view-once gating (blur until tapped, then mark viewed, single-show).
- Filter out `deleted_for_all` messages.

**New: `src/components/chat/GroupInfoSheet.tsx`** — members, roles, invite, rename, image.
**New: `src/components/chat/MediaUploader.tsx`** — file pick, preview, view-once + expiry options, signed upload.
**New: `src/components/chat/MediaMessage.tsx`** — view-once / countdown rendering, signed-URL fetch.
**New: `src/components/chat/InviteUserDialog.tsx`** — search by alias, send invite.

**`DashboardPage.tsx`** — show pending `chat_invites` in a new "Group Invites" list with Accept/Decline.

**Notifications** — `NotificationContext.tsx`: new event type `group_invite` honoring `notify_group_invites_pref`.

### 5. Admin

`AdminChats.tsx` — add columns: members count, group/1:1 badge, view-once message count. Action: force-close group, remove member, purge media.

### 6. Files

**New**
- `supabase/migrations/<ts>_m2_groups_media.sql`
- `supabase/functions/cleanup-ephemeral-media/index.ts`
- `src/components/chat/GroupInfoSheet.tsx`
- `src/components/chat/MediaUploader.tsx`
- `src/components/chat/MediaMessage.tsx`
- `src/components/chat/InviteUserDialog.tsx`
- `src/hooks/useSignedMediaUrl.ts`

**Edited**
- `src/pages/ChatPage.tsx`
- `src/pages/DashboardPage.tsx`
- `src/contexts/NotificationContext.tsx`
- `src/pages/admin/AdminChats.tsx`
- `src/integrations/supabase/types.ts` (regenerated)

### 7. Out of scope (deferred to M3/M4)

- End-to-end encryption of media bytes (M4).
- Voice/video calls.
- Message reactions / threads beyond existing `reply_to`.
- Per-member read receipts in groups beyond existing `last_read_at`.

### Order of execution

1. Migration (waits for approval).
2. Storage bucket + storage RLS migration.
3. Edge function + cron schedule.
4. Frontend components + page edits.
5. Verify build, test invite/upgrade/media flow in preview.
