// Pure handlers for chat_participants realtime events. Extracted so they can be
// unit-tested without mounting ChatPage or the supabase realtime client.

export interface ParticipantHandlerDeps {
  userId: string;
  getChatInfo: () => { is_group: boolean } | null;
  loadOtherUser: () => void;
  loadMessages: () => void;
  setChatEnded: (v: boolean) => void;
  setOtherLastReadAt: (v: string) => void;
}

export interface ParticipantRow {
  user_id: string;
  last_read_at?: string | null;
}

export const handleParticipantInsert = (
  _row: ParticipantRow,
  deps: ParticipantHandlerDeps,
) => {
  // A new participant joined — refresh both sides so messages continue to flow.
  deps.loadOtherUser();
  deps.loadMessages();
};

export const handleParticipantUpdate = (
  row: ParticipantRow,
  deps: ParticipantHandlerDeps,
) => {
  if (row.user_id !== deps.userId && row.last_read_at) {
    deps.setOtherLastReadAt(row.last_read_at);
  }
  // Always refresh so mood/group rooms stay in sync on any status change.
  deps.loadOtherUser();
  deps.loadMessages();
};

export const handleParticipantDelete = (
  row: ParticipantRow,
  deps: ParticipantHandlerDeps,
) => {
  if (row.user_id === deps.userId) return;
  const chat = deps.getChatInfo();
  if (chat?.is_group) {
    // Group / mood room: others leaving is normal — keep the room live.
    deps.loadOtherUser();
    deps.loadMessages();
  } else {
    // 1:1 chat: the other user leaving ends the chat.
    deps.setChatEnded(true);
  }
};
