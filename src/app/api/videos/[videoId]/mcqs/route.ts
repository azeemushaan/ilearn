// src/app/api/videos/[videoId]/mcqs/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';
import { listVideoMCQs } from '@/services/mcq-repo';
import type { API_ListVideoMCQs } from '@/api/contracts';

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
    try {
      await adminAuth().verifyIdToken(token);
    } catch (error) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { videoId } = await params;

    // Get latest MCQs for video
    const mcqs = await listVideoMCQs(videoId);

    const response: API_ListVideoMCQs.Res = {
      videoId,
      items: mcqs.map(mcq => ({
        mcqId: mcq.mcqId,
        version: mcq.version,
        state: mcq.state,
        segmentId: mcq.segmentId,
        stem: mcq.stem,
        options: mcq.options,
        correctIndex: mcq.correctIndex,
        language: mcq.language,
        updatedAt: mcq.updatedAt,
      })),
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[API] List video MCQs error:', error);
    return NextResponse.json(
      { error: 'Failed to list MCQs', message: error.message },
      { status: 500 }
    );
  }
}
