'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useFirestore, useCollection, useMemoFirebase, useDoc, useFirebaseAuth } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { PlayCircle, CheckCircle, Clock, Video as VideoIcon, TrendingUp, MoreVertical, FileText, RotateCw, Settings } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import Link from 'next/link';
import Image from 'next/image';
import React from 'react';
import { StatusChip, getStepLabel } from '@/components/video/status-chip';
import { ProcessVideoModal } from '@/components/video/process-video-modal';
import { useToast } from '@/hooks/use-toast';

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export default function AssignmentPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const firestore = useFirestore();
  const { user, claims } = useFirebaseAuth();
  const { toast } = useToast();
  
  // Unwrap the params Promise
  const unwrappedParams = React.use(params);
  const assignmentId = unwrappedParams.assignmentId;

  // Process modal state
  const [processModalOpen, setProcessModalOpen] = useState(false);
  const [selectedVideoForProcessing, setSelectedVideoForProcessing] = useState<any>(null);
  
  // Video status polling
  const [pollingVideoIds, setPollingVideoIds] = useState<Set<string>>(new Set());

  const isCoach = claims?.role === 'coach';
  const isStudent = claims?.role === 'student';

  const assignmentRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'assignments', assignmentId);
  }, [firestore, assignmentId]);

  const { data: assignment, isLoading: loadingAssignment } = useDoc(assignmentRef);

  const playlistRef = useMemoFirebase(() => {
    if (!firestore || !(assignment as any)?.playlistId) return null;
    return doc(firestore, 'playlists', (assignment as any).playlistId);
  }, [firestore, assignment]);

  const { data: playlist, isLoading: loadingPlaylist } = useDoc(playlistRef);

  const videosRef = useMemoFirebase(() => {
    if (!firestore || !(assignment as any)?.playlistId) return null;
    return query(
      collection(firestore, 'videos'),
      where('playlistId', '==', (assignment as any).playlistId)
    );
  }, [firestore, assignment]);

  const { data: videos, isLoading: loadingVideos } = useCollection(videosRef);

  const progressRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid || !assignmentId) return null;
    return query(
      collection(firestore, 'progress'),
      where('studentId', '==', user.uid),
      where('assignmentId', '==', assignmentId)
    );
  }, [firestore, user, assignmentId]);

  const { data: progressDocs } = useCollection(progressRef);

  const getVideoProgress = (videoId: string) => {
    return progressDocs?.find((p: any) => p.videoId === videoId);
  };

  const totalDuration = videos?.reduce((sum: number, v: any) => sum + (v.duration || 0), 0) || 0;
  const completedVideos = videos?.filter((v: any) => {
    const progress = getVideoProgress(v.id);
    return progress?.watchPct >= 80;
  }).length || 0;

  const isLoading = loadingAssignment || loadingPlaylist || loadingVideos;

  // Filter videos for students (hide failed)
  const visibleVideos = isStudent 
    ? videos?.filter((v: any) => v.status !== 'failed')
    : videos;

  // Handle process video
  const handleProcessVideo = (video: any) => {
    setSelectedVideoForProcessing(video);
    setProcessModalOpen(true);
  };

  // Handle process success
  const handleProcessSuccess = () => {
    toast({
      title: 'Success!',
      description: 'Video processed successfully',
    });
    // Refresh will happen automatically via Firestore listener
  };

  // Get friendly status message for students
  const getStudentStatusMessage = (status: string) => {
    if (status === 'not_ready') return 'This video is being prepared';
    if (status === 'processing') return 'Processing... check back soon';
    return null;
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-muted-foreground">Loading assignment...</p>
        </div>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Assignment Not Found</CardTitle>
            <CardDescription>This assignment may have been deleted or you don't have access to it.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/dashboard">Back to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="p-4 md:p-6 border-b bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="space-y-2">
          <h1 className="text-3xl font-headline font-bold">{(assignment as any)?.title || 'Assignment'}</h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <VideoIcon className="h-4 w-4" />
              <span>{(playlist as any)?.title || 'Loading...'}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{videos?.length || 0} videos • {formatDuration(totalDuration)}</span>
            </div>
            <div className="flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              <span>{completedVideos} / {videos?.length || 0} completed</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 space-y-6">
        {/* Assignment Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Assignment Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Due Date</p>
              <p className="font-medium">
                {(assignment as any)?.endAt?.toDate ? 
                  (assignment as any).endAt.toDate().toLocaleDateString() : 
                  'No deadline'
                }
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Required Score</p>
              <p className="font-medium">{(assignment as any)?.rules?.minScore || 70}%</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Required Watch</p>
              <p className="font-medium">{(assignment as any)?.rules?.watchPct || 80}%</p>
            </div>
          </CardContent>
        </Card>

        {/* Overall Progress */}
        <Card>
          <CardHeader>
            <CardTitle>Your Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Overall Completion</span>
                <span className="font-medium">{Math.round((completedVideos / (videos?.length || 1)) * 100)}%</span>
              </div>
              <Progress value={(completedVideos / (videos?.length || 1)) * 100} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Videos List */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Videos</h2>
          
          {!visibleVideos || visibleVideos.length === 0 ? (
            <Card className="border-2 border-dashed">
              <CardHeader className="text-center py-12">
                <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                  <VideoIcon className="h-8 w-8 text-blue-600" />
                </div>
                <CardTitle>No Videos Yet</CardTitle>
                <CardDescription className="max-w-md mx-auto">
                  {isStudent 
                    ? 'This playlist is being processed. Videos will appear here once they\'re ready.'
                    : 'No videos found in this playlist.'}
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="space-y-3">
              {visibleVideos.map((video: any, index: number) => {
                const progress = getVideoProgress(video.id);
                const isCompleted = progress?.watchPct >= 80;
                const watchPct = progress?.watchPct || 0;
                const score = progress?.score || 0;

                return (
                  <Card key={video.id} className={`hover:shadow-md transition-shadow ${isCompleted ? 'border-green-200' : ''}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        {/* Thumbnail */}
                        <div className="relative w-40 h-24 flex-shrink-0 rounded overflow-hidden bg-gray-100">
                          {video.thumbnailUrl ? (
                            <Image 
                              src={video.thumbnailUrl} 
                              alt={video.title}
                              fill
                              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 160px"
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <VideoIcon className="h-8 w-8 text-gray-400" />
                            </div>
                          )}
                          <div className="absolute bottom-1 right-1 bg-black/75 text-white text-xs px-1 rounded">
                            {formatDuration(video.duration)}
                          </div>
                        </div>

                        {/* Video Info */}
                        <div className="flex-1 space-y-2">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm text-muted-foreground font-medium">#{index + 1}</span>
                                <h3 className="font-semibold text-lg">{video.title}</h3>
                                {isCompleted && (
                                  <CheckCircle className="h-5 w-5 text-green-600" />
                                )}
                                <StatusChip status={video.status || 'not_ready'} />
                              </div>
                              {video.description && (
                                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                  {video.description}
                                </p>
                              )}
                            </div>
                            
                            {/* Coach-only action menu */}
                            {isCoach && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleProcessVideo(video)}>
                                    <Settings className="h-4 w-4 mr-2" />
                                    {video.status === 'not_ready' ? 'Process Video' : 'Reprocess'}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem asChild>
                                    <Link href={`/dashboard/videos/${video.id}/mcqs`}>
                                      <FileText className="h-4 w-4 mr-2" />
                                      Manage MCQs
                                    </Link>
                                  </DropdownMenuItem>
                                  {video.status === 'failed' && (
                                    <DropdownMenuItem onClick={() => handleProcessVideo(video)}>
                                      <RotateCw className="h-4 w-4 mr-2" />
                                      Retry Processing
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem asChild>
                                    <Link href={`/dashboard/videos/${video.id}/logs`}>
                                      <FileText className="h-4 w-4 mr-2" />
                                      View Logs
                                    </Link>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>

                          {/* Progress Bars */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <div className="flex-1 space-y-1">
                                <div className="flex justify-between text-xs">
                                  <span className="text-muted-foreground">Watch Progress</span>
                                  <span className="font-medium">{Math.round(watchPct)}%</span>
                                </div>
                                <Progress value={watchPct} className="h-1.5" />
                              </div>
                              <div className="flex-1 space-y-1">
                                <div className="flex justify-between text-xs">
                                  <span className="text-muted-foreground">Quiz Score</span>
                                  <span className="font-medium">{Math.round(score)}%</span>
                                </div>
                                <Progress value={score} className="h-1.5" />
                              </div>
                            </div>
                          </div>

                          {/* Action Button */}
                          <div className="flex items-center gap-2 pt-2">
                            {video.status === 'ready' ? (
                              <>
                                <Button asChild size="sm" className="min-w-[120px]">
                                  <Link href={`/dashboard/watch/${video.id}?assignmentId=${assignmentId}`}>
                                    {watchPct > 0 ? (
                                      <>
                                        <PlayCircle className="h-4 w-4 mr-1" />
                                        Continue
                                      </>
                                    ) : (
                                      <>
                                        <PlayCircle className="h-4 w-4 mr-1" />
                                        Start
                                      </>
                                    )}
                                  </Link>
                                </Button>
                                {video.segmentCount > 0 && (
                                  <span className="text-xs text-muted-foreground">
                                    {video.segmentCount} quiz checkpoints
                                  </span>
                                )}
                              </>
                            ) : (
                              <>
                                {isStudent ? (
                                  <div className="flex items-center gap-2">
                                    <Button size="sm" disabled className="min-w-[120px]">
                                      <Clock className="h-4 w-4 mr-1" />
                                      Not Ready
                                    </Button>
                                    <span className="text-xs text-muted-foreground">
                                      {getStudentStatusMessage(video.status)}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <Button 
                                      size="sm" 
                                      onClick={() => handleProcessVideo(video)}
                                      variant={video.status === 'failed' ? 'destructive' : 'default'}
                                      className="min-w-[120px]"
                                    >
                                      {video.status === 'failed' ? (
                                        <>
                                          <RotateCw className="h-4 w-4 mr-1" />
                                          Retry
                                        </>
                                      ) : (
                                        <>
                                          <Settings className="h-4 w-4 mr-1" />
                                          Process
                                        </>
                                      )}
                                    </Button>
                                    {video.status === 'failed' && video.errorMessage && (
                                      <span className="text-xs text-destructive">
                                        {video.errorMessage}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Process Video Modal */}
      {selectedVideoForProcessing && (
        <ProcessVideoModal
          open={processModalOpen}
          onOpenChange={setProcessModalOpen}
          videoId={selectedVideoForProcessing.id}
          videoTitle={selectedVideoForProcessing.title}
          youtubeVideoId={selectedVideoForProcessing.youtubeVideoId}
          userId={user?.uid || ''}
          coachId={claims?.coachId || ''}
          onSuccess={handleProcessSuccess}
        />
      )}
    </div>
  );
}