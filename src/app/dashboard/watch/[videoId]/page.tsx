'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo, use } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useFirestore, useDoc, useCollection, useMemoFirebase, useFirebaseAuth } from '@/firebase';
import {
  doc,
  collection,
  query,
  where,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  getDoc,
  getDocs,
  setDoc,
  arrayUnion,
} from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/hooks/use-toast';
import { AlertCircle, Loader2 } from 'lucide-react';
import { buildProgressDocId } from '@/lib/progress/utils';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

type SegmentQuestion = {
  id: string;
  stem: string;
  options: string[];
  correctIndex: number;
  rationale?: string;
  difficulty?: string;
  segmentId: string;
  segmentIndex: number;
};

type ProgressState = {
  docId: string | null;
  segmentsCompleted: string[];
  questionHistory: Record<string, string[]>;
  lastVerifiedTimeSec: number;
  watchPct: number;
  score: number;
  attempts: number;
  correctAttempts: number;
};

const DEFAULT_PROGRESS_STATE: ProgressState = {
  docId: null,
  segmentsCompleted: [],
  questionHistory: {},
  lastVerifiedTimeSec: 0,
  watchPct: 0,
  score: 0,
  attempts: 0,
  correctAttempts: 0,
};

type WatchPageProps = { params: Promise<{ videoId: string }> };

export default function WatchPage({ params }: WatchPageProps) {
  const { user } = useFirebaseAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const assignmentId = searchParams?.get('assignmentId') || null;

  const { videoId } = use(params);

  const [player, setPlayer] = useState<any>(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<SegmentQuestion | null>(null);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [progressState, setProgressState] = useState<ProgressState>(DEFAULT_PROGRESS_STATE);
  const [progressReady, setProgressReady] = useState(false);
  const [segmentNotice, setSegmentNotice] = useState<string | null>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const checkIntervalRef = useRef<any>(null);
  const lastValidTimeRef = useRef<number>(0);
  const minSegmentIndexRef = useRef<number>(0);
  const progressDocRef = useRef<ReturnType<typeof doc> | null>(null);
  const sessionQuestionHistoryRef = useRef<Record<string, Set<string>>>({});
  const currentSegmentIndexRef = useRef<number>(0);
  const enforcedSegmentRef = useRef<{ index: number; warningShown: boolean }>({ index: 0, warningShown: false });

  // Manifest state
  const [manifest, setManifest] = useState<any>(null);
  const [loadingManifest, setLoadingManifest] = useState(true);
  const [manifestError, setManifestError] = useState<string | null>(null);

  const videoRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'videos', videoId);
  }, [firestore, videoId]);

  const { data: video, isLoading: loadingVideo } = useDoc(videoRef);

  // Use manifest segments instead of Firestore query
  const sortedSegments = manifest?.segments || [];

  const completedSegmentsSet = useMemo(() => {
    return new Set(progressState.segmentsCompleted);
  }, [progressState.segmentsCompleted]);

  const nextRequiredSegmentIndex = useMemo(() => {
    if (!sortedSegments.length) return 0;
    for (let i = 0; i < sortedSegments.length; i++) {
      if (!completedSegmentsSet.has(sortedSegments[i].segmentId)) {
        return i;
      }
    }
    return Math.max(sortedSegments.length - 1, 0);
  }, [sortedSegments, completedSegmentsSet]);

  // Debug logging (only on mount and key changes)
  useEffect(() => {
    console.log('[WATCH] Component state:', {
      hasUser: !!user,
      hasVideoId: !!videoId,
      hasFirestore: !!firestore,
      loadingVideo,
      hasVideo: !!video,
      videoData: video ? {
        status: (video as any).status,
        youtubeVideoId: (video as any).youtubeVideoId,
        title: (video as any).title,
      } : null,
      loadingManifest,
      hasManifest: !!manifest,
      manifestError,
      segmentsCount: sortedSegments.length,
    });
  }, [loadingVideo, loadingManifest, video?.status, manifest?.videoId]);

  useEffect(() => {
    if (!firestore || !user?.uid || !videoId) return;

    const canonicalId = buildProgressDocId(user.uid, assignmentId, videoId);
    const canonicalRef = doc(firestore, 'progress', canonicalId);
    progressDocRef.current = canonicalRef;

    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    const parseProgressState = (raw: any): ProgressState => ({
      docId: canonicalId,
      segmentsCompleted: Array.isArray(raw?.segmentsCompleted) ? raw.segmentsCompleted : [],
      questionHistory: typeof raw?.questionHistory === 'object' && raw?.questionHistory !== null ? raw.questionHistory : {},
      lastVerifiedTimeSec: typeof raw?.lastVerifiedTimeSec === 'number' ? raw.lastVerifiedTimeSec : 0,
      watchPct: typeof raw?.watchPct === 'number' ? raw.watchPct : 0,
      score: typeof raw?.score === 'number' ? raw.score : 0,
      attempts: typeof raw?.attempts === 'number' ? raw.attempts : 0,
      correctAttempts: typeof raw?.correctAttempts === 'number' ? raw.correctAttempts : 0,
    });

    const startListener = () => {
      unsubscribe = onSnapshot(
        canonicalRef,
        snapshot => {
          if (!snapshot.exists()) {
            setProgressState(DEFAULT_PROGRESS_STATE);
            setProgressReady(true);
            return;
          }
          setProgressState(parseProgressState(snapshot.data()));
          setProgressReady(true);
        },
        error => {
          console.error('[WATCH] Progress listener error:', error);
          setProgressReady(true);
        }
      );
    };

    const ensureProgressDocument = async () => {
      try {
        const existing = await getDoc(canonicalRef);
        if (cancelled) return;
        if (existing.exists()) {
          startListener();
          return;
        }

        const legacyQuery = query(
          collection(firestore, 'progress'),
          where('studentId', '==', user.uid),
          where('videoId', '==', videoId),
          where('assignmentId', '==', assignmentId)
        );
        const legacySnap = await getDocs(legacyQuery);
        if (cancelled) return;

        if (!legacySnap.empty) {
          const legacyData = legacySnap.docs[0].data();
          await setDoc(
            canonicalRef,
            {
              ...legacyData,
              assignmentId,
              updatedAt: serverTimestamp(),
              migratedFrom: legacySnap.docs[0].id,
            },
            { merge: true }
          );
        } else {
          await setDoc(
            canonicalRef,
            {
              studentId: user.uid,
              assignmentId,
              videoId,
              watchPct: 0,
              score: 0,
              attempts: 0,
              correctAttempts: 0,
              segmentsCompleted: [],
              questionHistory: {},
              lastVerifiedTimeSec: 0,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        }

        if (!cancelled) {
          startListener();
        }
      } catch (error) {
        console.error('[WATCH] Failed to prepare progress doc:', error);
        setProgressReady(true);
      }
    };

    ensureProgressDocument();

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [firestore, user?.uid, videoId, assignmentId]);

  useEffect(() => {
    if (!progressReady) return;
    minSegmentIndexRef.current = nextRequiredSegmentIndex;
    if (currentSegmentIndex < nextRequiredSegmentIndex) {
      setCurrentSegmentIndex(nextRequiredSegmentIndex);
    }
  }, [progressReady, nextRequiredSegmentIndex, currentSegmentIndex]);

  useEffect(() => {
    if (!progressReady) return;
    lastValidTimeRef.current = Math.max(lastValidTimeRef.current, progressState.lastVerifiedTimeSec || 0);
  }, [progressReady, progressState.lastVerifiedTimeSec]);

  // Fetch manifest from API
  useEffect(() => {
    async function fetchManifest() {
      if (!user || !videoId) return;
      
      try {
        setLoadingManifest(true);
        setManifestError(null);
        
        const token = await user.getIdToken();
        const response = await fetch(`/api/videos/${videoId}/manifest`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to load manifest');
        }
        
        const data = await response.json();
        console.log('[WATCH] Manifest loaded:', {
          videoId: data.videoId,
          youtubeVideoId: data.youtubeVideoId,
          totalSegments: data.totalSegments,
          totalQuestions: data.totalQuestions,
          status: data.status,
        });
        setManifest(data);
        setLoadingManifest(false);
      } catch (error: any) {
        console.error('[WATCH] Failed to fetch manifest:', error);
        setManifestError(error.message);
        setLoadingManifest(false);
      }
    }
    
    if (user && videoId) {
      fetchManifest();
    }
  }, [user, videoId]);

  // Load YouTube IFrame API
  useEffect(() => {
    console.log('[WATCH] YouTube API effect triggered');
    
    if (!window.YT) {
      console.log('[WATCH] Loading YouTube API script...');
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = () => {
        console.log('[WATCH] YouTube API ready callback fired');
      };
    } else {
      console.log('[WATCH] YouTube API already available');
    }
  }, []);

  const handlePlaybackRateChange = useCallback((event: any) => {
    const rate = typeof event?.data === 'number' ? event.data : 1;
    if (rate <= 1.25) return;
    if (event?.target?.setPlaybackRate) {
      event.target.setPlaybackRate(1);
    }
    toast({
      title: 'Playback limited',
      description: 'Fast-forwarding is disabled during checkpoints.',
    });
    setSegmentNotice('Playback speed reset to 1x for fairness.');
    setTimeout(() => setSegmentNotice(null), 3000);
  }, []);

  const getSegmentByIndex = useCallback(
    (index: number) => (index >= 0 && index < sortedSegments.length ? sortedSegments[index] : null),
    [sortedSegments]
  );

  const handlePossibleSeek = useCallback(
    (ytPlayer: any) => {
      const activeSegment = getSegmentByIndex(currentSegmentIndexRef.current);
      if (!activeSegment) return;
      const currentTime = ytPlayer.getCurrentTime();
      enforceSegmentBoundary(ytPlayer, activeSegment, currentTime);
    },
    [getSegmentByIndex]
  );

  // Initialize player when video data and ref are ready
  useEffect(() => {
    if (!video || !window.YT || !manifest || !progressReady) {
      console.log('[WATCH] Player init skipped - waiting for:', {
        hasVideo: !!video,
        hasYT: !!window.YT,
        hasManifest: !!manifest,
        progressReady,
      });
      return;
    }

    let playerInstance: any = null;
    let attempts = 0;
    const maxAttempts = 10;

    // Retry mechanism to wait for ref to be ready
    const tryInitPlayer = () => {
      attempts++;
      
      if (!playerRef.current) {
        if (attempts < maxAttempts) {
          console.log(`[WATCH] Player container not ready, retry ${attempts}/${maxAttempts}...`);
          setTimeout(tryInitPlayer, 100);
        } else {
          console.error('[WATCH] Player container ref still null after max attempts');
        }
        return;
      }

      console.log('[WATCH] Initializing player:', {
        youtubeVideoId: (video as any).youtubeVideoId,
        videoTitle: (video as any).title,
        containerElement: playerRef.current,
        containerId: playerRef.current.id,
      });

      try {
        // Clear any existing content in the player container
        if (playerRef.current) {
          playerRef.current.innerHTML = '';
        }

        playerInstance = new window.YT.Player(playerRef.current, {
          height: '100%',
          width: '100%',
          videoId: (video as any).youtubeVideoId,
          playerVars: {
            autoplay: 1,
            controls: 1,
            modestbranding: 1,
            rel: 0,
            enablejsapi: 1,
            start: 0, // Force video to start from beginning
          },
          events: {
            onReady: (event: any) => {
              console.log('[WATCH] ✅ Player ready and loaded successfully');
              setPlayer(event.target);
              
              // Immediately check if we need to catch up on missed segments
              const currentTime = event.target.getCurrentTime();
              console.log('[WATCH] Player ready at time:', currentTime);
              
              // If video started beyond 0, immediately trigger checkpoint check
              if (currentTime > 0) {
                checkSegmentCheckpoint(event.target);
              }
              
              startTimeCheck(event.target);
            },
            onStateChange: (event: any) => {
              console.log('[WATCH] Player state changed:', event.data);
              if (event.data === window.YT.PlayerState.PLAYING) {
                console.log('[WATCH] Video playing');
                startTimeCheck(event.target);
              } else if (event.data === window.YT.PlayerState.PAUSED) {
                console.log('[WATCH] Video paused');
                stopTimeCheck();
              } else if (event.data === window.YT.PlayerState.BUFFERING) {
                handlePossibleSeek(event.target);
              } else {
                stopTimeCheck();
              }
            },
            onPlaybackRateChange: handlePlaybackRateChange,
            onError: (event: any) => {
              console.error('[WATCH] ❌ YouTube Player error:', {
                code: event.data,
                message: getYouTubeErrorMessage(event.data),
                videoId: (video as any).youtubeVideoId,
              });
            },
          },
        });
        console.log('[WATCH] Player instance created, waiting for onReady...');
      } catch (error) {
        console.error('[WATCH] ❌ Failed to initialize player:', error);
      }
    };

    // Start trying to initialize
    tryInitPlayer();

    return () => {
      console.log('[WATCH] Cleanup effect running');
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      if (playerInstance) {
        console.log('[WATCH] Destroying player instance');
        try {
          playerInstance.destroy();
        } catch (e) {
          console.warn('[WATCH] Error destroying player:', e);
        }
      }
    };
  }, [video, manifest, progressReady, handlePlaybackRateChange, handlePossibleSeek]);

  useEffect(() => {
    if (!player || !progressReady) return;
    const resumeSegment = sortedSegments[nextRequiredSegmentIndex];
    const resumeFloor = resumeSegment ? resumeSegment.tStartSec : 0;
    const resumeTarget = Math.max(progressState.lastVerifiedTimeSec || 0, resumeFloor);
    if (resumeTarget > 0 && Math.abs(resumeTarget - lastValidTimeRef.current) > 0.5) {
      try {
        player.seekTo(resumeTarget, true);
        lastValidTimeRef.current = resumeTarget;
      } catch (error) {
        console.warn('[WATCH] Failed to resume to checkpoint:', error);
      }
    }
  }, [player, progressReady, progressState.lastVerifiedTimeSec, nextRequiredSegmentIndex, sortedSegments]);

  const getYouTubeErrorMessage = (errorCode: number) => {
    const messages: Record<number, string> = {
      2: 'Invalid video ID',
      5: 'HTML5 player error',
      100: 'Video not found or private',
      101: 'Video not allowed to be played in embedded players',
      150: 'Video not allowed to be played in embedded players',
    };
    return messages[errorCode] || `Unknown error (${errorCode})`;
  };

  const startTimeCheck = (ytPlayer: any) => {
    if (!ytPlayer) return;
    stopTimeCheck();
    // Check every 500ms for more responsive checkpoint detection
    checkIntervalRef.current = setInterval(() => {
      checkSegmentCheckpoint(ytPlayer);
    }, 500);
  };

  const stopTimeCheck = () => {
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
      checkIntervalRef.current = null;
    }
  };

  const enforceSegmentBoundary = (
    ytPlayer: any,
    segment: (typeof sortedSegments)[number] | null,
    currentTime: number
  ) => {
    if (!segment) return;

    // Prevent rewinding before the current segment start
    if (currentTime + 0.25 < segment.tStartSec) {
      if (!enforcedSegmentRef.current.warningShown) {
        toast({
          title: 'Rewind blocked',
          description: 'Please finish the current section before going back.',
          variant: 'destructive',
        });
        setSegmentNotice('You must finish this checkpoint before rewinding.');
        setTimeout(() => setSegmentNotice(null), 4000);
      }
      enforcedSegmentRef.current = { index: segment.segmentIndex, warningShown: true };
      ytPlayer.seekTo(Math.max(segment.tStartSec, lastValidTimeRef.current), true);
      return true;
    }

    enforcedSegmentRef.current = { index: segment.segmentIndex, warningShown: false };
    return false;
  };

  const syncSegmentIndex = useCallback(
    (index: number) => {
      setCurrentSegmentIndex(index);
      const segment = getSegmentByIndex(index);
      if (!segment) return;
      const targetTime = Math.max(segment.tStartSec, lastValidTimeRef.current);
      lastValidTimeRef.current = targetTime;
      if (player) {
        enforcedSegmentRef.current = { index: segment.segmentIndex, warningShown: false };
      }
    },
    [getSegmentByIndex, player]
  );

  const ensureProgressDoc = useCallback(async () => {
    if (progressDocRef.current) {
      return progressDocRef.current;
    }
    if (!firestore || !user?.uid) {
      throw new Error('Cannot ensure progress document without auth');
    }
    const canonicalRef = doc(firestore, 'progress', buildProgressDocId(user.uid, assignmentId, videoId));
    await setDoc(
      canonicalRef,
      {
        studentId: user.uid,
        assignmentId,
        videoId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    progressDocRef.current = canonicalRef;
    return canonicalRef;
  }, [firestore, user?.uid, assignmentId, videoId]);

  const patchProgress = useCallback(
    async (updates: Record<string, any>) => {
      try {
        const ref = await ensureProgressDoc();
        await updateDoc(
          ref,
          {
            ...updates,
            updatedAt: serverTimestamp(),
          }
        );
      } catch (error) {
        console.error('[WATCH] Failed to update progress:', error);
      }
    },
    [ensureProgressDoc]
  );

  const noteQuestionShown = useCallback((segmentId: string, questionId: string) => {
    if (!sessionQuestionHistoryRef.current[segmentId]) {
      sessionQuestionHistoryRef.current[segmentId] = new Set();
    }
    sessionQuestionHistoryRef.current[segmentId]!.add(questionId);
  }, []);

  const completeSegment = async (segmentIndex: number) => {
    const segment = sortedSegments[segmentIndex];
    if (!segment) {
      stopTimeCheck();
      return;
    }

    const updates: Record<string, any> = {
      lastSegmentId: segment.segmentId,
      lastVerifiedTimeSec: segment.tEndSec,
    };

    if (!completedSegmentsSet.has(segment.segmentId)) {
      updates.segmentsCompleted = arrayUnion(segment.segmentId);
    }

    await patchProgress(updates);

    const nextIndex = segmentIndex + 1;
    if (nextIndex >= sortedSegments.length) {
      stopTimeCheck();
      return;
    }

    const nextSegment = sortedSegments[nextIndex];
    if (player && nextSegment) {
      player.seekTo(nextSegment.tStartSec, true);
      lastValidTimeRef.current = nextSegment.tStartSec;
      player.playVideo();
    }
    syncSegmentIndex(nextIndex);
    startTimeCheck(player);
  };

  const checkSegmentCheckpoint = async (ytPlayer: any) => {
    if (!sortedSegments.length || showQuiz || !progressReady) return;

    const currentTime = ytPlayer.getCurrentTime();
    const nextSegment = getSegmentByIndex(currentSegmentIndex);

    // Stop if we've reached the end of all segments
    if (!nextSegment) {
      console.log('[WATCH] All segments completed:', {
        currentTime,
        totalSegments: sortedSegments.length,
        currentSegmentIndex,
      });
      stopTimeCheck();
      return;
    }

    // Anti-skip: Detect if student manually seeked forward
    if (enforceSegmentBoundary(ytPlayer, nextSegment, currentTime)) {
      return;
    }

    const maxAllowedTime = nextSegment.tEndSec + 2; // Allow 2 second buffer
    if (currentTime > maxAllowedTime && currentTime > lastValidTimeRef.current + 3) {
      console.warn('[WATCH] ⚠️ Skip detected - rewinding to last valid position:', {
        currentTime,
        lastValidTime: lastValidTimeRef.current,
        maxAllowed: maxAllowedTime,
      });
      toast({
        title: 'Skip blocked',
        description: 'Please finish the active segment before jumping ahead.',
        variant: 'destructive',
      });
      setSegmentNotice('Skipping ahead is disabled until you finish the current quiz.');
      setTimeout(() => setSegmentNotice(null), 4000);
      ytPlayer.seekTo(lastValidTimeRef.current, true);
      return;
    }

    // Update last valid time
    if (currentTime <= maxAllowedTime) {
      lastValidTimeRef.current = currentTime;
    }

    // Check if student skipped ahead past multiple segments (in case anti-skip failed)
    let segmentIndexToQuiz = currentSegmentIndex;
    for (let i = currentSegmentIndex; i < sortedSegments.length; i++) {
      const segment = sortedSegments[i];
      if (currentTime < segment.tEndSec) {
        // Student is within this segment
        break;
      }
      // Student has passed this segment's end - we need to quiz them
      segmentIndexToQuiz = i;
    }

    // If we found a missed segment, quiz on it immediately
    if (segmentIndexToQuiz !== currentSegmentIndex || currentTime >= nextSegment.tEndSec) {
      const segmentToQuiz = sortedSegments[segmentIndexToQuiz];
      console.log('[WATCH] Segment checkpoint reached:', {
        currentTime,
        segmentIndex: segmentIndexToQuiz,
        segmentId: segmentToQuiz.segmentId,
        tEndSec: segmentToQuiz.tEndSec,
        totalSegments: sortedSegments.length,
        skippedAhead: segmentIndexToQuiz > currentSegmentIndex,
      });
      syncSegmentIndex(segmentIndexToQuiz);
      ytPlayer.pauseVideo();
      stopTimeCheck();
      await loadQuestionForSegment(segmentToQuiz.segmentId, segmentIndexToQuiz);
    }
  };

  const loadQuestionForSegment = async (segmentId: string, segmentIndex: number) => {
    console.log('[WATCH] Loading questions for segment:', {
      segmentId,
      segmentIndex,
      totalSegments: sortedSegments.length,
    });
    
    const questionsRef = collection(firestore!, `videos/${videoId}/segments/${segmentId}/questions`);
    const { getDocs } = await import('firebase/firestore');
    const questionsSnap = await getDocs(questionsRef);
    
    console.log('[WATCH] Questions loaded:', {
      segmentId,
      segmentIndex,
      questionCount: questionsSnap.docs.length,
      path: `videos/${videoId}/segments/${segmentId}/questions`,
      allQuestions: questionsSnap.docs.map(d => ({
        id: d.id,
        stem: d.data().stem?.substring(0, 80),
        difficulty: d.data().difficulty,
      })),
    });
    
    if (questionsSnap && !questionsSnap.empty) {
      const persistedHistory = progressState.questionHistory[segmentId] || [];
      const seenIds = new Set<string>(persistedHistory);
      const sessionHistory = sessionQuestionHistoryRef.current[segmentId];
      sessionHistory?.forEach(id => seenIds.add(id));

      const availableQuestions = questionsSnap.docs.filter(docSnapshot => !seenIds.has(docSnapshot.id));

      if (availableQuestions.length === 0) {
        toast({
          title: 'All questions answered',
          description: 'This segment has no new questions left. Moving ahead.',
        });
        await completeSegment(segmentIndex);
        return;
      }

      const randomQuestion = availableQuestions[Math.floor(Math.random() * availableQuestions.length)];
      const rawData = randomQuestion.data() as Omit<SegmentQuestion, 'id' | 'segmentId' | 'segmentIndex'>;
      const questionData: SegmentQuestion = {
        id: randomQuestion.id,
        segmentId,
        segmentIndex,
        stem: rawData.stem,
        options: Array.isArray(rawData.options) ? rawData.options : [],
        correctIndex: rawData.correctIndex,
        rationale: rawData.rationale,
        difficulty: rawData.difficulty,
      };
      console.log('[WATCH] Showing quiz:', {
        questionId: randomQuestion.id,
        segmentIndex,
        stem: questionData.stem?.substring(0, 100),
        correctIndex: questionData.correctIndex,
      });
      noteQuestionShown(segmentId, questionData.id);
      setCurrentQuestion(questionData);
      syncSegmentIndex(segmentIndex);
      setShowQuiz(true);
    } else {
      console.log('[WATCH] No questions found, auto-advancing to next segment');
      await completeSegment(segmentIndex);
    }
  };

  const handleAnswerSubmit = async () => {
    if (selectedOption === null || !currentQuestion || !user) return;

    const isCorrect = selectedOption === currentQuestion.correctIndex;
    setAnswered(true);

    try {
      const token = await user.getIdToken();
      const currentTime = player?.getCurrentTime() || 0;
      const duration = player?.getDuration() || 1;
      const watchPct = Math.round((currentTime / Math.max(duration, 1)) * 100);

      const response = await fetch(`/api/videos/${videoId}/attempts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          assignmentId,
          questionId: currentQuestion.id,
          segmentId: currentQuestion.segmentId,
          segmentIndex: currentQuestion.segmentIndex,
          chosenIndex: selectedOption,
          isCorrect,
          watchPct,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || 'Failed to record answer');
      }

      const payload = await response.json();
      if (payload?.progressSnapshot) {
        setProgressState(current => ({
          ...current,
          ...payload.progressSnapshot,
          docId: payload.progressSnapshot.docId ?? current.docId,
        }));
      }

      toast({
        title: isCorrect ? 'Correct! ✓' : 'Incorrect ✗',
        description: currentQuestion.rationale || (isCorrect ? 'Great job!' : 'Try reviewing this section again.'),
        variant: isCorrect ? 'default' : 'destructive',
      });
    } catch (error) {
      console.error('Error recording attempt:', error);
      toast({ title: 'Could not record answer', description: String(error), variant: 'destructive' });
      setAnswered(false);
    }
  };

  const handleContinue = async () => {
    setShowQuiz(false);
    setCurrentQuestion(null);
    setSelectedOption(null);
    setAnswered(false);

    const answeredSegmentIndex = currentQuestion?.segmentIndex ?? currentSegmentIndex;
    console.log('[WATCH] Continuing to next segment:', {
      currentIndex: answeredSegmentIndex,
      totalSegments: sortedSegments.length,
    });

    await completeSegment(answeredSegmentIndex);
  };

  const videoStatus = (video as any)?.status;
  const shouldShowPlayer = video && manifest && !loadingVideo && !loadingManifest;
  const isProcessing = videoStatus === 'processing';
  const hasError = videoStatus === 'error';

  return (
    <div className="flex flex-1 flex-col bg-black">
      {loadingVideo || loadingManifest ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-white mx-auto" />
            <p className="text-white">Loading video...</p>
          </div>
        </div>
      ) : manifestError ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>Error Loading Video Data</CardTitle>
            </CardHeader>
            <CardContent>
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Failed to load video information: {manifestError}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      ) : !video ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>Video Not Found</CardTitle>
            </CardHeader>
            <CardContent>
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This video could not be loaded. It may have been deleted or you don't have access to it.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      ) : isProcessing ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>Video Processing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This video is still being processed. Quizzes will be available soon. Please check back in a few minutes.
                </AlertDescription>
              </Alert>
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Processing...</span>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : hasError ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>Video Processing Error</CardTitle>
            </CardHeader>
            <CardContent>
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  There was an error processing this video. Please contact your instructor.
                  {(video as any).errorMessage && (
                    <span className="mt-2 block text-sm">
                      Error details: {(video as any).errorMessage}
                    </span>
                  )}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      ) : shouldShowPlayer ? (
        <>
          <div className="relative w-full bg-gray-900" style={{ paddingTop: '56.25%' }}>
            <div ref={playerRef} className="absolute inset-0" id="youtube-player-container" />
            {segmentNotice && (
              <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center">
                <div className="rounded-full bg-black/70 px-4 py-1 text-sm text-white">
                  {segmentNotice}
                </div>
              </div>
            )}
            {!player && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center space-y-2">
                  <Loader2 className="h-8 w-8 animate-spin text-white mx-auto" />
                  <p className="text-white text-sm">Initializing player...</p>
                </div>
              </div>
            )}
          </div>

          {!sortedSegments || sortedSegments.length === 0 && (
            <div className="p-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No quiz checkpoints found for this video. Watch normally without interruptions.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>Unable to Load Video</CardTitle>
            </CardHeader>
            <CardContent>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Debug info: Status = {videoStatus || 'undefined'}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      )}

      {showQuiz && currentQuestion && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle>{currentQuestion.stem}</CardTitle>
                <Badge variant="secondary">
                  Segment {currentSegmentIndex + 1} / {sortedSegments.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {currentQuestion.options.map((option: string, index: number) => (
                  <button
                    key={index}
                    disabled={answered}
                    onClick={() => setSelectedOption(index)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                      selectedOption === index
                        ? answered
                          ? index === currentQuestion.correctIndex
                            ? 'border-green-600 bg-green-50'
                            : 'border-red-600 bg-red-50'
                          : 'border-blue-600 bg-blue-50'
                        : answered && index === currentQuestion.correctIndex
                        ? 'border-green-600 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>

              {!answered ? (
                <Button
                  onClick={handleAnswerSubmit}
                  disabled={selectedOption === null}
                  className="w-full"
                >
                  Submit Answer
                </Button>
              ) : (
                <div className="space-y-2">
                  {currentQuestion.rationale && (
                    <p className="text-sm text-muted-foreground bg-gray-50 p-3 rounded">
                      {currentQuestion.rationale}
                    </p>
                  )}
                  <Button onClick={handleContinue} className="w-full">
                    Continue Watching
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );

  useEffect(() => {
    currentSegmentIndexRef.current = currentSegmentIndex;
  }, [currentSegmentIndex]);
}
