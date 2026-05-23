# Smart Auto Translation + Live Interpretation

Build a multilingual translation layer over the existing chat using Lovable AI (Gemini) for detection + translation, with caching and on-demand expansion for older messages.

## 1. Database (migration)

**Profiles** — add language preferences:
- `primary_language` text default `'en'`
- `secondary_language` text nullable
- `auto_translate_enabled` boolean default `true`

**New table `message_translations`** (per-message, per-target-language cache):
- `id uuid pk`
- `message_id uuid` (references messages.id, on delete cascade)
- `target_language text`
- `translated_text text`
- `detected_language text`
- `status text` ('success' | 'failed')
- `created_at timestamptz`
- unique(message_id, target_language)
- RLS: select if user is participant of the message's chat; insert via edge function (service role) or by participants.

**Admin global settings table `app_settings`** (key/value):
- seed `translation_enabled = true`, `translation_model = google/gemini-3-flash-preview`

## 2. Edge function `translate-message`

Input: `{ message_id, target_language }` OR `{ text, target_language }` (for ad-hoc).

Flow:
1. Auth check + (if message_id) verify user is chat participant via RLS-respecting client.
2. Check `message_translations` cache → return if hit.
3. Call Lovable AI Gateway (`google/gemini-3-flash-preview`) with tool-calling for structured output: `{ detected_language, translated_text, was_already_target }`.
4. System prompt: detect language including Roman Urdu, Hinglish, Arabic transliteration, slang, typos; preserve tone/emojis/names; produce natural (non-literal) translation into target language; if source == target, return text unchanged with `was_already_target=true`.
5. Upsert cache row, return result.
6. Handle 429/402 → propagate clear error.

Uses `LOVABLE_API_KEY` (already set).

## 3. Frontend

**Profile / Settings page** — add two `<Select>`s for Primary and Secondary language (curated list incl. Urdu, English, Hindi, Arabic, Spanish, French, etc.) and an auto-translate toggle. Save to profile.

**ChatPage `MessageItem`** changes:
- Determine target = user's primary language.
- For each rendered message authored by the other user:
  - If it's one of the **last 2 messages** in the list AND `auto_translate_enabled` → fire `translate-message` on mount (debounced, deduped by message_id).
  - Older messages: render original only; double-tap (or double-click on desktop) triggers translation fetch.
- Display: original on top; translation below in `text-xs opacity-70 italic` with smooth `Collapsible` expand.
- Skip translation if message already loaded a cached translation marked `was_already_target` for primary OR detected_language matches primary/secondary.
- Show "Translation unavailable — Retry" on failure.

**Local cache**: `useRef<Map<string, Translation>>` in ChatPage so re-renders don't refetch. Server cache via `message_translations` is the source of truth across sessions.

**Performance**: optimistic skeleton ("Translating…"), parallel requests via `Promise.all` only for the latest two, others lazy.

## 4. Admin

`AdminSettings` (or extend existing admin) — toggle global `translation_enabled`, choose model from supported Lovable AI models, view count of rows in `message_translations` as basic analytics.

## 5. Out of scope (not building unless asked)

- True websocket push of translations (Supabase realtime on `message_translations` is a nice-to-have; will add a lightweight subscription so cached translations appear if another participant requested first).
- Per-message language override UI beyond double-tap.
- Encryption beyond Supabase's at-rest (translations live in same DB as messages).

## Files

- `supabase/migrations/<new>.sql` — schema above
- `supabase/functions/translate-message/index.ts` — new
- `supabase/config.toml` — register function (verify_jwt default)
- `src/lib/languages.ts` — supported language list + helpers
- `src/hooks/useTranslation.ts` — fetch/cache hook
- `src/components/chat/TranslatedMessage.tsx` — wraps content with translation UI + double-tap handler
- `src/pages/ProfilePage.tsx` — language selectors + toggle
- `src/pages/ChatPage.tsx` — wire `TranslatedMessage`, mark last-2 for auto-translate
- `src/pages/admin/AdminDashboard.tsx` (or new `AdminSettings.tsx`) — translation controls

Approve and I'll build it.
