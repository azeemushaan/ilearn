import { SEG_MIN_CHARS } from '@/lib/constants/phase5';

export type CaptionCue = {
  tStartSec: number;
  tEndSec: number;
  text: string;
};

export type Phase5Segment = {
  segmentId: string;
  title: string;
  tStartSec: number;
  tEndSec: number;
  language: string;
  text: string;
  cues: CaptionCue[];
};

export type Phase5Skipped = {
  tStartSec: number;
  tEndSec: number;
  reason: 'INTRO' | 'MUSIC' | 'OFF_TOPIC' | 'SHORT' | 'PROMO';
  text?: string;
};

export type Phase5SegmentationResult = {
  segments: Phase5Segment[];
  skipped: Phase5Skipped[];
  logs: string[];
};

const MUSIC_PATTERNS = [/\bmus(?:ic|ical)\b/i, /\btheme\b/i, /\bintro music\b/i, /\bbackground music\b/i];
const INTRO_PATTERNS = [/\bwelcome\b/i, /\bhey everyone\b/i, /\bintro(?:duction)?\b/i, /\bmy name is\b/i];
const PROMO_PATTERNS = [/\bsponsor\b/i, /\bsponsored by\b/i, /\bsubscribe\b/i, /\bpromo\b/i, /\bpatreon\b/i];

const CLEAN_TEXT_REGEX = /\s+/g;
const TITLE_WORD_REGEX = /[\w']+/g;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const shouldSkipForPattern = (text: string, patterns: RegExp[]) => patterns.some(pattern => pattern.test(text));

const isOffTopic = (text: string, videoTopic?: string) => {
  if (!videoTopic) return false;
  const normalizedTopic = videoTopic.toLowerCase();
  const normalizedText = text.toLowerCase();
  if (normalizedText.includes(normalizedTopic)) return false;
  const topicTokens = new Set(normalizedTopic.split(/[^\w]+/g).filter(Boolean));
  const textTokens = new Set(normalizedText.split(/[^\w]+/g).filter(Boolean));
  let overlap = 0;
  topicTokens.forEach(token => {
    if (textTokens.has(token)) overlap++;
  });
  return overlap === 0 && textTokens.size > 0;
};

const normaliseText = (text: string) =>
  text
    .replace(/\[(?:music|applause|laughter)[^\]]*\]/gi, '')
    .replace(/\((?:music|applause|laughter)[^)]*\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

const buildTitle = (text: string) => {
  const match = text.match(TITLE_WORD_REGEX);
  if (!match) return 'Segment';
  const titleWords = match.slice(0, 5);
  if (titleWords.length === 0) {
    return 'Segment';
  }
  const formatted = titleWords.join(' ');
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
};

const joinCueText = (cues: CaptionCue[]) =>
  cues
    .map(cue => cue.text.trim())
    .filter(Boolean)
    .join(' ')
    .replace(CLEAN_TEXT_REGEX, ' ') // collapse whitespace
    .trim();

type SegmentationOptions = {
  language?: string;
  videoTopic?: string;
};

export function segmentTranscriptPhase5(
  cues: CaptionCue[],
  { language = 'en', videoTopic }: SegmentationOptions = {}
): Phase5SegmentationResult {
  const logs: string[] = [];
  const keptSegments: Phase5Segment[] = [];
  const skipped: Phase5Skipped[] = [];

  if (!Array.isArray(cues) || cues.length === 0) {
    logs.push('SEG:SKIP all reason=NO_CUES');
    return { segments: [], skipped, logs };
  }

  const workingCues = cues
    .filter(cue => cue && typeof cue.tStartSec === 'number' && typeof cue.tEndSec === 'number')
    .map(cue => ({ ...cue, text: cue.text ?? '' }));

  let segmentStartIndex = 0;

  const pushSegment = (startIndex: number, endIndexExclusive: number) => {
    const segmentCues = workingCues.slice(startIndex, endIndexExclusive);
    if (segmentCues.length === 0) return;

    const text = joinCueText(segmentCues);
    const tStartSec = segmentCues[0].tStartSec;
    const tEndSec = segmentCues[segmentCues.length - 1].tEndSec;

    const cleanedText = normaliseText(text);
    const charLength = cleanedText.length;

    if (charLength < SEG_MIN_CHARS) {
      skipped.push({ tStartSec, tEndSec, reason: 'SHORT', text: cleanedText });
      logs.push(`SEG:SKIP reason=SHORT t=${tStartSec.toFixed(2)}-${tEndSec.toFixed(2)} chars=${charLength}`);
      return;
    }

    if (shouldSkipForPattern(cleanedText, MUSIC_PATTERNS)) {
      skipped.push({ tStartSec, tEndSec, reason: 'MUSIC', text: cleanedText });
      logs.push(`SEG:SKIP reason=MUSIC t=${tStartSec.toFixed(2)}-${tEndSec.toFixed(2)}`);
      return;
    }

    if (shouldSkipForPattern(cleanedText, PROMO_PATTERNS)) {
      skipped.push({ tStartSec, tEndSec, reason: 'PROMO', text: cleanedText });
      logs.push(`SEG:SKIP reason=PROMO t=${tStartSec.toFixed(2)}-${tEndSec.toFixed(2)}`);
      return;
    }

    if (shouldSkipForPattern(cleanedText, INTRO_PATTERNS)) {
      skipped.push({ tStartSec, tEndSec, reason: 'INTRO', text: cleanedText });
      logs.push(`SEG:SKIP reason=INTRO t=${tStartSec.toFixed(2)}-${tEndSec.toFixed(2)}`);
      return;
    }

    if (isOffTopic(cleanedText, videoTopic)) {
      skipped.push({ tStartSec, tEndSec, reason: 'OFF_TOPIC', text: cleanedText });
      logs.push(`SEG:SKIP reason=OFF_TOPIC t=${tStartSec.toFixed(2)}-${tEndSec.toFixed(2)}`);
      return;
    }

    const title = buildTitle(cleanedText);
    const segmentId = `seg_${keptSegments.length + 1}`;

    keptSegments.push({
      segmentId,
      title,
      tStartSec,
      tEndSec,
      language,
      text: cleanedText,
      cues: segmentCues,
    });

    logs.push(
      `SEG:KEEP id=${segmentId} t=${tStartSec.toFixed(2)}-${tEndSec.toFixed(2)} duration=${(
        tEndSec - tStartSec
      ).toFixed(2)} chars=${charLength}`
    );
  };

  const shouldSplit = (index: number, currentStart: number, currentTextLength: number) => {
    if (index <= segmentStartIndex) return false;
    const prevCue = workingCues[index - 1];
    const currentCue = workingCues[index];
    const duration = currentCue.tEndSec - workingCues[segmentStartIndex].tStartSec;
    const gap = currentCue.tStartSec - prevCue.tEndSec;

    if (gap >= 6) {
      return true;
    }

    if (duration >= 120) {
      return true;
    }

    if (currentTextLength >= 900) {
      return true;
    }

    const prevSentenceEnd = /[\.?!]\s*$/.test(prevCue.text.trim());
    if (duration >= 45 && prevSentenceEnd) {
      return true;
    }

    return false;
  };

  for (let i = 0; i < workingCues.length; i++) {
    const cue = workingCues[i];
    const currentText = joinCueText(workingCues.slice(segmentStartIndex, i + 1));

    if (shouldSplit(i, segmentStartIndex, currentText.length)) {
      pushSegment(segmentStartIndex, i);
      segmentStartIndex = i;
    }

    if (i === workingCues.length - 1) {
      pushSegment(segmentStartIndex, workingCues.length);
    }
  }

  // merge very short trailing segments with previous kept segment if possible
  if (keptSegments.length >= 2) {
    const merged: Phase5Segment[] = [];
    for (const segment of keptSegments) {
      if (
        merged.length > 0 &&
        segment.text.length < SEG_MIN_CHARS * 1.25 &&
        segment.tStartSec - merged[merged.length - 1].tEndSec <= 2
      ) {
        const previous = merged.pop()!;
        const combinedCues = [...previous.cues, ...segment.cues];
        const combinedText = joinCueText(combinedCues);
        const cleanedCombined = normaliseText(combinedText);
        const mergedSegment: Phase5Segment = {
          ...previous,
          tEndSec: segment.tEndSec,
          text: cleanedCombined,
          cues: combinedCues,
          title: buildTitle(cleanedCombined),
        };
        merged.push(mergedSegment);
        logs.push(`SEG:MERGE from=${previous.segmentId} into=${segment.segmentId}`);
      } else {
        merged.push(segment);
      }
    }
    for (let i = 0; i < merged.length; i++) {
      merged[i] = { ...merged[i], segmentId: `seg_${i + 1}`, title: buildTitle(merged[i].text) };
    }
    return { segments: merged, skipped, logs };
  }

  return { segments: keptSegments, skipped, logs };
}

export const segmentTelemetrySummary = (result: Phase5SegmentationResult) => ({
  kept: result.segments.length,
  skipped: result.skipped.length,
  reasons: result.skipped.reduce<Record<string, number>>((acc, item) => {
    acc[item.reason] = (acc[item.reason] ?? 0) + 1;
    return acc;
  }, {}),
});

export const toFirestoreSegment = (segment: Phase5Segment, index: number) => ({
  segmentIndex: index,
  tStartSec: segment.tStartSec,
  tEndSec: segment.tEndSec,
  durationSec: clamp(segment.tEndSec - segment.tStartSec, 0, Number.MAX_SAFE_INTEGER),
  textChunk: segment.text,
  title: segment.title,
  language: segment.language,
});
