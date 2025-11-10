// src/app/api/mcqs/[mcqId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';
import { updateMCQDraft } from '@/services/mcq-service';
import type { API_UpdateMCQ } from '@/api/contracts';

type RouteParams = { mcqId: string };

export async function PUT(
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
    const body: API_UpdateMCQ.Body = await request.json();

    const mcq = await updateMCQDraft(mcqId, body.version, userId, body.patch);

    const response: API_UpdateMCQ.Res = { mcq };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[API] Update MCQ error:', error);
    return NextResponse.json(
      { error: 'Failed to update MCQ', message: error.message },
      { status: 500 }
    );
  }
}
