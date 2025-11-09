import { adminFirestore } from '@/lib/firebase/admin';
import { videoManifestSchema, type VideoManifest } from '@/lib/schemas';

const scrubSegment = (raw: any, segmentId: string) => {
  const tStartSec = typeof raw?.tStartSec === 'number' ? raw.tStartSec : 0;
  const tEndSec = typeof raw?.tEndSec === 'number' ? raw.tEndSec : 0;
  if (!Number.isFinite(tStartSec) || !Number.isFinite(tEndSec) || tEndSec <= tStartSec) {
    return null;
  }

  return {
    segmentId,
    segmentIndex: raw?.segmentIndex ?? 0,
    tStartSec,
    tEndSec,
    durationSec: raw?.durationSec || Math.max(0, tEndSec - tStartSec),
    difficulty: raw?.difficulty,
  };
};

export async function buildVideoManifest(videoId: string, videoData: any): Promise<VideoManifest> {
  const db = adminFirestore();
  const segmentsSnapshot = await db
    .collection(`videos/${videoId}/segments`)
    .orderBy('tStartSec')
    .get();

  const segments: VideoManifest['segments'] = [];
  let totalQuestions = 0;
  let latestEnd = 0;

  for (const segmentDoc of segmentsSnapshot.docs) {
    const cleaned = scrubSegment(segmentDoc.data(), segmentDoc.id);
    if (!cleaned) {
      continue;
    }

    const questionsSnapshot = await db
      .collection(`videos/${videoId}/segments/${segmentDoc.id}/questions`)
      .get();
    const questionIds = questionsSnapshot.docs.map(question => question.id);
    totalQuestions += questionIds.length;

    segments.push({
      ...cleaned,
      questionIds,
    });
    latestEnd = Math.max(latestEnd, cleaned.tEndSec);
  }

  const manifest = {
    videoId,
    youtubeVideoId: videoData.youtubeVideoId,
    title: videoData.title,
    duration: Number.isFinite(videoData.duration) && (videoData.duration ?? 0) > 0 ? videoData.duration : Math.round(latestEnd),
    status: videoData.status,
    hasCaptions: videoData.hasCaptions || false,
    chaptersOnly: videoData.chaptersOnly || false,
    segments,
    totalSegments: segments.length,
    totalQuestions,
    generatedAt: new Date().toISOString(),
    version: '1.0',
  } satisfies VideoManifest;

  return videoManifestSchema.parse(manifest);
}
