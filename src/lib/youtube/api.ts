/**
 * YouTube Data API v3 Integration
 * Handles playlist and video metadata fetching
 */

export interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  duration: number; // in seconds
  thumbnailUrl: string;
  channelId: string;
  channelTitle: string;
}

export interface YouTubePlaylist {
  id: string;
  title: string;
  description: string;
  channelId: string;
  channelTitle: string;
  thumbnailUrl: string;
  itemCount: number;
}

export interface YouTubeCaption {
  language: string;
  trackKind: string;
  content: string; // SRT or VTT format
}

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

/**
 * Parse ISO 8601 duration to seconds
 */
function parseDuration(isoDuration: string): number {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Fetch playlist metadata from YouTube
 */
export async function fetchPlaylistMetadata(playlistId: string): Promise<YouTubePlaylist> {
  if (!YOUTUBE_API_KEY) {
    throw new Error('YouTube API key not configured');
  }

  const url = `${YOUTUBE_API_BASE}/playlists?part=snippet,contentDetails&id=${playlistId}&key=${YOUTUBE_API_KEY}`;
  
  const response: Response = await fetch(url);
  if (!response.ok) {
    throw new Error(`YouTube API error: ${response.statusText}`);
  }

  const data = await response.json();
  
  if (!data.items || data.items.length === 0) {
    throw new Error('Playlist not found');
  }

  const item = data.items[0];
  
  return {
    id: item.id,
    title: item.snippet.title,
    description: item.snippet.description || '',
    channelId: item.snippet.channelId,
    channelTitle: item.snippet.channelTitle,
    thumbnailUrl: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '',
    itemCount: item.contentDetails.itemCount || 0,
  };
}

/**
 * Fetch all videos from a playlist
 */
export async function fetchPlaylistVideos(playlistId: string): Promise<string[]> {
  if (!YOUTUBE_API_KEY) {
    throw new Error('YouTube API key not configured');
  }

  const videoIds: string[] = [];
  let nextPageToken: string | null = null;

  do {
    const url = `${YOUTUBE_API_BASE}/playlistItems?part=contentDetails&playlistId=${playlistId}&maxResults=50${nextPageToken ? `&pageToken=${nextPageToken}` : ''}&key=${YOUTUBE_API_KEY}`;
    
    const response: Response = await fetch(url);
    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.items) {
      videoIds.push(...data.items.map((item: any) => item.contentDetails.videoId));
    }

    nextPageToken = data.nextPageToken || null;
  } while (nextPageToken);

  return videoIds;
}

/**
 * Fetch video metadata (supports batch up to 50 videos)
 */
export async function fetchVideosMetadata(videoIds: string[]): Promise<YouTubeVideo[]> {
  if (!YOUTUBE_API_KEY) {
    throw new Error('YouTube API key not configured');
  }

  if (videoIds.length === 0) {
    return [];
  }

  const videos: YouTubeVideo[] = [];
  
  // Process in batches of 50 (YouTube API limit)
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const url = `${YOUTUBE_API_BASE}/videos?part=snippet,contentDetails&id=${batch.join(',')}&key=${YOUTUBE_API_KEY}`;
    
    const response: Response = await fetch(url);
    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.items) {
      videos.push(...data.items.map((item: any) => ({
        id: item.id,
        title: item.snippet.title,
        description: item.snippet.description || '',
        duration: parseDuration(item.contentDetails.duration),
        thumbnailUrl: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '',
        channelId: item.snippet.channelId,
        channelTitle: item.snippet.channelTitle,
      })));
    }
  }

  return videos;
}

/**
 * Fetch captions for a video (requires OAuth - not public API)
 * This is a placeholder - actual implementation requires OAuth flow
 */
export async function fetchVideoCaptions(videoId: string, accessToken?: string): Promise<YouTubeCaption | null> {
  // Note: YouTube Captions API requires OAuth and channel ownership
  // For now, we'll return null and rely on teacher-uploaded SRT files
  // or use chaptersOnly mode
  
  if (!accessToken) {
    return null;
  }

  // TODO: Implement OAuth-based caption fetching
  // const url = `${YOUTUBE_API_BASE}/captions?videoId=${videoId}&part=snippet`;
  
  return null;
}

/**
 * Extract playlist ID from various YouTube URL formats
 */
export function extractPlaylistId(url: string): string | null {
  const patterns = [
    /[?&]list=([^&]+)/,
    /youtube\.com\/playlist\?list=([^&]+)/,
    /youtube\.com\/.*[?&]list=([^&]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * Extract video ID from YouTube URL
 */
export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/,
    /youtube\.com\/embed\/([^?]+)/,
    /youtube\.com\/v\/([^?]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}
