// src/app/api/mcqs/[mcqId]/history/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';
import { getMCQHistory } from '@/services/mcq-repo';
import type { API_HistoryMCQ } from '@/api/contracts';

type RouteParams = { mcqId: string };

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

    const { mcqId } = await params;

    const items = await getMCQHistory(mcqId);

    const response: API_HistoryMCQ.Res = { items };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[API] MCQ history error:', error);
    return NextResponse.json(
      { error: 'Failed to get MCQ history', message: error.message },
      { status: 500 }
    );
  }
}
