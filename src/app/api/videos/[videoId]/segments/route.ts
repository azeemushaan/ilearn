// src/app/api/videos/[videoId]/segments/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminFirestore } from '@/lib/firebase/admin';
import { getVideoSegments } from '@/services/mcq-repo';

type RouteParams = { videoId: string };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    // Authenticate user
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    await adminAuth().verifyIdToken(token);

    const { videoId } = await params;

    const segments = await getVideoSegments(videoId);

    return NextResponse.json({
      videoId,
      segments,
    });
  } catch (error: any) {
    console.error('[API] Get video segments error:', error);
    return NextResponse.json(
      { error: 'Failed to get segments', message: error.message },
      { status: 500 }
    );
  }
}
