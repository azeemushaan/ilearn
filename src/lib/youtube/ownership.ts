/**
 * YouTube Video Ownership Verification
 * Handles ownership checks and caching for video processing
 */

import { google } from 'googleapis';
import { adminFirestore } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import { getOAuth2Client } from './oauth';

const youtube = google.youtube('v3');

export interface OwnershipResult {
  videoId: string;
  owned: boolean;
  channelId?: string;
  cached: boolean;
  verifiedAt: Date;
}

export interface BatchOwnershipResult {
  owned: string[];
  notOwned: string[];
  unknown: string[];
  results: Map<string, OwnershipResult>;
}

/**
 * Check if a video is owned by the authenticated channel
 */
export async function verifyVideoOwnership(
  videoId: string,
  accessToken: string,
  userId: string
): Promise<OwnershipResult> {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });

  try {
    // Get video details to find channel ID
    const videoResponse = await youtube.videos.list({
      auth: oauth2Client,
      part: ['snippet', 'status'],
      id: [videoId],
    });

    if (!videoResponse.data.items || videoResponse.data.items.length === 0) {
      console.log('[Ownership] Video not found or no access:', { videoId });
      return {
        videoId,
        owned: false,
        cached: false,
        verifiedAt: new Date(),
      };
    }

    const videoData = videoResponse.data.items[0];
    const videoChannelId = videoData.snippet?.channelId;

    console.log('[Ownership] Video details:', {
      videoId,
      title: videoData.snippet?.title,
      channelId: videoChannelId,
      privacyStatus: videoData.status?.privacyStatus,
      madeForKids: videoData.status?.madeForKids,
      channelTitle: videoData.snippet?.channelTitle,
    });

    if (!videoChannelId) {
      return {
        videoId,
        owned: false,
        cached: false,
        verifiedAt: new Date(),
      };
    }

    // Check channels the user owns OR manages
    const channelsResponse = await youtube.channels.list({
      auth: oauth2Client,
      part: ['id'],
      mine: true, // This returns channels the user owns
    });

    let userChannelIds = channelsResponse.data.items?.map(ch => ch.id) || [];

    // Also check for channels the user manages (but might not own)
    try {
      const managedChannelsResponse = await youtube.channels.list({
        auth: oauth2Client,
        part: ['id'],
        managedByMe: true, // This returns channels the user manages
      });

      const managedChannelIds = managedChannelsResponse.data.items?.map(ch => ch.id) || [];
      // Combine owned and managed channels
      userChannelIds = [...new Set([...userChannelIds, ...managedChannelIds])];
    } catch (managedError) {
      console.log('[Ownership] Could not fetch managed channels:', managedError);
      // Continue with just owned channels
    }

    const channelOwned = Boolean(videoChannelId && userChannelIds.includes(videoChannelId));
    const hasAccess = true; // We successfully fetched video data, so user has access
    const owned = channelOwned; // For backwards compatibility

    console.log('[Ownership] Channel verification:', {
      videoId,
      videoChannelId,
      userChannelIds,
      channelOwned,
      hasDirectAccess: hasAccess,
      owned,
      totalUserChannels: userChannelIds.length,
      privacyStatus: videoData.status?.privacyStatus,
    });

    const result: OwnershipResult = {
      videoId,
      owned,
      channelId: videoChannelId,
      cached: false,
      verifiedAt: new Date(),
    };

    // Cache the result
    await cacheOwnershipResult(videoId, result, userId);

    return result;
  } catch (error) {
    console.error('[Ownership] Verification failed:', error);
    const fallback: OwnershipResult = {
      videoId,
      owned: false,
      cached: false,
      verifiedAt: new Date(),
    };
    try {
      await cacheOwnershipResult(videoId, fallback, userId);
    } catch (cacheError) {
      console.warn('[Ownership] Failed to cache fallback result', cacheError);
    }
    return fallback;
  }
}

/**
 * Cache ownership result in Firestore
 */
export async function cacheOwnershipResult(
  videoId: string,
  result: OwnershipResult,
  userId: string
): Promise<void> {
  const db = adminFirestore();
  
  const cacheRef = db.collection('ownership_cache').doc(videoId);
  
  await cacheRef.set({
    videoId,
    channelId: result.channelId || null,
    owned: result.owned,
    verifiedAt: Timestamp.fromDate(result.verifiedAt),
    userId,
    ttlHours: 24,
  });
}

/**
 * Get cached ownership result
 */
export async function getCachedOwnership(videoId: string): Promise<OwnershipResult | null> {
  const db = adminFirestore();
  
  const cacheRef = db.collection('ownership_cache').doc(videoId);
  const cacheDoc = await cacheRef.get();

  if (!cacheDoc.exists) {
    return null;
  }

  const data = cacheDoc.data()!;
  const verifiedAt = data.verifiedAt?.toDate() || new Date();
  const ttlHours = data.ttlHours || 24;
  
  // Check if cache is still valid
  const now = new Date();
  const cacheAge = now.getTime() - verifiedAt.getTime();
  const maxAge = ttlHours * 60 * 60 * 1000;

  if (cacheAge > maxAge) {
    // Cache expired
    return null;
  }

  return {
    videoId: data.videoId,
    owned: data.owned,
    channelId: data.channelId || undefined,
    cached: true,
    verifiedAt,
  };
}

/**
 * Batch ownership preflight for multiple videos
 */
export async function batchOwnershipPreflight(
  videoIds: string[],
  accessToken: string,
  userId: string
): Promise<BatchOwnershipResult> {
  const owned: string[] = [];
  const notOwned: string[] = [];
  const unknown: string[] = [];
  const results = new Map<string, OwnershipResult>();

  // Process in parallel batches of 10
  const batchSize = 10;
  for (let i = 0; i < videoIds.length; i += batchSize) {
    const batch = videoIds.slice(i, i + batchSize);
    
    const batchResults = await Promise.all(
      batch.map(async (videoId) => {
        // Check cache first
        const cached = await getCachedOwnership(videoId);
        if (cached) {
          return cached;
        }

        // Verify with YouTube API
        return await verifyVideoOwnership(videoId, accessToken, userId);
      })
    );

    // Categorize results
    batchResults.forEach((result) => {
      results.set(result.videoId, result);
      
      if (result.owned) {
        owned.push(result.videoId);
      } else if (result.channelId) {
        notOwned.push(result.videoId);
      } else {
        unknown.push(result.videoId);
      }
    });
  }

  return {
    owned,
    notOwned,
    unknown,
    results,
  };
}

/**
 * Invalidate ownership cache for a video
 */
export async function invalidateOwnershipCache(videoId: string): Promise<void> {
  const db = adminFirestore();
  const cacheRef = db.collection('ownership_cache').doc(videoId);
  await cacheRef.delete();
}

/**
 * Invalidate all ownership cache for a user
 */
export async function invalidateUserOwnershipCache(userId: string): Promise<void> {
  const db = adminFirestore();
  
  const snapshot = await db.collection('ownership_cache')
    .where('userId', '==', userId)
    .get();

  const batch = db.batch();
  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });

  await batch.commit();
}
