import { NextRequest, NextResponse } from 'next/server';
import { getCreditBalance } from '@/lib/credits/manager';

/**
 * Get current credit balance
 * GET /api/credits/balance?coachId=...
 */
export async function GET(request: NextRequest) {
  try {
    const coachId = request.nextUrl.searchParams.get('coachId');

    if (!coachId) {
      return NextResponse.json(
        { error: 'Coach ID required' },
        { status: 400 }
      );
    }

    const balance = await getCreditBalance(coachId);

    return NextResponse.json(balance);
  } catch (error) {
    console.error('[Credits Balance] Failed:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch credit balance',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

