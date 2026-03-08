// Keyword-based content moderation (no AI)

const BLOCKED_KEYWORDS_LIGHT = [
  'sex', 'nude', 'porn', 'explicit', 'naked', 'xxx',
  'fetish', 'orgasm', 'erotic', 'nsfw',
];

const BLOCKED_KEYWORDS_ALL = [
  'kill', 'murder', 'suicide', 'rape', 'abuse',
  'trafficking', 'underage', 'minor', 'child porn',
  'terrorism', 'bomb threat',
];

export interface ModerationResult {
  blocked: boolean;
  reason?: string;
}

export function moderateMessage(content: string, mode: 'light' | 'dark'): ModerationResult {
  const lower = content.toLowerCase();

  // Always block illegal content
  for (const keyword of BLOCKED_KEYWORDS_ALL) {
    if (lower.includes(keyword)) {
      return { blocked: true, reason: 'Message contains prohibited content.' };
    }
  }

  // Light mode: block explicit content
  if (mode === 'light') {
    for (const keyword of BLOCKED_KEYWORDS_LIGHT) {
      if (lower.includes(keyword)) {
        return { blocked: true, reason: 'Explicit content is not allowed in Light Mode.' };
      }
    }
  }

  return { blocked: false };
}
