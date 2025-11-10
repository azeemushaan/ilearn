'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUser, useFirebaseAuth } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Youtube, CheckCircle2, XCircle, RefreshCw, Loader2, ExternalLink, List, Plus } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface YouTubeChannel {
  channelId: string;
  title: string;
  thumbnailUrl?: string;
}

interface ConnectionStatus {
  connected: boolean;
  channels: YouTubeChannel[];
  expiresAt?: string;
}

interface YouTubePlaylist {
  playlistId: string;
  title: string;
  description: string;
  thumbnailUrl?: string;
  videoCount: number;
  reportedVideoCount?: number;
  privacyStatus: string;
  channelId?: string;
  channelTitle?: string;
  publishedAt?: string;
}

interface PlaylistsStatus {
  connected: boolean;
  playlists: YouTubePlaylist[];
  totalResults?: number;
}

export default function YouTubeConnectionPage() {
  const { user } = useUser();
  const { claims } = useFirebaseAuth();
  const { toast } = useToast();
  
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [playlistsStatus, setPlaylistsStatus] = useState<PlaylistsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [fetchingPlaylists, setFetchingPlaylists] = useState(false);

  // Check for OAuth callback results in URL
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    
    if (params.get('youtube_connected') === 'true') {
      const channelCount = params.get('channel_count') || '0';
      toast({
        title: 'YouTube Connected!',
        description: `Successfully connected ${channelCount} channel(s)`,
      });
      // Clean URL
      window.history.replaceState({}, '', '/dashboard/youtube');
    }

    if (params.get('youtube_error') === 'true') {
      toast({
        title: 'Connection Failed',
        description: 'Failed to connect YouTube account. Please try again or check your permissions.',
        variant: 'destructive',
      });
      // Clean URL
      window.history.replaceState({}, '', '/dashboard/youtube');
    }
  }, [toast]);

  // Fetch connection status
  const fetchConnectionStatus = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/youtube/channels?userId=${user.uid}`);
      const data = await response.json();

      setConnectionStatus(data);
    } catch (error) {
      console.error('Failed to fetch YouTube connection:', error);
      toast({
        title: 'Error',
        description: 'Failed to check YouTube connection status',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch YouTube playlists
  const fetchPlaylists = async () => {
    if (!user) return;

    try {
      setFetchingPlaylists(true);
      const response = await fetch(`/api/youtube/playlists?userId=${user.uid}`);
      const data = await response.json();

      setPlaylistsStatus(data);
    } catch (error) {
      console.error('Failed to fetch YouTube playlists:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch YouTube playlists',
        variant: 'destructive',
      });
    } finally {
      setFetchingPlaylists(false);
    }
  };

  useEffect(() => {
    fetchConnectionStatus();
  }, [user]);

  // Handle OAuth connection
  const handleConnect = async () => {
    if (!user) return;

    try {
      setConnecting(true);

      // Get OAuth URL
      const response = await fetch(`/api/youtube/auth/start?userId=${user.uid}`);
      const data = await response.json();

      if (!data.authUrl) {
        throw new Error('Failed to get authorization URL');
      }

      // Open popup window
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const popup = window.open(
        data.authUrl,
        'youtube-oauth',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,location=no`
      );

      // Poll for popup close or callback
      const pollTimer = setInterval(() => {
        if (popup?.closed) {
          clearInterval(pollTimer);
          setConnecting(false);
          
          // Refresh connection status
          setTimeout(() => {
            fetchConnectionStatus();
          }, 1000);
        }
      }, 500);

      // Timeout after 5 minutes
      setTimeout(() => {
        clearInterval(pollTimer);
        if (popup && !popup.closed) {
          popup.close();
        }
        setConnecting(false);
      }, 5 * 60 * 1000);

    } catch (error) {
      console.error('Failed to connect YouTube:', error);
      toast({
        title: 'Connection Failed',
        description: error instanceof Error ? error.message : 'Failed to connect YouTube',
        variant: 'destructive',
      });
      setConnecting(false);
    }
  };

  // Handle disconnect
  const handleDisconnect = async () => {
    if (!user) return;

    try {
      setDisconnecting(true);

      const response = await fetch('/api/youtube/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Disconnected',
          description: 'YouTube account disconnected successfully',
        });
        
        setConnectionStatus({ connected: false, channels: [] });
        setPlaylistsStatus(null);
      } else {
        throw new Error(data.message || 'Failed to disconnect');
      }
    } catch (error) {
      console.error('Failed to disconnect YouTube:', error);
      toast({
        title: 'Disconnect Failed',
        description: error instanceof Error ? error.message : 'Failed to disconnect YouTube',
        variant: 'destructive',
      });
    } finally {
      setDisconnecting(false);
    }
  };

  // Import a YouTube playlist
  const handleImportPlaylist = async (playlist: YouTubePlaylist) => {
    if (!user) return;

    try {
      const response = await fetch('/api/playlists/import-youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          coachId: claims?.coachId || user.uid,
          playlistId: playlist.playlistId,
          playlistTitle: playlist.title,
          playlistDescription: playlist.description,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Playlist Imported!',
          description: `Successfully imported "${playlist.title}" with ${data.videoCount} videos`,
        });
      } else {
        throw new Error(data.message || 'Failed to import playlist');
      }
    } catch (error) {
      console.error('Failed to import playlist:', error);
      toast({
        title: 'Import Failed',
        description: error instanceof Error ? error.message : 'Failed to import playlist',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">YouTube Connection</h1>
            <p className="text-muted-foreground mt-1">
              Connect your YouTube account to fetch captions automatically
            </p>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">YouTube Integration</h1>
          <p className="text-muted-foreground mt-1">
            Connect your YouTube account and import playlists directly
          </p>
        </div>
      </div>

      <Tabs defaultValue="connection" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="connection">Connection</TabsTrigger>
          <TabsTrigger value="playlists">My Playlists</TabsTrigger>
        </TabsList>

        <TabsContent value="connection" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
        {/* Connection Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Youtube className="h-5 w-5" />
              Connection Status
            </CardTitle>
            <CardDescription>
              {connectionStatus?.connected 
                ? 'Your YouTube account is connected' 
                : 'Connect your YouTube account to enable OAuth caption fetching'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {connectionStatus?.connected ? (
              <>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="font-medium">Connected</span>
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {connectionStatus.channels.length} channel(s) connected
                  </p>
                  
                  {connectionStatus.expiresAt && (
                    <p className="text-xs text-muted-foreground">
                      Token expires: {new Date(connectionStatus.expiresAt).toLocaleDateString()}
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={fetchConnectionStatus}
                    variant="outline"
                    size="sm"
                    disabled={loading}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                  <Button
                    onClick={handleDisconnect}
                    variant="destructive"
                    size="sm"
                    disabled={disconnecting}
                  >
                    {disconnecting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <XCircle className="h-4 w-4 mr-2" />
                    )}
                    Disconnect
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium text-muted-foreground">Not Connected</span>
                </div>
                
                <p className="text-sm text-muted-foreground">
                  Connect your YouTube account to automatically fetch captions for videos you own.
                </p>

                <Button
                  onClick={handleConnect}
                  disabled={connecting}
                  className="w-full"
                >
                  {connecting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Connecting to YouTube...
                    </>
                  ) : (
                    <>
                      <Youtube className="h-4 w-4 mr-2" />
                      Connect YouTube Account
                    </>
                  )}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Connected Channels Card */}
        {connectionStatus?.connected && connectionStatus.channels.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Connected Channels</CardTitle>
              <CardDescription>
                These channels can be used for OAuth caption fetching
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {connectionStatus.channels.map((channel) => (
                  <div
                    key={channel.channelId}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                  >
                    {channel.thumbnailUrl && (
                      <img
                        src={channel.thumbnailUrl}
                        alt={channel.title}
                        className="h-10 w-10 rounded-full"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{channel.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {channel.channelId}
                      </p>
                    </div>
                    <Badge variant="secondary">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Active
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* How It Works Card */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>How OAuth Caption Fetching Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    1
                  </div>
                  <h4 className="font-medium">Connect Once</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Connect your YouTube account one time. We'll remember your channels.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    2
                  </div>
                  <h4 className="font-medium">Ownership Verified</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  When processing videos, we verify you own them. Results cached for 24 hours.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    3
                  </div>
                  <h4 className="font-medium">Auto-Fetch Captions</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  For owned videos, captions are fetched automatically. No manual upload needed.
                </p>
              </div>
            </div>

            <Alert>
              <AlertDescription>
                <strong>Privacy:</strong> We only access caption data for videos you own.
                Tokens are stored securely and can be revoked anytime.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
          </div>
        </TabsContent>

        <TabsContent value="playlists" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <List className="h-5 w-5" />
                Your YouTube Playlists
              </CardTitle>
              <CardDescription>
                Import playlists directly from your YouTube channel. This also verifies your OAuth connection.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {connectionStatus?.connected ? (
                <>
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-muted-foreground">
                      Found {playlistsStatus?.playlists?.length || 0} playlists on your channel
                    </p>
                    <Button
                      onClick={fetchPlaylists}
                      disabled={fetchingPlaylists}
                      variant="outline"
                      size="sm"
                    >
                      {fetchingPlaylists ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Refresh Playlists
                    </Button>
                  </div>

                  {playlistsStatus?.playlists && playlistsStatus.playlists.length > 0 ? (
                    <div className="space-y-3">
                      {playlistsStatus.playlists.map((playlist) => (
                        <div
                          key={playlist.playlistId}
                          className="flex items-center gap-4 p-4 rounded-lg border bg-card"
                        >
                          {playlist.thumbnailUrl && (
                            <img
                              src={playlist.thumbnailUrl}
                              alt={playlist.title}
                              className="h-16 w-16 rounded object-cover"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium truncate">{playlist.title}</h4>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {playlist.description || 'No description'}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="secondary">
                                {playlist.videoCount} videos
                              </Badge>
                              <Badge variant="outline">
                                {playlist.privacyStatus}
                              </Badge>
                              {playlist.publishedAt && (
                                <span className="text-xs text-muted-foreground">
                                  Created {new Date(playlist.publishedAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                          <Button
                            onClick={() => handleImportPlaylist(playlist)}
                            size="sm"
                            className="shrink-0"
                            disabled={playlist.videoCount === 0}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Import {playlist.videoCount > 0 ? `(${playlist.videoCount})` : ''}
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      {fetchingPlaylists ? (
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="h-5 w-5 animate-spin" />
                          <span>Loading playlists...</span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-muted-foreground">No playlists found</p>
                          <Button onClick={fetchPlaylists} variant="outline">
                            Fetch Playlists
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <Alert>
                  <AlertDescription>
                    <Youtube className="h-4 w-4" />
                    Connect your YouTube account first to view and import your playlists.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

