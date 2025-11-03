'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFirestore, useCollection, useMemoFirebase, useFirebaseAuth } from '@/firebase';
import { collection, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { PlusCircle, Video, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import Link from 'next/link';

export default function PlaylistsPage() {
  const firestore = useFirestore();
  const { claims } = useFirebaseAuth();
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [pending, startTransition] = useTransition();

  const playlistsRef = useMemoFirebase(() => {
    if (!firestore || !claims?.coachId) return null;
    return query(
      collection(firestore, 'playlists'),
      where('coachId', '==', claims.coachId)
    );
  }, [firestore, claims]);

  const { data: playlists, isLoading } = useCollection(playlistsRef);

  const handleIngestPlaylist = () => {
    if (!playlistUrl.trim()) {
      toast({ title: 'Error', description: 'Please enter a YouTube playlist URL', variant: 'destructive' });
      return;
    }

    const playlistIdMatch = playlistUrl.match(/[?&]list=([^&]+)/);
    if (!playlistIdMatch) {
      toast({ title: 'Error', description: 'Invalid YouTube playlist URL', variant: 'destructive' });
      return;
    }

    const youtubePlaylistId = playlistIdMatch[1];

    startTransition(async () => {
      try {
        const playlistsCollection = collection(firestore!, 'playlists');
        const newPlaylistRef = await addDoc(playlistsCollection, {
          coachId: claims?.coachId,
          title: 'YouTube Playlist',
          youtubePlaylistId,
          youtubePlaylistUrl: playlistUrl,
          videoCount: 0,
          status: 'pending',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        toast({ title: 'Processing...', description: 'Fetching playlist from YouTube...' });
        setPlaylistUrl('');

        // Call backend to process playlist
        const response: Response = await fetch('/api/playlists/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ youtubePlaylistId, coachId: claims?.coachId }),
        });

        const result = await response.json();

        if (response.ok) {
          toast({ 
            title: 'Success!', 
            description: `Playlist added with ${result.videosCreated} videos. Now processing videos...` 
          });

          // Trigger video preprocessing for all videos
          if (result.videoRefs && result.videoRefs.length > 0) {
            const preparationResults = await Promise.allSettled(
              result.videoRefs.map(async (videoRef: string) => {
                const preparationResponse = await fetch(`/api/videos/${videoRef}/prepare`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ forceReprocess: false }),
                });

                const payload = await preparationResponse.clone().json().catch(() => null);

                if (!preparationResponse.ok) {
                  const message = payload?.error || payload?.errorMessage || payload?.message || 'Failed to prepare video';
                  const error = new Error(`[${videoRef}] ${message}`);
                  console.error('Error processing video:', error);
                  throw error;
                }

                return payload;
              })
            );

            const failureMessages = preparationResults.reduce<string[]>((messages, result) => {
              if (result.status === 'rejected') {
                const reason = result.reason;
                messages.push(reason instanceof Error ? reason.message : String(reason));
              }
              return messages;
            }, []);

            if (failureMessages.length > 0) {
              toast({
                title: 'Video processing failed',
                description: failureMessages.join('\n'),
                variant: 'destructive',
              });
            }
          }
        } else {
          toast({ 
            title: 'Error', 
            description: result.error || 'Failed to process playlist', 
            variant: 'destructive' 
          });
        }
      } catch (error) {
        toast({ title: 'Error', description: (error as Error).message, variant: 'destructive' });
      }
    });
  };

  return (
    <div className="flex flex-1 flex-col">
      <header className="p-4 md:p-6 border-b">
        <h1 className="text-2xl font-headline font-bold">Playlists</h1>
      </header>
      <main className="flex-1 p-4 md:p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Add YouTube Playlist</CardTitle>
            <CardDescription>Paste a YouTube playlist URL to create video assignments</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="playlist-url">YouTube Playlist URL</Label>
              <Input
                id="playlist-url"
                placeholder="https://www.youtube.com/playlist?list=..."
                value={playlistUrl}
                onChange={(e) => setPlaylistUrl(e.target.value)}
              />
            </div>
            <Button onClick={handleIngestPlaylist} disabled={pending}>
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
              Add Playlist
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {isLoading && <p>Loading playlists...</p>}
          {playlists?.map((playlist: any) => (
            <Card key={playlist.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Video className="h-5 w-5" />
                  {playlist.title}
                </CardTitle>
                <CardDescription>
                  {playlist.videoCount} videos • {playlist.status}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link href={`/dashboard/playlists/${playlist.id}/assign`}>
                    Assign to Students
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
