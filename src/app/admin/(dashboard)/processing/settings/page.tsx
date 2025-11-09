'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Loader2, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';

export default function ProcessingSettingsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [saving, setSaving] = useState(false);
  
  // Settings state
  const [enableOAuth, setEnableOAuth] = useState(true);
  const [enableSRTUpload, setEnableSRTUpload] = useState(true);
  const [enableAITranscription, setEnableAITranscription] = useState(true);
  const [enableGoogleSpeech, setEnableGoogleSpeech] = useState(true);
  const [enableWhisper, setEnableWhisper] = useState(false);
  const [defaultEngine, setDefaultEngine] = useState<'google' | 'whisper'>('google');
  const [concurrencyPerCoach, setConcurrencyPerCoach] = useState('2');
  const [concurrencyGlobal, setConcurrencyGlobal] = useState('10');

  // Load settings from Firestore
  const settingsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'settings', 'system');
  }, [firestore]);

  const { data: settings, isLoading } = useDoc(settingsRef);

  useEffect(() => {
    if (settings) {
      const processingSettings = (settings as any).processing || {};
      
      setEnableOAuth(processingSettings.sources?.oauth !== false);
      setEnableSRTUpload(processingSettings.sources?.srt !== false);
      setEnableAITranscription(processingSettings.sources?.ai !== false);
      setEnableGoogleSpeech(processingSettings.engines?.google !== false);
      setEnableWhisper(processingSettings.engines?.whisper === true);
      setDefaultEngine(processingSettings.engines?.default || 'google');
      setConcurrencyPerCoach(String(processingSettings.concurrency?.perCoach || 2));
      setConcurrencyGlobal(String(processingSettings.concurrency?.global || 10));
    }
  }, [settings]);

  const handleSave = async () => {
    if (!firestore) return;

    setSaving(true);

    try {
      const settingsRef = doc(firestore, 'settings', 'system');
      
      await updateDoc(settingsRef, {
        processing: {
          sources: {
            oauth: enableOAuth,
            srt: enableSRTUpload,
            ai: enableAITranscription,
          },
          engines: {
            google: enableGoogleSpeech,
            whisper: enableWhisper,
            default: defaultEngine,
          },
          concurrency: {
            perCoach: parseInt(concurrencyPerCoach),
            global: parseInt(concurrencyGlobal),
          },
        },
        updatedAt: new Date(),
      });

      toast({
        title: 'Settings Saved',
        description: 'Processing settings updated successfully',
      });
    } catch (error) {
      toast({
        title: 'Save Failed',
        description: error instanceof Error ? error.message : 'Failed to save settings',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-3xl font-bold">Processing Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure caption sources, AI engines, and concurrency limits
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Caption Sources */}
        <Card>
          <CardHeader>
            <CardTitle>Caption Sources</CardTitle>
            <CardDescription>
              Enable or disable caption source options for teachers
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="oauth">OAuth (YouTube)</Label>
                <p className="text-xs text-muted-foreground">
                  Fetch captions from owned YouTube videos
                </p>
              </div>
              <Switch
                id="oauth"
                checked={enableOAuth}
                onCheckedChange={setEnableOAuth}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="srt">SRT/VTT Upload</Label>
                <p className="text-xs text-muted-foreground">
                  Manual caption file upload
                </p>
              </div>
              <Switch
                id="srt"
                checked={enableSRTUpload}
                onCheckedChange={setEnableSRTUpload}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="ai">AI Transcription</Label>
                <p className="text-xs text-muted-foreground">
                  Generate captions using AI (credit-based)
                </p>
              </div>
              <Switch
                id="ai"
                checked={enableAITranscription}
                onCheckedChange={setEnableAITranscription}
              />
            </div>
          </CardContent>
        </Card>

        {/* AI Engines */}
        <Card>
          <CardHeader>
            <CardTitle>AI Transcription Engines</CardTitle>
            <CardDescription>
              Configure available AI transcription engines
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="google">Google Speech-to-Text</Label>
                <p className="text-xs text-muted-foreground">
                  ~$0.006 per minute
                </p>
              </div>
              <Switch
                id="google"
                checked={enableGoogleSpeech}
                onCheckedChange={setEnableGoogleSpeech}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="whisper">Whisper</Label>
                <p className="text-xs text-muted-foreground">
                  Open-source, may require separate service
                </p>
              </div>
              <Switch
                id="whisper"
                checked={enableWhisper}
                onCheckedChange={setEnableWhisper}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="default-engine">Default Engine</Label>
              <Select value={defaultEngine} onValueChange={(v) => setDefaultEngine(v as 'google' | 'whisper')}>
                <SelectTrigger id="default-engine">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="google">Google Speech-to-Text</SelectItem>
                  <SelectItem value="whisper">Whisper</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Pre-selected for teachers (they can override)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Concurrency Limits */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Concurrency Limits</CardTitle>
            <CardDescription>
              Control how many videos can be processed simultaneously
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="per-coach">Per Coach Limit</Label>
                <Input
                  id="per-coach"
                  type="number"
                  min="1"
                  max="10"
                  value={concurrencyPerCoach}
                  onChange={(e) => setConcurrencyPerCoach(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Maximum concurrent jobs per coach (1-10)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="global">Global Limit</Label>
                <Input
                  id="global"
                  type="number"
                  min="1"
                  max="50"
                  value={concurrencyGlobal}
                  onChange={(e) => setConcurrencyGlobal(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Maximum concurrent jobs system-wide (1-50)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Settings
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

