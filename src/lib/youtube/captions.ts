/**
 * YouTube Captions API Helpers
 * Handles fetching caption tracks and downloading caption content
 */

import { google } from 'googleapis';
import { getOAuth2Client } from './oauth';

const youtube = google.youtube('v3');

export interface CaptionTrack {
  id: string;
  language: string;
  name: string;
  isAutomatic: boolean;
}

export interface CaptionContent {
  language: string;
  content: string; // SRT or VTT format
  format: 'srt' | 'vtt';
}

/**
 * List available caption tracks for a video
 */
export async function listCaptionTracks(
  videoId: string,
  accessToken: string
): Promise<CaptionTrack[]> {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });

  try {
    console.log('[Captions] Listing tracks for video:', videoId);
    const response = await withRetry('captions.list', () =>
      youtube.captions.list({
        auth: oauth2Client,
        part: ['snippet'],
        videoId,
      })
    );

    console.log('[Captions] List response:', {
      success: true,
      itemsCount: response.data.items?.length,
    });

    if (!response.data.items || response.data.items.length === 0) {
      console.log('[Captions] No caption tracks found for video:', videoId);
      return [];
    }

    const tracks = response.data.items.map(caption => ({
      id: caption.id!,
      language: caption.snippet?.language || 'unknown',
      name: caption.snippet?.name || '',
      isAutomatic: caption.snippet?.trackKind === 'ASR',
    }));

    console.log('[Captions] Found tracks:', tracks);
    return tracks;
  } catch (error) {
    console.error('[Captions] Failed to list tracks:', error);
    const errorDetails = error as any;
    console.error('[Captions] Error details:', {
      message: errorDetails?.message,
      status: errorDetails?.status,
      code: errorDetails?.code,
    });
    throw new Error(`Failed to fetch caption tracks from YouTube: ${errorDetails?.message || 'Unknown error'}`);
  }
}

/**
 * Download caption content
 */
export async function downloadCaptionContent(
  captionId: string,
  accessToken: string,
  format: 'srt' | 'vtt' = 'srt'
): Promise<string> {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });

  try {
    console.log('[Captions] Downloading caption:', { captionId, format });
    const response = await withRetry('captions.download', () =>
      youtube.captions.download(
        {
          auth: oauth2Client,
          id: captionId,
          tfmt: format,
        },
        { responseType: 'arraybuffer' }
      )
    );

    const textContent = await toText(response.data);
    console.log('[Captions] Downloaded captions length:', textContent.length);
    return textContent;
  } catch (error) {
    console.error('[Captions] Failed to download:', error);
    const errorDetails = error as any;
    console.error('[Captions] Download error details:', {
      message: errorDetails?.message,
      status: errorDetails?.status,
      code: errorDetails?.code,
      response: errorDetails?.response?.data,
    });
    throw new Error(`Failed to download caption content from YouTube: ${errorDetails?.message || 'Unknown error'}`);
  }
}

/**
 * Get caption content for a video in specified language
 */
export async function getCaptionContentByLanguage(
  videoId: string,
  accessToken: string,
  preferredLanguage: string = 'en',
  format: 'srt' | 'vtt' = 'srt'
): Promise<CaptionContent> {
  // List available tracks
  const tracks = await listCaptionTracks(videoId, accessToken);

  if (tracks.length === 0) {
    throw new Error('No caption tracks available for this video');
  }

  // Try to find preferred language (non-automatic first)
  let selectedTrack = tracks.find(
    track => track.language === preferredLanguage && !track.isAutomatic
  );

  // If not found, try automatic captions in preferred language
  if (!selectedTrack) {
    selectedTrack = tracks.find(
      track => track.language === preferredLanguage && track.isAutomatic
    );
  }

  // If still not found, try first non-automatic track
  if (!selectedTrack) {
    selectedTrack = tracks.find(track => !track.isAutomatic);
  }

  // If still not found, use first available track
  if (!selectedTrack) {
    selectedTrack = tracks[0];
  }

  // Download the selected track
  const content = await downloadCaptionContent(selectedTrack.id, accessToken, format);

  return {
    language: selectedTrack.language,
    content,
    format,
  };
}

/**
 * Check if video has captions available
 */
export async function hasAvailableCaptions(
  videoId: string,
  accessToken: string
): Promise<boolean> {
  try {
    const tracks = await listCaptionTracks(videoId, accessToken);
    return tracks.length > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Get human-readable caption track summary
 */
export async function getCaptionTrackSummary(
  videoId: string,
  accessToken: string
): Promise<{
  hasEnglish: boolean;
  totalTracks: number;
  languages: string[];
  humanGenerated: number;
  autoGenerated: number;
}> {
  try {
    const tracks = await listCaptionTracks(videoId, accessToken);

    const languages = [...new Set(tracks.map(t => t.language))];
    const hasEnglish = languages.includes('en');
    const humanGenerated = tracks.filter(t => !t.isAutomatic).length;
    const autoGenerated = tracks.filter(t => t.isAutomatic).length;

    return {
      hasEnglish,
      totalTracks: tracks.length,
      languages,
      humanGenerated,
      autoGenerated,
    };
  } catch (error) {
    return {
      hasEnglish: false,
      totalTracks: 0,
      languages: [],
      humanGenerated: 0,
      autoGenerated: 0,
    };
  }
}
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const shouldRetry = (error: any) => {
  const status = error?.code || error?.response?.status;
  return status === 429 || status === 500 || status === 503;
};

async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!shouldRetry(error) || attempt === attempts) {
        break;
      }
      const backoff = attempt * 500;
      console.warn(`[Captions] ${label} retry ${attempt}/${attempts}`, { backoff });
      await sleep(backoff);
    }
  }
  throw lastError;
}

const toText = async (payload: any): Promise<string> => {
  if (!payload) return '';
  if (typeof payload === 'string') return payload;
  if (payload instanceof Buffer) return payload.toString('utf8');
  if (payload instanceof ArrayBuffer) return Buffer.from(payload).toString('utf8');
  if (typeof payload.arrayBuffer === 'function') {
    const buffer = await payload.arrayBuffer();
    return Buffer.from(buffer).toString('utf8');
  }
  if (typeof payload.text === 'function') {
    return payload.text();
  }
  if (payload?.buffer) {
    return Buffer.from(payload.buffer).toString('utf8');
  }
  return JSON.stringify(payload);
};
