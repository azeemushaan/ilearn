'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useFirestore, useCollection, useMemoFirebase, useFirebaseAuth } from '@/firebase';
import { collection, query, where, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { PlusCircle, Video, Loader2, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

export default function PlaylistsPage() {
  const firestore = useFirestore();
  const { claims } = useFirebaseAuth();
  const { toast } = useToast();
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [pending, startTransition] = useTransition();
  const [deletingPlaylistId, setDeletingPlaylistId] = useState<string | null>(null);

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
            description: `Playlist added with ${result.videosCreated} videos. Go to Assignment to process videos.` 
          });
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

  const handleDeletePlaylist = async (playlistId: string) => {
    if (!confirm('Are you sure you want to delete this playlist? This action cannot be undone.')) {
      return;
    }

    setDeletingPlaylistId(playlistId);
    try {
      const playlistRef = doc(firestore!, 'playlists', playlistId);
      await deleteDoc(playlistRef);
      toast({
        title: 'Success',
        description: 'Playlist deleted successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete playlist',
        variant: 'destructive',
      });
    } finally {
      setDeletingPlaylistId(null);
    }
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
                <div className="flex gap-2">
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <Link href={`/dashboard/playlists/${playlist.id}/assign`}>
                      Assign to Students
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDeletePlaylist(playlist.id)}
                    disabled={deletingPlaylistId === playlist.id}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
