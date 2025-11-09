'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, XCircle, Upload, Wand2, Circle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface ProcessVideoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoId: string;
  videoTitle: string;
  youtubeVideoId: string;
  userId: string;
  coachId: string;
  onSuccess?: () => void;
}

type CaptionSource = 'oauth' | 'srt' | 'ai';
type ProcessingStep = 'source' | 'language' | 'processing' | 'complete';

interface OwnershipStatus {
  owned: boolean;
  channelId?: string;
  cached: boolean;
}

export function ProcessVideoModal({
  open,
  onOpenChange,
  videoId,
  videoTitle,
  youtubeVideoId,
  userId,
  coachId,
  onSuccess,
}: ProcessVideoModalProps) {
  const { toast } = useToast();
  
  // Wizard state
  const [currentStep, setCurrentStep] = useState<ProcessingStep>('source');
  const [captionSource, setCaptionSource] = useState<CaptionSource>('oauth');
  const [captionLanguage, setCaptionLanguage] = useState('en');
  const [mcqLanguage, setMcqLanguage] = useState('en');
  const [srtFile, setSrtFile] = useState<File | null>(null);
  
  // Ownership & availability
  const [checkingOwnership, setCheckingOwnership] = useState(true);
  const [ownership, setOwnership] = useState<OwnershipStatus | null>(null);
  const [hasYouTubeConnection, setHasYouTubeConnection] = useState(false);
  const [isFromYouTubeImport, setIsFromYouTubeImport] = useState(false);
  
  // Processing state
  const [processing, setProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStepName, setProcessingStepName] = useState('');
  const [processingLogs, setProcessingLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Check ownership and YouTube connection when modal opens
  useEffect(() => {
    if (open) {
      checkOwnershipAndConnection();
    } else {
      // Reset state when modal closes
      setCurrentStep('source');
      setCaptionSource('oauth');
      setProcessingProgress(0);
      setProcessingLogs([]);
      setError(null);
    }
  }, [open]);

  const checkOwnershipAndConnection = async () => {
    setCheckingOwnership(true);

    try {
      // First check if video was imported from YouTube playlist
      const videoResponse = await fetch(`/api/videos/${videoId}`);
      const videoData = await videoResponse.json();

      const isYouTubeImported = videoData.source === 'youtube_playlist';
      setIsFromYouTubeImport(isYouTubeImported);

      if (isYouTubeImported) {
        // Video was imported from authenticated YouTube account - trust it's owned
        console.log('[Process Modal] Video imported from YouTube playlist - trusting ownership');
        setOwnership({
          owned: true,
          channelId: videoData.channelId,
          cached: true, // We know it's owned
        });
        setHasYouTubeConnection(true);
        setCaptionSource('oauth');
        setCheckingOwnership(false);
        return;
      }

      // Check YouTube connection for non-imported videos
      const channelsResponse = await fetch(`/api/youtube/channels?userId=${userId}`);
      const channelsData = await channelsResponse.json();
      setHasYouTubeConnection(channelsData.connected);

      if (channelsData.connected) {
        // Check ownership
        const ownershipResponse = await fetch(`/api/videos/${videoId}/ownership`);
        const ownershipData = await ownershipResponse.json();

        setOwnership({
          owned: ownershipData.owned,
          channelId: ownershipData.channelId,
          cached: ownershipData.cached,
        });

        // Pre-select OAuth if owned
        if (ownershipData.owned) {
          setCaptionSource('oauth');
        } else {
          setCaptionSource('srt');
        }
      } else {
        setOwnership(null);
        setCaptionSource('srt');
      }
    } catch (error) {
      console.error('Failed to check ownership:', error);
      setOwnership(null);
      setCaptionSource('srt');
    } finally {
      setCheckingOwnership(false);
    }
  };

  const handleNext = () => {
    if (currentStep === 'source') {
      // Validate source selection
      if (captionSource === 'srt' && !srtFile) {
        toast({
          title: 'File Required',
          description: 'Please select an SRT or VTT file',
          variant: 'destructive',
        });
        return;
      }
      setCurrentStep('language');
    } else if (currentStep === 'language') {
      setCurrentStep('processing');
      startProcessing();
    }
  };

  const handleBack = () => {
    if (currentStep === 'language') {
      setCurrentStep('source');
    } else if (currentStep === 'processing') {
      setCurrentStep('language');
      setProcessing(false);
      setProcessingProgress(0);
      setProcessingLogs([]);
    }
  };

  const addLog = (message: string) => {
    setProcessingLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const startProcessing = async () => {
    setProcessing(true);
    setError(null);
    setProcessingProgress(0);

    try {
      // Step 1: Fetch/Upload Captions (25%)
      setProcessingStepName('Fetching Captions');
      addLog('Starting caption fetch...');

      if (captionSource === 'oauth') {
        const captionResponse = await fetch(`/api/videos/${videoId}/captions/fetch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: 'oauth',
            language: captionLanguage,
            userId,
          }),
        });

        if (!captionResponse.ok) {
          const error = await captionResponse.json();

          // Handle specific error cases
          if (error.suggestion === 'captions_unavailable' ||
              (typeof error.message === 'string' &&
               error.message.includes('YouTube captions not available'))) {
            addLog('⚠️ YouTube captions not available for this video (likely unlisted)');
            addLog('💡 Automatically switching to SRT upload option');

            // Automatically switch to SRT upload
            setCaptionSource('srt');
            setCurrentStep('source');

            toast({
              title: 'YouTube Captions Unavailable',
              description: 'This video has no captions available (common with unlisted videos). Please upload an SRT file.',
              variant: 'destructive',
            });

            return; // Don't throw error, let user choose alternative
          }

          throw new Error(error.message || 'Failed to fetch captions');
        }

        const captionData = await captionResponse.json();
        addLog(`✓ Captions fetched (${captionData.captionTrack.language})`);
      } else if (captionSource === 'srt' && srtFile) {
        const formData = new FormData();
        formData.append('file', srtFile);
        formData.append('userId', userId);
        formData.append('language', captionLanguage);

        const uploadResponse = await fetch(`/api/videos/${videoId}/captions/upload`, {
          method: 'POST',
          body: formData,
        });

        if (!uploadResponse.ok) {
          const error = await uploadResponse.json();
          throw new Error(error.message || 'Failed to upload captions');
        }

        const uploadData = await uploadResponse.json();
        addLog(`✓ Captions uploaded (${uploadData.captionTrack.cueCount} cues)`);
      }

      setProcessingProgress(25);

      // Step 2: Segment Transcript (50%)
      setProcessingStepName('Segmenting Transcript');
      addLog('Segmenting transcript into chunks...');

      const segmentResponse = await fetch(`/api/videos/${videoId}/segment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segmentDuration: 45,
          userId,
        }),
      });

      if (!segmentResponse.ok) {
        const error = await segmentResponse.json();
        throw new Error(error.message || 'Failed to segment transcript');
      }

      const segmentData = await segmentResponse.json();
      addLog(`✓ Created ${segmentData.segmentCount} segments`);
      setProcessingProgress(50);

      // Step 3: Generate MCQs (75%)
      setProcessingStepName('Generating MCQs');
      addLog('Generating quiz questions...');

      const mcqResponse = await fetch(`/api/videos/${videoId}/mcq/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetLanguage: mcqLanguage,
          userId,
        }),
      });

      if (!mcqResponse.ok) {
        const error = await mcqResponse.json();
        throw new Error(error.message || 'Failed to generate MCQs');
      }

      const mcqData = await mcqResponse.json();
      addLog(`✓ Generated ${mcqData.questionsGenerated} questions`);
      if (mcqData.failedSegments > 0) {
        addLog(`⚠ ${mcqData.failedSegments} segments had no questions`);
      }
      setProcessingProgress(75);

      // Step 4: Build Manifest (100%)
      setProcessingStepName('Building Manifest');
      addLog('Building video manifest...');

      const manifestResponse = await fetch(`/api/videos/${videoId}/manifest/build`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (!manifestResponse.ok) {
        const error = await manifestResponse.json();
        throw new Error(error.message || 'Failed to build manifest');
      }

      const manifestData = await manifestResponse.json();
      addLog(`✓ Manifest built (${manifestData.totalSegments} segments, ${manifestData.totalQuestions} questions)`);
      setProcessingProgress(100);

      // Complete!
      setCurrentStep('complete');
      addLog('✅ Video processing complete!');

      toast({
        title: 'Success!',
        description: 'Video processed successfully and is now ready for students',
      });

      if (onSuccess) {
        onSuccess();
      }

    } catch (error) {
      console.error('Processing failed:', error);
      setError(error instanceof Error ? error.message : 'Processing failed');
      addLog(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      toast({
        title: 'Processing Failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    if (!processing) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Process Video</DialogTitle>
          <DialogDescription>{videoTitle}</DialogDescription>
        </DialogHeader>

        {/* Progress Indicator */}
        <div className="flex items-center justify-between mb-6">
          {['source', 'language', 'processing', 'complete'].map((step, index) => (
            <div key={step} className="flex items-center">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-colors',
                  currentStep === step
                    ? 'bg-primary text-primary-foreground'
                    : index < ['source', 'language', 'processing', 'complete'].indexOf(currentStep)
                    ? 'bg-green-600 text-white'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {index + 1}
              </div>
              {index < 3 && (
                <div
                  className={cn(
                    'h-0.5 w-12 mx-2',
                    index < ['source', 'language', 'processing', 'complete'].indexOf(currentStep)
                      ? 'bg-green-600'
                      : 'bg-muted'
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Caption Source Selection */}
        {currentStep === 'source' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Select Caption Source</h3>
              <p className="text-sm text-muted-foreground">
                Choose how to obtain captions for this video
              </p>
            </div>

            {checkingOwnership ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Checking ownership...</span>
              </div>
            ) : (
              <RadioGroup value={captionSource} onValueChange={(value) => setCaptionSource(value as CaptionSource)}>
                {/* OAuth Option */}
                <div className={cn(
                  'flex items-start space-x-3 space-y-0 rounded-lg border p-4',
                  !hasYouTubeConnection || !ownership?.owned ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-accent'
                )}>
                  <RadioGroupItem 
                    value="oauth" 
                    id="oauth"
                    disabled={!hasYouTubeConnection || !ownership?.owned}
                  />
                  <div className="flex-1">
                    <Label htmlFor="oauth" className="font-medium cursor-pointer">
                      OAuth (YouTube)
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Automatically fetch captions from YouTube
                    </p>
                    {hasYouTubeConnection && ownership?.owned && (
                      <div className="flex items-center gap-2 mt-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-xs text-green-600">
                          Video owned by your channel
                        </span>
                      </div>
                    )}
                    {hasYouTubeConnection && !ownership?.owned && (
                      <div className="flex items-center gap-2 mt-2">
                        <XCircle className="h-4 w-4 text-red-600" />
                        <span className="text-xs text-red-600">
                          Video not owned by your connected channels
                        </span>
                      </div>
                    )}
                    {!hasYouTubeConnection && (
                      <div className="flex items-center gap-2 mt-2">
                        <XCircle className="h-4 w-4 text-orange-600" />
                        <span className="text-xs text-orange-600">
                          YouTube not connected
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* SRT Upload Option */}
                <div className="flex items-start space-x-3 space-y-0 rounded-lg border p-4 cursor-pointer hover:bg-accent">
                  <RadioGroupItem value="srt" id="srt" />
                  <div className="flex-1">
                    <Label htmlFor="srt" className="font-medium cursor-pointer">
                      Upload SRT/VTT File
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Upload your own caption file (max 200MB)
                    </p>
                    {captionSource === 'srt' && (
                      <div className="mt-3">
                        <Input
                          type="file"
                          accept=".srt,.vtt"
                          onChange={(e) => setSrtFile(e.target.files?.[0] || null)}
                          className="cursor-pointer"
                        />
                        {srtFile && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Selected: {srtFile.name} ({(srtFile.size / 1024).toFixed(1)} KB)
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* AI Transcription Option */}
                <div className="flex items-start space-x-3 space-y-0 rounded-lg border p-4 opacity-50 cursor-not-allowed">
                  <RadioGroupItem value="ai" id="ai" disabled />
                  <div className="flex-1">
                    <Label htmlFor="ai" className="font-medium">
                      AI Transcription
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Generate captions using AI (Coming Soon)
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Wand2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        Cost: TBD credits
                      </span>
                    </div>
                  </div>
                </div>
              </RadioGroup>
            )}

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button 
                onClick={handleNext}
                disabled={checkingOwnership || (captionSource === 'srt' && !srtFile)}
              >
                Next: Language Selection
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Language Selection */}
        {currentStep === 'language' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Language Settings</h3>
              <p className="text-sm text-muted-foreground">
                Configure caption and quiz languages
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="caption-lang">Caption Language</Label>
                <Select value={captionLanguage} onValueChange={setCaptionLanguage}>
                  <SelectTrigger id="caption-lang">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                    <SelectItem value="de">German</SelectItem>
                    <SelectItem value="ur">Urdu</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {captionSource === 'oauth' 
                    ? 'We\'ll try to fetch this language, or fallback to first available'
                    : 'Language of the uploaded caption file'}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mcq-lang">MCQ Language</Label>
                <Select value={mcqLanguage} onValueChange={setMcqLanguage}>
                  <SelectTrigger id="mcq-lang">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                    <SelectItem value="ur">Urdu</SelectItem>
                    <SelectItem value="ur-roman">Roman Urdu</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Quiz questions will be generated in this language
                </p>
              </div>
            </div>

            <Alert>
              <AlertDescription>
                <strong>Summary:</strong> Captions in {captionLanguage}, MCQs in {mcqLanguage}
              </AlertDescription>
            </Alert>

            <div className="flex justify-between gap-2 mt-6">
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
              <Button onClick={handleNext}>
                Start Processing
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Processing */}
        {currentStep === 'processing' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Processing Video</h3>
              <p className="text-sm text-muted-foreground">
                {processingStepName || 'Initializing...'}
              </p>
            </div>

            <Progress value={processingProgress} className="h-2" />

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {processingProgress >= 25 ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                <span className="text-sm">Fetch Captions</span>
              </div>
              <div className="flex items-center gap-2">
                {processingProgress >= 50 ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : processingProgress >= 25 ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-sm">Segment Transcript</span>
              </div>
              <div className="flex items-center gap-2">
                {processingProgress >= 75 ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : processingProgress >= 50 ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-sm">Generate MCQs</span>
              </div>
              <div className="flex items-center gap-2">
                {processingProgress >= 100 ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : processingProgress >= 75 ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-sm">Build Manifest</span>
              </div>
            </div>

            {/* Live Logs */}
            <div className="mt-4">
              <Label className="text-xs text-muted-foreground">Processing Logs:</Label>
              <div className="mt-2 rounded-lg border bg-muted/50 p-3 max-h-48 overflow-y-auto font-mono text-xs">
                {processingLogs.map((log, index) => (
                  <div key={index} className="text-muted-foreground">
                    {log}
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-2 mt-6">
              {!processing && error && (
                <Button variant="outline" onClick={() => setCurrentStep('source')}>
                  Start Over
                </Button>
              )}
              <Button 
                variant="outline" 
                onClick={handleClose}
                disabled={processing}
              >
                {processing ? 'Processing...' : 'Close'}
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Complete */}
        {currentStep === 'complete' && (
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center py-8">
              <CheckCircle2 className="h-16 w-16 text-green-600 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Processing Complete!</h3>
              <p className="text-sm text-muted-foreground text-center">
                Video is now ready for students to watch
              </p>
            </div>

            <div className="mt-4">
              <Label className="text-xs text-muted-foreground">Processing Logs:</Label>
              <div className="mt-2 rounded-lg border bg-muted/50 p-3 max-h-48 overflow-y-auto font-mono text-xs">
                {processingLogs.map((log, index) => (
                  <div key={index} className="text-muted-foreground">
                    {log}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button onClick={handleClose}>
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

