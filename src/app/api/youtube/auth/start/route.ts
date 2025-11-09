import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizationUrl } from '@/lib/youtube/oauth';

/**
 * Initiate YouTube OAuth flow
 * GET /api/youtube/auth/start
 */
export async function GET(request: NextRequest) {
  try {
    // Get user ID from query params or session
    const userId = request.nextUrl.searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID required' },
        { status: 400 }
      );
    }

    // Generate authorization URL with state
    const state = JSON.stringify({ userId, timestamp: Date.now() });
    const authUrl = getAuthorizationUrl(state);

    return NextResponse.json({
      authUrl,
      success: true,
    });
  } catch (error) {
    console.error('[YouTube Auth] Failed to start OAuth flow:', error);
    return NextResponse.json(
      { 
        error: 'Failed to initialize YouTube authorization',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

