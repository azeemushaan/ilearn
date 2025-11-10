import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens, listUserChannels } from '@/lib/youtube/oauth';
import { adminFirestore } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import { invalidateUserOwnershipCache } from '@/lib/youtube/ownership';

/**
 * Handle YouTube OAuth callback
 * GET /api/youtube/auth/callback?code=...&state=...
 */
export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');

    if (!code) {
      console.log('[YouTube Auth] Authorization code missing');
      const redirectUrl = new URL('/dashboard/youtube', request.url);
      redirectUrl.searchParams.set('youtube_error', 'true');
      return NextResponse.redirect(redirectUrl);
    }

    // Parse state to get user ID
    let userId: string;
    let coachId: string | undefined;
    
    try {
      const stateData = JSON.parse(state || '{}');
      userId = stateData.userId;
      coachId = stateData.coachId;
    } catch (error) {
      console.log('[YouTube Auth] Invalid state parameter:', error);
      const redirectUrl = new URL('/dashboard/youtube', request.url);
      redirectUrl.searchParams.set('youtube_error', 'true');
      return NextResponse.redirect(redirectUrl);
    }

    if (!userId) {
      console.log('[YouTube Auth] User ID missing from state');
      const redirectUrl = new URL('/dashboard/youtube', request.url);
      redirectUrl.searchParams.set('youtube_error', 'true');
      return NextResponse.redirect(redirectUrl);
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    // List user's channels
    const channels = await listUserChannels(tokens.accessToken);

    if (channels.length === 0) {
      console.log('[YouTube Auth] No channels found for user');
      // Redirect back with error
      const redirectUrl = new URL('/dashboard/youtube', request.url);
      redirectUrl.searchParams.set('youtube_error', 'true');
      return NextResponse.redirect(redirectUrl);
    }

    // Store connection in Firestore
    const db = adminFirestore();
    const connectionRef = db.collection('youtube_connections').doc(userId);

    await connectionRef.set({
      userId,
      coachId: coachId || null,
      channels: channels.map(ch => ({
        channelId: ch.channelId,
        title: ch.title,
        thumbnailUrl: ch.thumbnailUrl || null,
        connectedAt: Timestamp.now(),
      })),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: Timestamp.fromDate(tokens.expiresAt),
      scopes: tokens.scopes,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    // Invalidate any existing ownership cache since channels may have changed
    await invalidateUserOwnershipCache(userId);

    console.log('[YouTube Auth] Connection successful:', {
      userId,
      channelCount: channels.length,
      channels: channels.map(ch => ({ id: ch.channelId, title: ch.title })),
    });

    // Redirect back to YouTube connection page with success message
    const redirectUrl = new URL('/dashboard/youtube', request.url);
    redirectUrl.searchParams.set('youtube_connected', 'true');
    redirectUrl.searchParams.set('channel_count', channels.length.toString());

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('[YouTube Auth] OAuth callback failed:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    // Redirect to YouTube page with generic error (don't expose details in URL)
    const redirectUrl = new URL('/dashboard/youtube', request.url);
    redirectUrl.searchParams.set('youtube_error', 'true');
    // Don't include error_message in URL for security

    return NextResponse.redirect(redirectUrl);
  }
}

