/**
 * Transcript Segmentation Utility
 * Segments video transcripts into chunks for quiz generation
 * Target: 30-60 second intervals at concept/topic boundaries
 */

export interface TranscriptSegment {
  tStartSec: number;
  tEndSec: number;
  textChunk: string;
  textChunkHash: string;
}

export interface SRTCue {
  index: number;
  startTime: number; // seconds
  endTime: number; // seconds
  text: string;
}

/**
 * Parse SRT format to structured cues
 */
export function parseSRT(srtContent: string): SRTCue[] {
  const cues: SRTCue[] = [];
  const blocks = srtContent.trim().split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.length < 3) continue;

    const index = parseInt(lines[0], 10);
    const timeLine = lines[1];
    const text = lines.slice(2).join(' ').trim();

    const timeMatch = timeLine.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
    if (!timeMatch) continue;

    const startTime = 
      parseInt(timeMatch[1]) * 3600 + 
      parseInt(timeMatch[2]) * 60 + 
      parseInt(timeMatch[3]) + 
      parseInt(timeMatch[4]) / 1000;

    const endTime = 
      parseInt(timeMatch[5]) * 3600 + 
      parseInt(timeMatch[6]) * 60 + 
      parseInt(timeMatch[7]) + 
      parseInt(timeMatch[8]) / 1000;

    cues.push({ index, startTime, endTime, text });
  }

  return cues;
}

/**
 * Parse VTT format to structured cues
 */
export function parseVTT(vttContent: string): SRTCue[] {
  const cues: SRTCue[] = [];
  const lines = vttContent.split('\n');
  
  let index = 0;
  let i = 0;
  
  // Skip header
  while (i < lines.length && !lines[i].includes('-->')) {
    i++;
  }

  while (i < lines.length) {
    const line = lines[i].trim();
    
    if (line.includes('-->')) {
      const timeMatch = line.match(/(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})/);
      if (timeMatch) {
        const startTime = 
          parseInt(timeMatch[1]) * 3600 + 
          parseInt(timeMatch[2]) * 60 + 
          parseInt(timeMatch[3]) + 
          parseInt(timeMatch[4]) / 1000;

        const endTime = 
          parseInt(timeMatch[5]) * 3600 + 
          parseInt(timeMatch[6]) * 60 + 
          parseInt(timeMatch[7]) + 
          parseInt(timeMatch[8]) / 1000;

        // Collect text lines until empty line or next cue
        i++;
        const textLines: string[] = [];
        while (i < lines.length && lines[i].trim() && !lines[i].includes('-->')) {
          textLines.push(lines[i].trim());
          i++;
        }

        if (textLines.length > 0) {
          cues.push({
            index: index++,
            startTime,
            endTime,
            text: textLines.join(' '),
          });
        }
      }
    }
    i++;
  }

  return cues;
}

/**
 * Simple hash function for text chunks
 */
function hashText(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Find sentence boundaries in text
 */
function findSentenceBoundaries(text: string): number[] {
  const boundaries: number[] = [0];
  const sentenceEnders = /[.!?]\s+/g;
  let match;

  while ((match = sentenceEnders.exec(text)) !== null) {
    boundaries.push(match.index + match[0].length);
  }

  boundaries.push(text.length);
  return boundaries;
}

/**
 * Segment transcript into chunks
 * Strategy:
 * 1. Prefer natural boundaries (sentence ends)
 * 2. Target 30-60 second segments
 * 3. Don't split mid-sentence if possible
 */
export function segmentTranscript(
  cues: SRTCue[],
  options: {
    minDuration?: number; // seconds (default: 30)
    maxDuration?: number; // seconds (default: 60)
    preferredDuration?: number; // seconds (default: 45)
  } = {}
): TranscriptSegment[] {
  const {
    minDuration = 30,
    maxDuration = 60,
    preferredDuration = 45,
  } = options;

  if (cues.length === 0) return [];

  const segments: TranscriptSegment[] = [];
  let currentSegmentStart = cues[0].startTime;
  let currentText: string[] = [];
  let lastCueEnd = cues[0].startTime;

  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    const duration = cue.endTime - currentSegmentStart;

    currentText.push(cue.text);
    lastCueEnd = cue.endTime;

    // Check if we should create a segment
    const shouldSegment = 
      duration >= preferredDuration || // Reached preferred duration
      (duration >= minDuration && isAtSentenceBoundary(cue.text)) || // At natural boundary
      duration >= maxDuration || // Exceeded max duration
      i === cues.length - 1; // Last cue

    if (shouldSegment) {
      const textChunk = currentText.join(' ').trim();
      
      segments.push({
        tStartSec: Math.floor(currentSegmentStart),
        tEndSec: Math.ceil(lastCueEnd),
        textChunk,
        textChunkHash: hashText(textChunk),
      });

      // Reset for next segment
      if (i < cues.length - 1) {
        currentSegmentStart = cues[i + 1].startTime;
        currentText = [];
      }
    }
  }

  return segments;
}

/**
 * Check if text ends at a sentence boundary
 */
function isAtSentenceBoundary(text: string): boolean {
  return /[.!?]\s*$/.test(text.trim());
}

/**
 * Segment using YouTube chapters
 * Fallback when no transcript is available
 */
export interface YouTubeChapter {
  title: string;
  startTime: number; // seconds
}

export function segmentByChapters(
  chapters: YouTubeChapter[],
  videoDuration: number
): TranscriptSegment[] {
  if (chapters.length === 0) return [];

  const segments: TranscriptSegment[] = [];

  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i];
    const nextChapter = chapters[i + 1];
    const endTime = nextChapter ? nextChapter.startTime : videoDuration;

    segments.push({
      tStartSec: Math.floor(chapter.startTime),
      tEndSec: Math.ceil(endTime),
      textChunk: `Chapter: ${chapter.title}`,
      textChunkHash: hashText(chapter.title),
    });
  }

  return segments;
}

/**
 * Create evenly-spaced segments when no transcript/chapters available
 * Last resort fallback
 */
export function createUniformSegments(
  videoDuration: number,
  segmentDuration: number = 45
): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  let currentStart = 0;

  while (currentStart < videoDuration) {
    const currentEnd = Math.min(currentStart + segmentDuration, videoDuration);
    
    segments.push({
      tStartSec: Math.floor(currentStart),
      tEndSec: Math.ceil(currentEnd),
      textChunk: `Segment at ${formatTime(currentStart)} - ${formatTime(currentEnd)}`,
      textChunkHash: hashText(`${currentStart}-${currentEnd}`),
    });

    currentStart = currentEnd;
  }

  return segments;
}

/**
 * Format seconds to MM:SS
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
