import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';

export async function POST(request: NextRequest) {
  try {
    const { uid, claims } = await request.json();

    if (!uid || !claims) {
      return NextResponse.json(
        { error: 'Missing uid or claims' },
        { status: 400 }
      );
    }

    await adminAuth().setCustomUserClaims(uid, claims);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error setting custom claims:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
