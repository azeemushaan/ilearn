// src/app/api/videos/[videoId]/segments/[segmentId]/mcq/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';
import { getLatestMCQForSegment, getMCQByIdAndVersion, getSegment, getAttemptsCount } from '@/services/mcq-repo';
import { createOrForkMCQ } from '@/services/mcq-service';
import type { API_GetSegmentMCQ, API_CreateOrForkMCQ } from '@/api/contracts';

type RouteParams = { videoId: string; segmentId: string };

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
    const decodedToken = await adminAuth().verifyIdToken(token);
    const userId = decodedToken.uid;

    const { videoId, segmentId } = await params;
    const url = new URL(request.url);
    const versionParam = url.searchParams.get('version');

    let mcq = null;
    if (versionParam) {
      const version = parseInt(versionParam, 10);
      if (isNaN(version)) {
        return NextResponse.json({ error: 'Invalid version parameter' }, { status: 400 });
      }
      // Find MCQ by segmentId (we need to get mcqId first)
      const latestMcq = await getLatestMCQForSegment(segmentId);
      if (latestMcq) {
        mcq = await getMCQByIdAndVersion(latestMcq.mcqId, version);
      }
    } else {
      mcq = await getLatestMCQForSegment(segmentId);
    }

    const segment = await getSegment(segmentId);
    if (!segment) {
      return NextResponse.json({ error: 'Segment not found' }, { status: 404 });
    }

    const attemptsCount = mcq ? await getAttemptsCount(mcq.mcqId, mcq.version) : 0;

    const response: API_GetSegmentMCQ.Res = {
      mcq: mcq || undefined,
      segment,
      attemptsCount,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[API] Get segment MCQ error:', error);
    return NextResponse.json(
      { error: 'Failed to get MCQ', message: error.message },
      { status: 500 }
    );
  }
}

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

    const { videoId, segmentId } = await params;
    const body: API_CreateOrForkMCQ.Body = await request.json();

    const mcq = await createOrForkMCQ(
      segmentId,
      videoId,
      userId,
      body.payload,
      body.baseMcqId,
      body.fromVersion
    );

    const response: API_CreateOrForkMCQ.Res = { mcq };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[API] Create segment MCQ error:', error);
    return NextResponse.json(
      { error: 'Failed to create MCQ', message: error.message },
      { status: 500 }
    );
  }
}
