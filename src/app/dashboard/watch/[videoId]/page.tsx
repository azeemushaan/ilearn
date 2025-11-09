'use client';

import React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useFirestore, useDoc, useCollection, useMemoFirebase, useFirebaseAuth } from '@/firebase';
import { doc, collection, query, where, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/hooks/use-toast';
import { AlertCircle, Loader2 } from 'lucide-react';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export default function WatchPage({ params }: { params: Promise<{ videoId: string }> }) {
  const { user, claims } = useFirebaseAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const assignmentId = searchParams?.get('assignmentId') || null;
  
  // Unwrap the params Promise
  const unwrappedParams = React.use(params);
  const videoId = unwrappedParams.videoId;

  const [player, setPlayer] = useState<any>(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const playerRef = useRef<HTMLDivElement>(null);
  const checkIntervalRef = useRef<any>(null);
  const lastValidTimeRef = useRef<number>(0);

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

  // Initialize player when video data and ref are ready
  useEffect(() => {
    if (!video || !window.YT || !manifest) {
      console.log('[WATCH] Player init skipped - waiting for:', {
        hasVideo: !!video,
        hasYT: !!window.YT,
        hasManifest: !!manifest,
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
              } else {
                stopTimeCheck();
              }
            },
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
  }, [video, manifest]);

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

  const checkSegmentCheckpoint = async (ytPlayer: any) => {
    if (!sortedSegments.length || showQuiz) return;

    const currentTime = ytPlayer.getCurrentTime();
    const nextSegment = sortedSegments[currentSegmentIndex];

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
    const maxAllowedTime = nextSegment.tEndSec + 2; // Allow 2 second buffer
    if (currentTime > maxAllowedTime && currentTime > lastValidTimeRef.current + 3) {
      console.warn('[WATCH] ⚠️ Skip detected - rewinding to last valid position:', {
        currentTime,
        lastValidTime: lastValidTimeRef.current,
        maxAllowed: maxAllowedTime,
      });
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
      const randomQuestion = questionsSnap.docs[Math.floor(Math.random() * questionsSnap.docs.length)];
      const questionData = { id: randomQuestion.id, ...randomQuestion.data(), segmentId, segmentIndex };
      console.log('[WATCH] Showing quiz:', {
        questionId: randomQuestion.id,
        segmentIndex,
        stem: questionData.stem?.substring(0, 100),
        correctIndex: questionData.correctIndex,
      });
      setCurrentQuestion(questionData);
      setShowQuiz(true);
    } else {
      console.log('[WATCH] No questions found, auto-advancing to next segment');
      const nextIndex = segmentIndex + 1;
      if (nextIndex >= sortedSegments.length) {
        console.log('[WATCH] Video completed - all segments watched');
        stopTimeCheck();
      } else {
        setCurrentSegmentIndex(nextIndex);
        player?.playVideo();
        startTimeCheck(player);
      }
    }
  };

  const handleAnswerSubmit = async () => {
    if (selectedOption === null || !currentQuestion) return;

    const isCorrect = selectedOption === currentQuestion.correctIndex;

    setAnswered(true);

    // Record attempt
    try {
      await addDoc(collection(firestore!, 'attempts'), {
        studentId: user?.uid,
        assignmentId,
        questionId: currentQuestion.id,
        segmentId: currentQuestion.segmentId,
        videoId: videoId,
        chosenIndex: selectedOption,
        isCorrect,
        ts: serverTimestamp(),
      });

      // Update or create progress document
      if (assignmentId && user?.uid) {
        const progressQuery = query(
          collection(firestore!, 'progress'),
          where('studentId', '==', user.uid),
          where('assignmentId', '==', assignmentId),
          where('videoId', '==', videoId)
        );
        const { getDocs } = await import('firebase/firestore');
        const progressSnap = await getDocs(progressQuery);
        
        const currentTime = player?.getCurrentTime() || 0;
        const duration = player?.getDuration() || 1;
        const watchPct = Math.round((currentTime / duration) * 100);
        
        // Calculate score based on all attempts for this video
        const { query: fbQuery, collection: fbCollection, where: fbWhere, getDocs: fbGetDocs } = await import('firebase/firestore');
        const attemptsQuery = fbQuery(
          fbCollection(firestore!, 'attempts'),
          fbWhere('studentId', '==', user.uid),
          fbWhere('videoId', '==', videoId)
        );
        const attemptsSnap = await fbGetDocs(attemptsQuery);
        const totalAttempts = attemptsSnap.size;
        const correctAttempts = attemptsSnap.docs.filter(d => d.data().isCorrect).length;
        const score = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0;

        if (progressSnap.empty) {
          // Create new progress
          await addDoc(collection(firestore!, 'progress'), {
            studentId: user.uid,
            assignmentId,
            videoId: videoId,
            watchPct,
            score,
            attempts: 1,
            lastSegmentId: currentQuestion.segmentId,
            lastActivityAt: serverTimestamp(),
            completedAt: null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          // Update existing progress
          await updateDoc(progressSnap.docs[0].ref, {
            watchPct,
            score,
            attempts: (progressSnap.docs[0].data().attempts || 0) + 1,
            lastSegmentId: currentQuestion.segmentId,
            lastActivityAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }

      toast({
        title: isCorrect ? 'Correct! ✓' : 'Incorrect ✗',
        description: currentQuestion.rationale || (isCorrect ? 'Great job!' : 'Try reviewing this section again.'),
        variant: isCorrect ? 'default' : 'destructive',
      });
    } catch (error) {
      console.error('Error recording attempt:', error);
    }
  };

  const handleContinue = () => {
    setShowQuiz(false);
    setCurrentQuestion(null);
    setSelectedOption(null);
    setAnswered(false);
    
    // Move to next segment
    const nextIndex = currentSegmentIndex + 1;
    
    console.log('[WATCH] Continuing to next segment:', {
      currentIndex: currentSegmentIndex,
      nextIndex,
      totalSegments: sortedSegments.length,
    });
    
    if (nextIndex >= sortedSegments.length) {
      console.log('[WATCH] Video completed - all segments finished');
      stopTimeCheck();
      return;
    }
    
    setCurrentSegmentIndex(nextIndex);
    
    // Update last valid time to the start of next segment
    const nextSegment = sortedSegments[nextIndex];
    if (nextSegment && player) {
      const currentTime = player.getCurrentTime();
      lastValidTimeRef.current = currentTime;
      console.log('[WATCH] Updated last valid time:', currentTime);
    }
    
    player?.playVideo();
    startTimeCheck(player);
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
}
