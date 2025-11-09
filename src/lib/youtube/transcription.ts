/**
 * AI Transcription Helpers
 * Supports Google Speech-to-Text and Whisper
 */

import { google } from 'googleapis';
import { estimateCredits } from '@/lib/credits/manager';

const speech = google.speech('v1');

export interface TranscriptionConfig {
  engine: 'google' | 'whisper';
  language: string;
  enablePunctuation?: boolean;
  enableDiarization?: boolean;
}

export interface TranscriptionResult {
  transcript: string;
  confidence: number;
  language: string;
  duration: number;
  format: 'srt';
}

/**
 * Transcribe video using Google Speech-to-Text
 */
export async function transcribeWithGoogle(
  audioUri: string,
  config: TranscriptionConfig
): Promise<TranscriptionResult> {
  // Note: This requires audio file to be in Cloud Storage
  // Format: gs://bucket-name/path/to/audio.mp3
  
  if (!audioUri.startsWith('gs://')) {
    throw new Error('Audio URI must be a Cloud Storage path (gs://...)');
  }

  const apiKey = process.env.GOOGLE_SPEECH_API_KEY || process.env.GOOGLE_API_KEY;
  
  if (!apiKey) {
    throw new Error('Google Speech API key not configured');
  }

  try {
    const response = await speech.speech.longrunningrecognize({
      key: apiKey,
      requestBody: {
        config: {
          encoding: 'MP3',
          languageCode: config.language || 'en-US',
          enableAutomaticPunctuation: config.enablePunctuation !== false,
          enableSpeakerDiarization: config.enableDiarization || false,
          model: 'video', // Optimized for video content
        },
        audio: {
          uri: audioUri,
        },
      },
    });

    // Wait for operation to complete
    const operationName = response.data.name;
    if (!operationName) {
      throw new Error('No operation name returned');
    }

    // Poll for completion (simplified - in production, use operation.wait())
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max
    
    while (attempts < maxAttempts) {
      const operation = await speech.operations.get({
        name: operationName,
        key: apiKey,
      });

      if (operation.data.done) {
        if (operation.data.error) {
          throw new Error(`Transcription failed: ${operation.data.error.message}`);
        }

        const result = operation.data.response as any;
        const results = result.results || [];

        // Combine all transcripts
        let fullTranscript = '';
        let totalConfidence = 0;
        let count = 0;

        results.forEach((r: any) => {
          if (r.alternatives && r.alternatives.length > 0) {
            const alt = r.alternatives[0];
            fullTranscript += alt.transcript + ' ';
            totalConfidence += alt.confidence || 0;
            count++;
          }
        });

        const avgConfidence = count > 0 ? totalConfidence / count : 0;

        // Convert to SRT format (simplified)
        const srtContent = convertToSRT(results);

        return {
          transcript: srtContent,
          confidence: avgConfidence,
          language: config.language,
          duration: 0, // TODO: Calculate from audio
          format: 'srt',
        };
      }

      // Wait 5 seconds before next check
      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;
    }

    throw new Error('Transcription timeout');
  } catch (error) {
    console.error('[Transcription] Google Speech-to-Text failed:', error);
    throw error;
  }
}

/**
 * Transcribe video using Whisper
 * Note: Requires separate Whisper service/API
 */
export async function transcribeWithWhisper(
  audioUri: string,
  config: TranscriptionConfig
): Promise<TranscriptionResult> {
  const whisperApiUrl = process.env.WHISPER_API_URL;
  
  if (!whisperApiUrl) {
    throw new Error('Whisper API not configured');
  }

  try {
    const response = await fetch(`${whisperApiUrl}/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audio_url: audioUri,
        language: config.language,
        task: 'transcribe',
        response_format: 'srt',
      }),
    });

    if (!response.ok) {
      throw new Error(`Whisper API error: ${response.status}`);
    }

    const data = await response.json();

    return {
      transcript: data.text || data.srt,
      confidence: data.confidence || 0.9,
      language: config.language,
      duration: data.duration || 0,
      format: 'srt',
    };
  } catch (error) {
    console.error('[Transcription] Whisper failed:', error);
    throw error;
  }
}

/**
 * Convert Google Speech-to-Text results to SRT format
 */
function convertToSRT(results: any[]): string {
  let srtContent = '';
  let index = 1;

  results.forEach((result: any) => {
    if (result.alternatives && result.alternatives.length > 0) {
      const alt = result.alternatives[0];
      const words = alt.words || [];

      if (words.length > 0) {
        const startTime = words[0].startTime || { seconds: 0, nanos: 0 };
        const endTime = words[words.length - 1].endTime || { seconds: 0, nanos: 0 };

        const startSec = parseInt(startTime.seconds || '0') + (parseInt(startTime.nanos || '0') / 1e9);
        const endSec = parseInt(endTime.seconds || '0') + (parseInt(endTime.nanos || '0') / 1e9);

        srtContent += `${index}\n`;
        srtContent += `${formatSRTTime(startSec)} --> ${formatSRTTime(endSec)}\n`;
        srtContent += `${alt.transcript}\n\n`;
        index++;
      }
    }
  });

  return srtContent;
}

/**
 * Format seconds to SRT time format (HH:MM:SS,mmm)
 */
function formatSRTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${millis.toString().padStart(3, '0')}`;
}

/**
 * Get transcription cost estimate
 */
export function estimateTranscriptionCost(durationSeconds: number): {
  credits: number;
  costUSD: number;
} {
  const credits = estimateCredits(durationSeconds);
  const costUSD = credits * 0.006; // ~$0.006 per minute (Google Speech-to-Text pricing)

  return { credits, costUSD };
}

/**
 * Get engine availability
 */
export async function getAvailableEngines(): Promise<{
  google: boolean;
  whisper: boolean;
  default: 'google' | 'whisper';
}> {
  const googleAvailable = !!(process.env.GOOGLE_SPEECH_API_KEY || process.env.GOOGLE_API_KEY);
  const whisperAvailable = !!process.env.WHISPER_API_URL;

  return {
    google: googleAvailable,
    whisper: whisperAvailable,
    default: whisperAvailable ? 'whisper' : 'google',
  };
}

