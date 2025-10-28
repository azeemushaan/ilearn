import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const payload = await request.text();
  console.log('Received card webhook payload', payload);
  return NextResponse.json({ received: true });
}
