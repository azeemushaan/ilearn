/**
 * YouTube OAuth Helper Functions
 * Handles OAuth flow, token management, and YouTube API interactions
 */

import { google } from 'googleapis';

const youtube = google.youtube('v3');

export interface YouTubeOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface YouTubeTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scopes: string[];
}

export interface YouTubeChannelInfo {
  channelId: string;
  title: string;
  thumbnailUrl?: string;
}

/**
 * Get OAuth2 client instance
 */
export function getOAuth2Client(config?: YouTubeOAuthConfig) {
  const clientId = config?.clientId || process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = config?.clientSecret || process.env.YOUTUBE_CLIENT_SECRET;
  const redirectUri = config?.redirectUri || process.env.YOUTUBE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('YouTube OAuth configuration missing');
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Generate OAuth authorization URL
 */
export function getAuthorizationUrl(state?: string): string {
  const oauth2Client = getOAuth2Client();

  const scopes = [
    'https://www.googleapis.com/auth/youtube',
    'https://www.googleapis.com/auth/youtube.force-ssl',
  ];

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    state: state || '',
    prompt: 'consent', // Force consent screen to get refresh token
    // Add additional parameters for better UX
    include_granted_scopes: true,
    response_type: 'code',
  });
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<YouTubeTokens> {
  const oauth2Client = getOAuth2Client();
  
  const { tokens } = await oauth2Client.getToken(code);
  
  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error('Failed to obtain tokens from YouTube');
  }

  // tokens.expiry_date is in milliseconds (not seconds!)
  const expiresAt = tokens.expiry_date 
    ? new Date(tokens.expiry_date) 
    : new Date(Date.now() + 3600 * 1000); // Default 1 hour

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt,
    scopes: tokens.scope?.split(' ') || [],
  };
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<YouTubeTokens> {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const { credentials } = await oauth2Client.refreshAccessToken();

  if (!credentials.access_token) {
    throw new Error('Failed to refresh access token');
  }

  // credentials.expiry_date is in milliseconds (not seconds!)
  const expiresAt = credentials.expiry_date 
    ? new Date(credentials.expiry_date) 
    : new Date(Date.now() + 3600 * 1000); // Default 1 hour

  return {
    accessToken: credentials.access_token,
    refreshToken: credentials.refresh_token || refreshToken, // Use old refresh token if new one not provided
    expiresAt,
    scopes: credentials.scope?.split(' ') || [],
  };
}

/**
 * Revoke access token
 */
export async function revokeToken(accessToken: string): Promise<void> {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });
  
  await oauth2Client.revokeCredentials();
}

/**
 * List channels for authenticated user
 */
export async function listUserChannels(accessToken: string): Promise<YouTubeChannelInfo[]> {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });

  const response = await youtube.channels.list({
    auth: oauth2Client,
    part: ['snippet', 'id'],
    mine: true,
  });

  if (!response.data.items) {
    return [];
  }

  return response.data.items.map(channel => ({
    channelId: channel.id!,
    title: channel.snippet?.title || 'Unknown Channel',
    thumbnailUrl: channel.snippet?.thumbnails?.default?.url,
  }));
}

/**
 * Check if access token is expired
 */
export function isTokenExpired(expiresAt: Date): boolean {
  const now = new Date();
  // Add 5-minute buffer
  const bufferTime = 5 * 60 * 1000;
  return now.getTime() >= expiresAt.getTime() - bufferTime;
}

/**
 * Get valid access token (refresh if needed)
 */
export async function getValidAccessToken(
  accessToken: string,
  refreshToken: string,
  expiresAt: Date
): Promise<{ accessToken: string; refreshed: boolean }> {
  if (!isTokenExpired(expiresAt)) {
    return { accessToken, refreshed: false };
  }

  const newTokens = await refreshAccessToken(refreshToken);
  return { accessToken: newTokens.accessToken, refreshed: true };
}

