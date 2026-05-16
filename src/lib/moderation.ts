// Keyword-based content moderation (no AI)

const NSFW_KEYWORDS = [
  'sex', 'nude', 'porn', 'explicit', 'naked', 'xxx',
  'fetish', 'orgasm', 'erotic', 'nsfw', 'dick', 'pussy',
  'cock', 'tits', 'boobs', 'cum', 'masturbate', 'jerk off',
];

const ILLEGAL_KEYWORDS = [
  'kill you', 'murder', 'suicide', 'rape', 'molest',
  'trafficking', 'underage', 'child porn', 'cp',
  'terrorism', 'bomb threat', 'pedo', 'loli',
];

const ABUSE_KEYWORDS = [
  'retard', 'faggot', 'nigger', 'kike', 'chink', 'spic',
  'kys', 'kill yourself', 'go die',
];

export type ViolationCategory = 'illegal' | 'abuse' | 'nsfw';

export interface ModerationResult {
  blocked: boolean;
  reason?: string;
  category?: ViolationCategory;
  matched?: string;
}

function find(list: string[], lower: string) {
  for (const k of list) if (lower.includes(k)) return k;
  return null;
}

export function moderateMessage(content: string, mode: 'light' | 'dark'): ModerationResult {
  const lower = content.toLowerCase();

  let m = find(ILLEGAL_KEYWORDS, lower);
  if (m) return { blocked: true, reason: 'Message contains prohibited or illegal content.', category: 'illegal', matched: m };

  m = find(ABUSE_KEYWORDS, lower);
  if (m) return { blocked: true, reason: 'Abusive language is not allowed.', category: 'abuse', matched: m };

  if (mode === 'light') {
    m = find(NSFW_KEYWORDS, lower);
    if (m) return { blocked: true, reason: 'Explicit content is not allowed in Light Mode.', category: 'nsfw', matched: m };
  }

  return { blocked: false };
}
