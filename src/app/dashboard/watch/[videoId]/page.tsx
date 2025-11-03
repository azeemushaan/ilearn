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

  const videoRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'videos', videoId);
  }, [firestore, videoId]);

  const { data: video, isLoading: loadingVideo } = useDoc(videoRef);

  const segmentsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, `videos/${videoId}/segments`)
    );
  }, [firestore, videoId]);

  const { data: segments, isLoading: loadingSegments } = useCollection(segmentsRef);

  const sortedSegments = segments?.sort((a: any, b: any) => a.tStartSec - b.tStartSec) || [];

  // Load YouTube IFrame API
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = () => {
        initializePlayer();
      };
    } else {
      initializePlayer();
    }

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      if (player) {
        player.destroy();
      }
    };
  }, [video]);

  const initializePlayer = () => {
    if (!video || !playerRef.current) return;

    const newPlayer = new window.YT.Player(playerRef.current, {
      videoId: (video as any).youtubeVideoId,
      playerVars: {
        autoplay: 1,
        controls: 1,
        modestbranding: 1,
        rel: 0,
      },
      events: {
        onReady: (event: any) => {
          setPlayer(event.target);
          startTimeCheck(event.target);
        },
        onStateChange: (event: any) => {
          if (event.data === window.YT.PlayerState.PLAYING) {
            startTimeCheck(event.target);
          } else {
            stopTimeCheck();
          }
        },
      },
    });
  };

  const startTimeCheck = (ytPlayer: any) => {
    stopTimeCheck();
    checkIntervalRef.current = setInterval(() => {
      checkSegmentCheckpoint(ytPlayer);
    }, 1000);
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

    if (nextSegment && currentTime >= nextSegment.tEndSec) {
      ytPlayer.pauseVideo();
      stopTimeCheck();
      await loadQuestionForSegment(nextSegment.id);
    }
  };

  const loadQuestionForSegment = async (segmentId: string) => {
    const questionsRef = collection(firestore!, `videos/${videoId}/segments/${segmentId}/questions`);
    const { getDocs } = await import('firebase/firestore');
    const questionsSnap = await getDocs(questionsRef);
    
    if (questionsSnap && !questionsSnap.empty) {
      const randomQuestion = questionsSnap.docs[Math.floor(Math.random() * questionsSnap.docs.length)];
      setCurrentQuestion({ id: randomQuestion.id, ...randomQuestion.data(), segmentId });
      setShowQuiz(true);
    } else {
      // No questions, continue to next segment
      setCurrentSegmentIndex(prev => prev + 1);
      player?.playVideo();
      startTimeCheck(player);
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
    setCurrentSegmentIndex(prev => prev + 1);
    player?.playVideo();
    startTimeCheck(player);
  };

  return (
    <div className="flex flex-1 flex-col bg-black">
      {loadingVideo || loadingSegments ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-white mx-auto" />
            <p className="text-white">Loading video...</p>
          </div>
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
      ) : (video as any).status !== 'ready' ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>Video Processing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This video is still being processed. Quizzes will be available soon.
                  {(video as any).status === 'processing' && ' Please check back in a few minutes.'}
                  {(video as any).status === 'error' && ' There was an error processing this video. Please contact your instructor.'}
                </AlertDescription>
              </Alert>
              {(video as any).status === 'processing' && (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Processing...</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
          <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
            <div ref={playerRef} className="absolute inset-0" />
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
