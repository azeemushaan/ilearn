import { adminFirestore } from '@/lib/firebase/admin';
import { videoManifestSchema, type VideoManifest, type ManifestSegment } from '@/lib/schemas';

const scrubSegment = (raw: any, segmentId: string) => {
  const tStartSec = typeof raw?.tStartSec === 'number' ? raw.tStartSec : 0;
  const tEndSec = typeof raw?.tEndSec === 'number' ? raw.tEndSec : 0;
  if (!Number.isFinite(tStartSec) || !Number.isFinite(tEndSec) || tEndSec <= tStartSec) {
    return null;
  }

  return {
    segmentId,
    segmentIndex: raw?.segmentIndex ?? 0,
    title: raw?.title || `Segment ${raw?.segmentIndex + 1 ?? ''}`,
    language: raw?.language || 'en',
    tStartSec,
    tEndSec,
    durationSec: raw?.durationSec || Math.max(0, tEndSec - tStartSec),
    textChunk: raw?.textChunk,
  };
};

export async function buildVideoManifest(videoId: string, videoData: any): Promise<VideoManifest> {
  const db = adminFirestore();
  const segmentsSnapshot = await db
    .collection(`videos/${videoId}/segments`)
    .orderBy('tStartSec')
    .get();

  const segments: ManifestSegment[] = [];
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

    const questions = questionsSnapshot.docs.map(questionDoc => {
      const data = questionDoc.data();
      return {
        questionId: questionDoc.id,
        stem: data.stem,
        options: Array.isArray(data.options)
          ? [data.options[0] ?? '', data.options[1] ?? '', data.options[2] ?? '', data.options[3] ?? '']
          : ['', '', '', ''],
        correctIndex: typeof data.correctIndex === 'number' ? data.correctIndex : 0,
        rationale: data.rationale,
        support: Array.isArray(data.support)
          ? data.support
              .map((supportItem: any) => ({
                tStartSec: Number(supportItem?.tStartSec) || cleaned.tStartSec,
                tEndSec: Number(supportItem?.tEndSec) || cleaned.tEndSec,
                text: String(supportItem?.text || ''),
              }))
              .filter(item => item.text.length > 0)
          : [],
        language: data.language || cleaned.language,
      };
    });

    totalQuestions += questions.length;

    segments.push({
      segmentId: cleaned.segmentId,
      segmentIndex: cleaned.segmentIndex,
      title: cleaned.title,
      language: cleaned.language,
      tStartSec: cleaned.tStartSec,
      tEndSec: cleaned.tEndSec,
      durationSec: cleaned.durationSec,
      questions,
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
    version: '2.0',
  } satisfies VideoManifest;

  return videoManifestSchema.parse(manifest);
}
