import { NextRequest, NextResponse } from 'next/server';
import { addCredits } from '@/lib/credits/manager';

/**
 * Add credits to coach account (admin only)
 * POST /api/admin/credits/add
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { coachId, amount, actorId, reason } = body;

    if (!coachId || !amount || !actorId) {
      return NextResponse.json(
        { error: 'Coach ID, amount, and actor ID required' },
        { status: 400 }
      );
    }

    // TODO: Add admin authentication check
    // const { claims } = await requireAuth(request);
    // if (claims.role !== 'admin') {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    // }

    const result = await addCredits(coachId, amount, actorId, reason);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Admin Credits] Add failed:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to add credits',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

