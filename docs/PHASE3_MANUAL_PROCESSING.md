# Phase 3: Manual Video Processing System

## Overview

Complete implementation of teacher-controlled video processing workflow with YouTube OAuth, credit management, batch processing, AI transcription, and real-time notifications.

## What's Implemented (100%)

### Core Features
- ✅ Manual processing workflow (no auto-processing)
- ✅ YouTube OAuth with ownership verification (24h cache)
- ✅ Credit management (reserve/consume/refund)
- ✅ AI transcription (Google Speech-to-Text + Whisper)
- ✅ Batch processing with concurrency control
- ✅ Real-time notifications via Firestore listeners
- ✅ Admin dashboards (queue, credits, settings)
- ✅ Status tracking (not_ready, processing, ready, failed)

### Processing Steps
1. **Fetch Captions** - OAuth, SRT upload, or AI transcription
2. **Segment Transcript** - 60-120s chunks with validation
3. **Generate MCQs** - Gemini with strict segment grounding
4. **Build Manifest** - Cache to Cloud Storage, notify users

### Collections Added (8)
- `ownership_cache` - YouTube ownership verification
- `batch_jobs` - Batch processing tracking
- `coach_billing` - Credit balances
- `youtube_connections` - OAuth tokens
- `credit_transactions` - Transaction ledger
- `processing_logs` - Per-video step logs
- `notifications` - User notifications
- `videos/{videoId}/captions` - Caption storage

### API Endpoints (22)
See complete API documentation in this file below.

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Google Cloud Console Setup
1. Enable YouTube Data API v3
2. Enable Cloud Speech-to-Text API (for AI transcription)
3. Create OAuth 2.0 credentials
4. Add authorized redirect URI: `http://localhost:9002/api/youtube/auth/callback`

### 3. Environment Variables
Add to `.env.local`:
```env
YOUTUBE_CLIENT_ID=your_client_id.apps.googleusercontent.com
YOUTUBE_CLIENT_SECRET=your_secret
YOUTUBE_REDIRECT_URI=http://localhost:9002/api/youtube/auth/callback

# Optional: AI Transcription
GOOGLE_SPEECH_API_KEY=your_speech_api_key
WHISPER_API_URL=http://your-whisper-service.com
```

### 4. Run Migration
```bash
npm run migrate:phase3
```

### 5. Deploy Firestore Indexes
```bash
firebase deploy --only firestore:indexes
```

### 6. Start Server
```bash
npm run dev
```

## User Workflows

### Teacher Workflow
1. **Connect YouTube** (once) - Sidebar → YouTube Connection → Connect
2. **Add Playlist** - Paste URL, no auto-processing
3. **Process Videos** - Click Process button → Choose source → Select languages → Watch progress
4. **Monitor** - Notification bell shows real-time updates
5. **Handle Errors** - Retry button for failed videos

### Student Workflow
1. **View Assignments** - See only ready videos (green)
2. **Watch Videos** - Click Start → Video plays → Quiz at segments
3. **Get Notified** - Bell shows when new videos are ready

### Admin Workflow
1. **Monitor Queue** - `/admin/processing/queue` - View/cancel/prioritize jobs
2. **Manage Credits** - `/admin/credits/overview` - View balances, add credits
3. **Configure Settings** - `/admin/processing/settings` - Toggle sources, set limits

## Key Improvements

### Before Phase 3
- ❌ Auto-processing with placeholder text
- ❌ Generic/irrelevant questions
- ❌ No teacher control
- ❌ No ownership verification
- ❌ No credit tracking

### After Phase 3
- ✅ Manual processing with real captions
- ✅ Segment-specific, relevant questions
- ✅ Full teacher control (4 explicit steps)
- ✅ Ownership verified with caching
- ✅ Credit system with refunds
- ✅ Real-time notifications
- ✅ Admin monitoring dashboards

## API Documentation

### YouTube OAuth
```typescript
GET /api/youtube/auth/start?userId={userId}
POST /api/youtube/disconnect { userId }
GET /api/youtube/channels?userId={userId}
```

### Ownership
```typescript
GET /api/videos/{videoId}/ownership
POST /api/videos/{videoId}/ownership { userId }
POST /api/playlists/{playlistId}/ownership-preflight { userId }
```

### Processing
```typescript
POST /api/videos/{videoId}/captions/fetch { source, language, userId, engine? }
POST /api/videos/{videoId}/captions/upload (FormData: file, userId, language)
POST /api/videos/{videoId}/segment { userId, segmentDuration? }
POST /api/videos/{videoId}/mcq/generate { userId, targetLanguage }
POST /api/videos/{videoId}/manifest/build { userId }
GET /api/videos/{videoId}/status
```

### Credits
```typescript
GET /api/credits/balance?coachId={coachId}
POST /api/credits/reserve { coachId, amount, userId }
POST /api/credits/consume { coachId, amount, userId }
POST /api/credits/refund { coachId, amount, userId }
POST /api/admin/credits/add { coachId, amount, actorId, reason }
```

### Batch Processing
```typescript
POST /api/batch/create { type, videoIds, coachId, userId, config }
GET /api/batch/{jobId}/status
POST /api/batch/{jobId}/cancel { userId }
POST /api/batch/{jobId}/prioritize { userId, delta }
```

## Architecture Decisions

### Concurrency Control
- Per-coach limit: 1-10 (default 2)
- Global limit: 1-50 (default 10)
- Queue respects lower of both limits
- Priority ordering for queued jobs

### Credit System
- 1 credit = 1 minute video
- Minimum 2 credits for < 60s
- Reserve → Consume → Refund flow
- Transaction-safe with Firestore transactions

### Notification System
- Real-time Firestore listeners
- Tab-visibility aware (saves reads)
- Debounced updates (300ms)
- 5 notification types with deep links

### AI Transcription
- Both Google and Whisper supported
- Admin toggle to enable/disable
- Default engine configurable
- Last choice remembered per teacher

## Migration Notes

The migration script (`npm run migrate:phase3`):
- Adds new fields to existing data
- Initializes coach_billing documents
- Identifies videos with placeholder data
- Marks affected videos as `not_ready` for reprocessing

Videos with placeholder text must be reprocessed with real captions.

## Production Deployment

1. Run `npm run build` - Verify no errors
2. Deploy Firestore indexes
3. Set up YouTube OAuth in production
4. Configure production environment variables
5. Test OAuth flow
6. Test video processing end-to-end
7. Monitor processing queue and credit usage

---

**Phase 3 Complete** - All features implemented and production-ready!

