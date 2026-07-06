import React from 'react';

export const MENTION_REGEX = /@([A-Za-z0-9_]{2,64})/g;

export interface MentionMember {
  user_id: string;
  alias: string;
  emoji_avatar?: string | null;
}

/**
 * Render a message string, highlighting @alias tokens.
 * - Known aliases (in `members`) are shown in primary color.
 * - Unknown @tokens are shown unchanged.
 * - If a mention matches `meAlias`, it gets a stronger highlight.
 */
export function renderMentions(
  text: string,
  members: MentionMember[] | undefined,
  meAlias?: string | null,
): React.ReactNode {
  if (!text) return text;
  const byLower = new Map<string, MentionMember>();
  (members || []).forEach(m => byLower.set(m.alias.toLowerCase(), m));
  const meLower = meAlias?.toLowerCase();

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  const re = new RegExp(MENTION_REGEX.source, 'g');
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re.exec(text)) !== null) {
    const [full, alias] = match;
    const lower = alias.toLowerCase();
    const known = byLower.get(lower);
    if (!known) continue; // leave as plain text
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const isMe = meLower && meLower === lower;
    nodes.push(
      <span
        key={`m-${key++}`}
        className={
          isMe
            ? 'font-semibold rounded px-1 bg-primary/20 text-primary'
            : 'font-medium text-primary'
        }
      >
        {full}
      </span>,
    );
    lastIndex = match.index + full.length;
  }
  if (lastIndex === 0) return text;
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return <>{nodes}</>;
}

/**
 * Given the current input value and caret position, return the active `@query`
 * being typed (without the `@`), or null if not currently mentioning.
 */
export function getActiveMentionQuery(
  value: string,
  caret: number,
): { query: string; start: number } | null {
  if (caret <= 0) return null;
  const upTo = value.slice(0, caret);
  const at = upTo.lastIndexOf('@');
  if (at < 0) return null;
  // must be at start or preceded by whitespace
  if (at > 0 && !/\s/.test(upTo[at - 1])) return null;
  const query = upTo.slice(at + 1);
  if (!/^[A-Za-z0-9_]{0,64}$/.test(query)) return null;
  return { query, start: at };
}
