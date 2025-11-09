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
    const response = await youtube.captions.list({
      auth: oauth2Client,
      part: ['snippet'],
      videoId: videoId,
    });

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
    const response = await youtube.captions.download({
      auth: oauth2Client,
      id: captionId,
      tfmt: format, // 'srt' or 'vtt'
    });

    console.log('[Captions] Download response type:', typeof response.data);
    console.log('[Captions] Download response preview:', typeof response.data === 'string' ? response.data.substring(0, 200) : JSON.stringify(response.data).substring(0, 200));

    if (typeof response.data === 'string') {
      console.log('[Captions] Returning string content, length:', response.data.length);
      return response.data;
    }

    // Handle Blob responses (common for YouTube captions API)
    if (response.data instanceof Blob) {
      console.log('[Captions] Converting Blob to text, size:', response.data.size);
      const textContent = await response.data.text();
      console.log('[Captions] Blob converted to text, length:', textContent.length);
      console.log('[Captions] Text content preview:', textContent.substring(0, 200));
      return textContent;
    }

    // Handle Blob-like objects that have a text() method
    if (response.data && typeof response.data === 'object' && typeof (response.data as any).text === 'function') {
      console.log('[Captions] Converting Blob-like object with text() method');
      try {
        const textContent = await (response.data as any).text();
        console.log('[Captions] Blob-like object converted to text, length:', textContent.length);
        console.log('[Captions] Text content preview:', textContent.substring(0, 200));
        return textContent;
      } catch (e) {
        console.log('[Captions] text() method failed, trying arrayBuffer');
        // Try arrayBuffer as fallback
        if (typeof (response.data as any).arrayBuffer === 'function') {
          try {
            const arrayBuffer = await (response.data as any).arrayBuffer();
            const textContent = Buffer.from(arrayBuffer).toString('utf8');
            console.log('[Captions] arrayBuffer converted to text, length:', textContent.length);
            console.log('[Captions] Text content preview:', textContent.substring(0, 200));
            return textContent;
          } catch (e2) {
            console.log('[Captions] arrayBuffer method also failed');
          }
        }
      }
    }

    // Handle Buffer responses (Node.js environment)
    if (Buffer.isBuffer(response.data)) {
      console.log('[Captions] Converting Buffer to text, size:', response.data.length);
      const textContent = response.data.toString('utf8');
      console.log('[Captions] Buffer converted to text, length:', textContent.length);
      console.log('[Captions] Text content preview:', textContent.substring(0, 200));
      return textContent;
    }

    // Handle objects that look like Blobs (have buffer property)
    if (response.data && typeof response.data === 'object' && (response.data as any).buffer) {
      console.log('[Captions] Converting buffer-like object to text, size:', (response.data as any).buffer.length);
      const textContent = Buffer.from((response.data as any).buffer).toString('utf8');
      console.log('[Captions] Buffer-like object converted to text, length:', textContent.length);
      console.log('[Captions] Text content preview:', textContent.substring(0, 200));
      return textContent;
    }

    // Handle objects that have [Symbol(buffer)] property (Node.js Blob-like objects)
    if (response.data && typeof response.data === 'object') {
      // Try to find buffer data in symbol properties
      const symbols = Object.getOwnPropertySymbols(response.data);
      for (const symbol of symbols) {
        if (symbol.toString().includes('buffer') && (response.data as any)[symbol]) {
          console.log('[Captions] Found buffer in symbol property:', symbol.toString());
          const buffer = (response.data as any)[symbol];
          const textContent = Buffer.from(buffer).toString('utf8');
          console.log('[Captions] Symbol buffer converted to text, length:', textContent.length);
          console.log('[Captions] Text content preview:', textContent.substring(0, 200));
          return textContent;
        }
      }

      // If it looks like a Blob but instanceof failed, try direct buffer access
      if ((response.data as any).constructor && (response.data as any).constructor.name === 'Blob') {
        console.log('[Captions] Object looks like Blob but instanceof failed, trying direct buffer access');
        // Try to access [Symbol(buffer)] directly
        const bufferSymbol = Symbol('buffer');
        if ((response.data as any)[bufferSymbol]) {
          const buffer = (response.data as any)[bufferSymbol];
          const textContent = Buffer.from(buffer).toString('utf8');
          console.log('[Captions] Direct symbol buffer access worked, length:', textContent.length);
          console.log('[Captions] Text content preview:', textContent.substring(0, 200));
          return textContent;
        }
      }
    }

    // Handle objects with _buffer property (alternative Blob structure)
    if (response.data && typeof response.data === 'object' && (response.data as any)._buffer) {
      console.log('[Captions] Converting _buffer object to text');
      const buffer = (response.data as any)._buffer;
      const textContent = Buffer.from(buffer).toString('utf8');
      console.log('[Captions] _buffer object converted to text, length:', textContent.length);
      console.log('[Captions] Text content preview:', textContent.substring(0, 200));
      return textContent;
    }

    // Debug: log available methods and properties
    if (response.data && typeof response.data === 'object') {
      console.log('[Captions] Object methods:', Object.getOwnPropertyNames(response.data));
      console.log('[Captions] Object symbols:', Object.getOwnPropertySymbols(response.data).map(s => s.toString()));
      console.log('[Captions] Constructor name:', (response.data as any).constructor?.name);
      console.log('[Captions] Has text method:', typeof (response.data as any).text === 'function');
      console.log('[Captions] Has arrayBuffer method:', typeof (response.data as any).arrayBuffer === 'function');
    }

    // If we can't handle the response format, throw an error
    console.error('[Captions] Unsupported response data type:', response.data);
    throw new Error('Unable to process caption download response - unsupported data format');
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

