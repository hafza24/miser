
## Plan: Random Chat ("Surprise Me") + Mode-Specific Chat Filtering

### Overview
Add a "Surprise Me" button to connect users with a random available person in the same mode, and filter chats so light-mode chats only appear in light mode and vice versa.

---

### 1. Database Changes

**New RPC function: `find_random_user`**
- Finds a random online user in the same mode who:
  - Is not the current user
  - Has no existing pending request between them
  - Has no active chat with current user
- Returns the random user's `user_id` or null if none found

**New RPC function: `start_random_chat`** (atomic)
- Calls `find_random_user` internally
- Creates the chat directly (bypassing request flow) OR sends auto-accepted request
- Returns the new chat_id or null

---

### 2. Frontend Changes

**DashboardPage.tsx**
1. Add "🎲 Surprise Me" button next to "Find People" button
2. Filter `activeChats` by current mode: `chats.filter(c => c.mode === mode && !isChatExpired(c))`
3. Handle the random chat flow:
   - Call `start_random_chat` RPC
   - If chat created → navigate to chat
   - If no users available → show "No one available" toast

---

### Technical Details

```sql
-- find_random_user RPC
CREATE OR REPLACE FUNCTION public.find_random_user(p_mode mode_preference)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT p.user_id INTO v_user_id
  FROM profiles p
  WHERE p.user_id <> auth.uid()
    AND p.mode_preference = p_mode
    AND p.is_suspended = false
    AND NOT EXISTS (
      SELECT 1 FROM chat_requests cr
      WHERE (cr.sender_id = auth.uid() AND cr.receiver_id = p.user_id)
         OR (cr.sender_id = p.user_id AND cr.receiver_id = auth.uid())
    )
    AND NOT EXISTS (
      SELECT 1 FROM chat_participants cp1
      JOIN chat_participants cp2 ON cp1.chat_id = cp2.chat_id
      JOIN chats c ON c.id = cp1.chat_id
      WHERE cp1.user_id = auth.uid() AND cp2.user_id = p.user_id
        AND (c.timer_stopped = true OR c.expires_at > now())
    )
  ORDER BY random()
  LIMIT 1;
  
  RETURN v_user_id;
END;
$$;

-- start_random_chat RPC (creates chat directly)
CREATE OR REPLACE FUNCTION public.start_random_chat(p_mode mode_preference)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_other_user uuid;
  v_chat_id uuid;
BEGIN
  v_other_user := find_random_user(p_mode);
  
  IF v_other_user IS NULL THEN
    RETURN NULL;
  END IF;
  
  INSERT INTO chats (mode, is_group, expires_at, timer_stopped)
  VALUES (p_mode, false, now() + interval '24 hours', false)
  RETURNING id INTO v_chat_id;
  
  INSERT INTO chat_participants (chat_id, user_id)
  VALUES (v_chat_id, auth.uid()), (v_chat_id, v_other_user);
  
  RETURN v_chat_id;
END;
$$;
```

**Frontend filter change:**
```typescript
const activeChats = chats.filter(c => c.mode === mode && !isChatExpired(c));
```

**New "Surprise Me" button:**
```tsx
<Button onClick={handleSurpriseMe} variant="outline" size="sm" className="gap-2">
  <Sparkles className="h-4 w-4" />
  Surprise Me
</Button>
```

---

### Files to Modify
- `supabase/migrations/` — New migration for RPCs
- `src/pages/DashboardPage.tsx` — Add button + filter chats by mode
