// src/app/api/mcqs/[mcqId]/unpublish/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';
import { getAttemptsCount, unpublishMCQ } from '@/services/mcq-repo';
import type { API_UnpublishMCQ } from '@/api/contracts';

type RouteParams = { mcqId: string };

export async function POST(
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
    const decodedToken = await adminAuth().verifyIdToken(token);
    const userId = decodedToken.uid;

    const { mcqId } = await params;
    const body: API_UnpublishMCQ.Body = await request.json();

    // Check if there are attempts
    const attempts = await getAttemptsCount(mcqId, body.version);
    if (attempts > 0) {
      return NextResponse.json(
        { error: 'Cannot unpublish MCQ with existing attempts' },
        { status: 400 }
      );
    }

    await unpublishMCQ(mcqId, body.version, userId);

    const response: API_UnpublishMCQ.Res = { state: "draft" };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[API] Unpublish MCQ error:', error);
    return NextResponse.json(
      { error: 'Failed to unpublish MCQ', message: error.message },
      { status: 500 }
    );
  }
}
