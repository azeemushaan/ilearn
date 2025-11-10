export const SEG_MIN_CHARS = Number(process.env.NEXT_PUBLIC_SEG_MIN_CHARS ?? process.env.SEG_MIN_CHARS ?? 40);

export const PLAYER_EPSILON = Number(process.env.NEXT_PUBLIC_PLAYER_EPSILON ?? process.env.PLAYER_EPSILON ?? 0.25);

export const MCQ_MAX_PER_SEGMENT = Number(
  process.env.NEXT_PUBLIC_MCQ_MAX_PER_SEGMENT ?? process.env.MCQ_MAX_PER_SEGMENT ?? 1
);

export const NO_FALLBACK = (process.env.NEXT_PUBLIC_NO_FALLBACK ?? process.env.NO_FALLBACK ?? 'true')
  .toString()
  .toLowerCase() === 'true';
