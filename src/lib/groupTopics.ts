export const GROUP_TOPICS = [
  'Friendship',
  'Romance',
  'Passionate',
  'Fantasy',
  'Deep conversation',
  'Emotional support',
  'Fun/social',
  'Shared interests',
  'Creative roleplay',
  'Travel',
  'Study',
  'Gaming',
] as const;

export type GroupTopic = typeof GROUP_TOPICS[number];

export const GROUP_SIZES = [3, 4, 5, 6, 8, 10] as const;

export type GenderReq = { men: number; women: number; any: number };

export const presetCompositions = (size: number): { label: string; req: GenderReq }[] => {
  const opts: { label: string; req: GenderReq }[] = [
    { label: 'Any gender mix', req: { men: 0, women: 0, any: size } },
    { label: `All women`, req: { men: 0, women: size, any: 0 } },
    { label: `All men`, req: { men: size, women: 0, any: 0 } },
  ];
  if (size === 3) {
    opts.push({ label: '1 man + 2 women', req: { men: 1, women: 2, any: 0 } });
    opts.push({ label: '2 men + 1 woman', req: { men: 2, women: 1, any: 0 } });
  }
  if (size === 4) {
    opts.push({ label: '2 men + 2 women', req: { men: 2, women: 2, any: 0 } });
    opts.push({ label: '3 men + 1 woman', req: { men: 3, women: 1, any: 0 } });
    opts.push({ label: '1 man + 3 women', req: { men: 1, women: 3, any: 0 } });
  }
  if (size >= 5) {
    const half = Math.floor(size / 2);
    opts.push({ label: `${half} men + ${size - half} women`, req: { men: half, women: size - half, any: 0 } });
  }
  return opts;
};
