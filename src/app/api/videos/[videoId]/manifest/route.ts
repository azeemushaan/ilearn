import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminFirestore, adminStorage } from '@/lib/firebase/admin';
import { buildVideoManifest } from '@/lib/videos/manifest';
import { videoManifestSchema } from '@/lib/schemas';

type RouteParams = { videoId: string };

let manifestCacheDisabled = false;
let manifestCacheDisabledReason: string | null = null;
let manifestCacheSkipLogged = false;

function toLoggableError(error: unknown) {
  if (error instanceof Error) {
    const data: Record<string, unknown> = {
      name: error.name,
      message: error.message,
    };
    const code = (error as any)?.code ?? (error as any)?.statusCode ?? (error as any)?.status;
    if (code) data.code = code;
    return data;
  }
  return { message: String(error) };
}

function disableManifestCache(reason: string, details?: Record<string, unknown>) {
  if (!manifestCacheDisabled) {
    manifestCacheDisabled = true;
    manifestCacheDisabledReason = reason;
    manifestCacheSkipLogged = false;
    console.warn('[manifest] cache.disabled_permanently', {
      reason,
      details,
    });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    // 1. Get auth token from headers
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    try {
      await adminAuth().verifyIdToken(token);
    } catch (error) {
      console.error('[manifest] token.verify_failed', toLoggableError(error));
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { videoId } = await params;
    const db = adminFirestore();
    const videoRef = db.collection('videos').doc(videoId);
    const videoDoc = await videoRef.get();
    if (!videoDoc.exists) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    const videoData = videoDoc.data()!;

    // Check status before attempting cache usage
    if (videoData.status === 'processing' || videoData.status === 'pending') {
      return NextResponse.json(
        { error: 'Video is still being processed' },
        { status: 409 }
      );
    }

    if (videoData.status === 'error') {
      return NextResponse.json(
        { 
          error: 'Video processing failed',
          message: videoData.errorMessage 
        },
        { status: 409 }
      );
    }
    
    // 2. Check if manifest exists in Cloud Storage
    const storage = adminStorage();
    const bucket = storage.bucket();
    const bucketName = bucket?.name ?? '';
    const storageConfigured = Boolean(bucketName && bucketName !== '[DEFAULT]');
    const manifestPath = `manifests/${videoId}.json`;
    let file = storageConfigured && !manifestCacheDisabled ? bucket.file(manifestPath) : null;

    if (!storageConfigured) {
      disableManifestCache('storage_not_configured', { bucketName });
    } else if (manifestCacheDisabled) {
      if (!manifestCacheSkipLogged) {
        console.warn('[manifest] cache.skip_disabled', {
          videoId,
          bucketName,
          reason: manifestCacheDisabledReason,
        });
        manifestCacheSkipLogged = true;
      }
    }

    if (file) {
      try {
        const [exists] = await file.exists();
        if (exists) {
          const [content] = await file.download();
          const manifest = videoManifestSchema.parse(JSON.parse(content.toString()));
          console.log('[manifest] cache.hit', { videoId, bucket: bucketName, path: manifestPath });
          return NextResponse.json(manifest);
        }
        console.log('[manifest] cache.miss', { videoId, bucket: bucketName, path: manifestPath });
      } catch (storageError) {
        console.warn('[manifest] cache.read_failed', {
          videoId,
          bucket: bucketName,
          path: manifestPath,
          error: toLoggableError(storageError),
        });
        const errorInfo = toLoggableError(storageError);
        if (errorInfo.code === 404 || /bucket does not exist/i.test(String(errorInfo.message ?? ''))) {
          disableManifestCache('storage_bucket_not_found', { bucket: bucketName });
          file = null;
        }
      }
    }

    // 3. Manifest doesn't exist or cache unavailable, generate it
    const manifest = await buildVideoManifest(videoId, videoData);

    // 4. Cache to Cloud Storage when available
    if (file) {
      try {
        await file.save(JSON.stringify(manifest), {
          metadata: {
            contentType: 'application/json',
            metadata: {
              coachId: videoData.coachId || '',
              videoId,
              generatedAt: new Date().toISOString(),
            },
          },
        });
        console.log('[manifest] cache.write_success', {
          videoId,
          bucket: bucketName,
          path: manifestPath,
        });
      } catch (storageError) {
        console.warn('[manifest] cache.write_failed', {
          videoId,
          bucket: bucketName,
          path: manifestPath,
          error: toLoggableError(storageError),
        });
        const errorInfo = toLoggableError(storageError);
        if (errorInfo.code === 404 || /bucket does not exist/i.test(String(errorInfo.message ?? ''))) {
          disableManifestCache('storage_bucket_not_found', { bucket: bucketName });
        }
      }
    }
    
    return NextResponse.json(manifest);
    
  } catch (error: any) {
    console.error('Manifest route error:', error);
    return NextResponse.json(
      { error: 'Failed to load manifest', message: error.message },
      { status: 500 }
    );
  }
}
