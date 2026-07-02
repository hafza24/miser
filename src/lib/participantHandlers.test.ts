import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleParticipantInsert,
  handleParticipantUpdate,
  handleParticipantDelete,
  type ParticipantHandlerDeps,
} from './participantHandlers';

const makeDeps = (overrides: Partial<ParticipantHandlerDeps> = {}): ParticipantHandlerDeps => ({
  userId: 'me',
  getChatInfo: () => ({ is_group: false }),
  loadOtherUser: vi.fn(),
  loadMessages: vi.fn(),
  setChatEnded: vi.fn(),
  setOtherLastReadAt: vi.fn(),
  ...overrides,
});

describe('participantHandlers', () => {
  describe('INSERT', () => {
    it('refreshes participants and messages when someone joins a group/mood room', () => {
      const deps = makeDeps({ getChatInfo: () => ({ is_group: true }) });
      handleParticipantInsert({ user_id: 'other' }, deps);
      expect(deps.loadOtherUser).toHaveBeenCalledTimes(1);
      expect(deps.loadMessages).toHaveBeenCalledTimes(1);
      expect(deps.setChatEnded).not.toHaveBeenCalled();
    });

    it('refreshes participants and messages in 1:1 chats too', () => {
      const deps = makeDeps();
      handleParticipantInsert({ user_id: 'other' }, deps);
      expect(deps.loadOtherUser).toHaveBeenCalledTimes(1);
      expect(deps.loadMessages).toHaveBeenCalledTimes(1);
    });
  });

  describe('UPDATE', () => {
    it('updates other user last_read_at and refreshes both lists', () => {
      const deps = makeDeps({ getChatInfo: () => ({ is_group: true }) });
      handleParticipantUpdate(
        { user_id: 'other', last_read_at: '2026-07-02T10:00:00Z' },
        deps,
      );
      expect(deps.setOtherLastReadAt).toHaveBeenCalledWith('2026-07-02T10:00:00Z');
      expect(deps.loadOtherUser).toHaveBeenCalledTimes(1);
      expect(deps.loadMessages).toHaveBeenCalledTimes(1);
    });

    it("does not set otherLastReadAt for the current user's own row", () => {
      const deps = makeDeps();
      handleParticipantUpdate(
        { user_id: 'me', last_read_at: '2026-07-02T10:00:00Z' },
        deps,
      );
      expect(deps.setOtherLastReadAt).not.toHaveBeenCalled();
      // still refreshes to stay in sync
      expect(deps.loadOtherUser).toHaveBeenCalledTimes(1);
      expect(deps.loadMessages).toHaveBeenCalledTimes(1);
    });

    it('refreshes even when last_read_at is missing', () => {
      const deps = makeDeps();
      handleParticipantUpdate({ user_id: 'other' }, deps);
      expect(deps.setOtherLastReadAt).not.toHaveBeenCalled();
      expect(deps.loadOtherUser).toHaveBeenCalledTimes(1);
      expect(deps.loadMessages).toHaveBeenCalledTimes(1);
    });
  });

  describe('DELETE', () => {
    it('keeps the room live and refreshes when a participant leaves a mood/group room', () => {
      const deps = makeDeps({ getChatInfo: () => ({ is_group: true }) });
      handleParticipantDelete({ user_id: 'other' }, deps);
      expect(deps.setChatEnded).not.toHaveBeenCalled();
      expect(deps.loadOtherUser).toHaveBeenCalledTimes(1);
      expect(deps.loadMessages).toHaveBeenCalledTimes(1);
    });

    it('ends the chat when the other user leaves a 1:1 chat', () => {
      const deps = makeDeps({ getChatInfo: () => ({ is_group: false }) });
      handleParticipantDelete({ user_id: 'other' }, deps);
      expect(deps.setChatEnded).toHaveBeenCalledWith(true);
      expect(deps.loadOtherUser).not.toHaveBeenCalled();
      expect(deps.loadMessages).not.toHaveBeenCalled();
    });

    it('ignores the current user leaving (they navigate away themselves)', () => {
      const deps = makeDeps({ getChatInfo: () => ({ is_group: false }) });
      handleParticipantDelete({ user_id: 'me' }, deps);
      expect(deps.setChatEnded).not.toHaveBeenCalled();
      expect(deps.loadOtherUser).not.toHaveBeenCalled();
      expect(deps.loadMessages).not.toHaveBeenCalled();
    });

    it('reads chatInfo lazily so late-arriving is_group is respected', () => {
      let info: { is_group: boolean } | null = null;
      const deps = makeDeps({ getChatInfo: () => info });
      // chatInfo not loaded yet at the time the handler was created:
      info = { is_group: true };
      handleParticipantDelete({ user_id: 'other' }, deps);
      expect(deps.setChatEnded).not.toHaveBeenCalled();
      expect(deps.loadMessages).toHaveBeenCalledTimes(1);
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });
});
