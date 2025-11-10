// src/app/api/mcqs/[mcqId]/publish/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';
import { publish } from '@/services/mcq-service';
import type { API_PublishMCQ } from '@/api/contracts';

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
    const body: API_PublishMCQ.Body = await request.json();

    const result = await publish(mcqId, body.version, userId, body.reason);

    const response: API_PublishMCQ.Res = {
      mcq: result.mcq,
      publishedVersion: result.publishedVersion,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[API] Publish MCQ error:', error);
    return NextResponse.json(
      { error: 'Failed to publish MCQ', message: error.message },
      { status: 500 }
    );
  }
}
