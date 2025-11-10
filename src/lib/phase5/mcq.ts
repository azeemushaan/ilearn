import { MCQ_MAX_PER_SEGMENT } from '@/lib/constants/phase5';

export type SegmentForMcq = {
  segmentId: string;
  title: string;
  text: string;
  tStartSec: number;
  tEndSec: number;
  language?: string;
};

export type McqSupportLine = {
  tStartSec: number;
  tEndSec: number;
  text: string;
};

export type GeneratedMcq = {
  questionId: string;
  language: string;
  stem: string;
  options: [string, string, string, string];
  correctIndex: number;
  rationale: string;
  support: McqSupportLine[];
};

export type McqGenerationOutcome = {
  segmentId: string;
  title: string;
  reason: 'OK' | 'INSUFFICIENT_CONTEXT' | 'INTRO' | 'OFF_TOPIC' | 'MUSIC' | 'DUPLICATE';
  mcqs: GeneratedMcq[];
  log: string;
};

const tokenize = (text: string) =>
  text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

const cosineSimilarity = (a: string, b: string) => {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  const countsA = new Map<string, number>();
  const countsB = new Map<string, number>();

  for (const token of tokensA) {
    countsA.set(token, (countsA.get(token) ?? 0) + 1);
  }
  for (const token of tokensB) {
    countsB.set(token, (countsB.get(token) ?? 0) + 1);
  }

  const intersection = new Set([...countsA.keys()].filter(token => countsB.has(token)));

  let dot = 0;
  for (const token of intersection) {
    dot += (countsA.get(token) ?? 0) * (countsB.get(token) ?? 0);
  }

  const norm = (counts: Map<string, number>) => Math.sqrt([...counts.values()].reduce((acc, value) => acc + value * value, 0));
  const normA = norm(countsA);
  const normB = norm(countsB);

  if (normA === 0 || normB === 0) return 0;
  return dot / (normA * normB);
};

const sentenceSplit = (text: string) =>
  text
    .replace(/\s+/g, ' ')
    .split(/(?<=[\.!?])\s+/)
    .map(sentence => sentence.trim())
    .filter(sentence => sentence.length > 0);

const isAssessable = (sentence: string) => {
  if (sentence.length < 40) return false;
  return /\b(is|are|was|were|means|refers|includes|consists|because|therefore|results)\b/i.test(sentence);
};

const buildQuestionFromSentence = (sentence: string, segment: SegmentForMcq) => {
  const sentenceText = sentence.trim();
  const [subject, ...rest] = sentenceText.split(' is ');
  if (rest.length === 0) {
    return null;
  }
  const explanation = rest.join(' is ').trim().replace(/\n+/g, ' ');
  if (!explanation) {
    return null;
  }

  const stem = `According to the video segment "${segment.title}", what is ${subject.trim()}?`;
  const correct = explanation.replace(/\.$/, '');
  const incorrectA = `${subject.trim()} is unrelated to ${segment.title.toLowerCase()}.`;
  const incorrectB = `${subject.trim()} describes a different concept mentioned later.`;
  const incorrectC = `${subject.trim()} focuses on entertainment rather than learning.`;

  return {
    stem,
    options: [correct, incorrectA, incorrectB, incorrectC] as [string, string, string, string],
    correctIndex: 0,
    rationale: `The segment states that ${subject.trim()} is ${correct}.`,
  };
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const deriveSupport = (segment: SegmentForMcq, sentence: string): McqSupportLine[] => {
  const { tStartSec, tEndSec } = segment;
  const duration = Math.max(0, tEndSec - tStartSec);
  const sentences = sentenceSplit(segment.text);
  const index = sentences.findIndex(s => s.includes(sentence.trim()));
  const ratio = sentences.length > 0 ? index / sentences.length : 0;
  const start = tStartSec + duration * ratio;
  const end = clamp(start + Math.max(2, duration * 0.1), tStartSec, tEndSec);
  return [
    {
      tStartSec: start,
      tEndSec: end,
      text: sentence.trim(),
    },
  ];
};

export function generateMcqForSegment(
  segment: SegmentForMcq,
  existingStems: string[],
  targetLanguage: string
): McqGenerationOutcome {
  const logParts: string[] = [];
  const normalizedText = segment.text.trim();

  if (!normalizedText || normalizedText.length < 40) {
    logParts.push('MCQ:EMPTY reason=INSUFFICIENT_CONTEXT chars=' + normalizedText.length);
    return { segmentId: segment.segmentId, title: segment.title, reason: 'INSUFFICIENT_CONTEXT', mcqs: [], log: logParts.join(' ') };
  }

  const sentences = sentenceSplit(normalizedText);
  const assessableSentence = sentences.find(sentence => isAssessable(sentence));

  if (!assessableSentence) {
    logParts.push('MCQ:EMPTY reason=INSUFFICIENT_CONTEXT sentences=' + sentences.length);
    return { segmentId: segment.segmentId, title: segment.title, reason: 'INSUFFICIENT_CONTEXT', mcqs: [], log: logParts.join(' ') };
  }

  const questionBase = buildQuestionFromSentence(assessableSentence, segment);
  if (!questionBase) {
    logParts.push('MCQ:EMPTY reason=INSUFFICIENT_CONTEXT no_question_from_sentence');
    return { segmentId: segment.segmentId, title: segment.title, reason: 'INSUFFICIENT_CONTEXT', mcqs: [], log: logParts.join(' ') };
  }

  const dedupeScore = existingStems.reduce((max, stem) => Math.max(max, cosineSimilarity(stem, questionBase.stem)), 0);
  if (dedupeScore >= 0.9) {
    logParts.push(`MCQ:DROP_DUP cosine=${dedupeScore.toFixed(2)}`);
    return { segmentId: segment.segmentId, title: segment.title, reason: 'DUPLICATE', mcqs: [], log: logParts.join(' ') };
  }

  const support = deriveSupport(segment, assessableSentence);
  if (!support.length) {
    logParts.push('MCQ:EMPTY reason=INSUFFICIENT_CONTEXT no_support');
    return { segmentId: segment.segmentId, title: segment.title, reason: 'INSUFFICIENT_CONTEXT', mcqs: [], log: logParts.join(' ') };
  }

  const mcq: GeneratedMcq = {
    questionId: `${segment.segmentId}_q1`,
    language: targetLanguage,
    stem: questionBase.stem,
    options: questionBase.options,
    correctIndex: questionBase.correctIndex,
    rationale: questionBase.rationale,
    support,
  };

  logParts.push('MCQ:OK supportLines=' + support.length);

  return {
    segmentId: segment.segmentId,
    title: segment.title,
    reason: 'OK',
    mcqs: [mcq].slice(0, MCQ_MAX_PER_SEGMENT),
    log: logParts.join(' '),
  };
}

export const buildMcqTelemetry = (outcomes: McqGenerationOutcome[]) => {
  const summary = {
    generated: 0,
    empty: 0,
    duplicate: 0,
  };

  for (const outcome of outcomes) {
    if (outcome.mcqs.length > 0) summary.generated += 1;
    if (outcome.reason === 'INSUFFICIENT_CONTEXT') summary.empty += 1;
    if (outcome.reason === 'DUPLICATE') summary.duplicate += 1;
  }

  return summary;
};
