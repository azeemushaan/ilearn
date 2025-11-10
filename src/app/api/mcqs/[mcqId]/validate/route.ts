// src/app/api/mcqs/[mcqId]/validate/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';
import { getMCQByIdAndVersion } from '@/services/mcq-repo';
import { validateMCQFull } from '@/services/mcq-service';
import type { API_ValidateMCQ } from '@/api/contracts';

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
    await adminAuth().verifyIdToken(token);

    const { mcqId } = await params;
    const body: API_ValidateMCQ.Body = await request.json();

    const mcq = await getMCQByIdAndVersion(mcqId, body.version);
    if (!mcq) {
      return NextResponse.json({ error: 'MCQ not found' }, { status: 404 });
    }

    const validation = await validateMCQFull(mcq);

    const response: API_ValidateMCQ.Res = {
      ok: validation.ok,
      errors: validation.errors,
      warnings: validation.warnings,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[API] Validate MCQ error:', error);
    return NextResponse.json(
      { error: 'Failed to validate MCQ', message: error.message },
      { status: 500 }
    );
  }
}
