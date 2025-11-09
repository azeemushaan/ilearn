# **App Name**: iLearn

## Core Features:

- **Manual Video Processing Workflow**: Teachers have full control over video processing with explicit steps:
  - Playlist ingestion fetches metadata only (no auto-processing)
  - Per-video processing via dedicated buttons
  - Four sequential steps: Fetch Captions → Segment Transcript → Generate MCQs → Build Manifest
  - Each step has clear success/failure feedback with detailed logging

- **YouTube OAuth Integration**: One-time OAuth connection per teacher:
  - Multi-channel support (teachers can connect multiple YouTube accounts)
  - Ownership verification with 24h caching to reduce API calls
  - Batch ownership preflight for playlists
  - Smart defaults based on ownership status

- **Caption Source Management**: Three explicit caption sources with priority:
  1. **OAuth** (YouTube-owned videos only): Automatic caption fetch with language selection
  2. **SRT Upload**: Manual upload with validation (max 200MB, timestamp integrity, overlap detection)
  3. **AI Transcription**: Credit-based transcription (Google Speech-to-Text or Whisper)

- **Credit Management System**: Predictable, transparent credit system:
  - 1 credit = 1 minute of video (minimum 2 credits for videos < 60 seconds)
  - Reserve → Consume → Refund transaction flow
  - Credit preview before AI transcription
  - Automatic refund on processing failures
  - Admin-configurable monthly allotments per plan

- **Status Tracking & Visibility**: Four-state status system:
  - `not_ready` (yellow): Metadata fetched, awaiting processing
  - `processing` (blue): Currently running a processing step
  - `ready` (green): Manifest built, playable by students
  - `failed` (red): Processing error (visible to coaches only)
  - Real-time status polling for progress updates

- **Intelligent Video Pauses**: The player automatically pauses at segment boundaries (~60–120s chunks) determined by transcript-based semantic segmentation.

- **AI-Generated Quizzes**: Gemini-powered MCQ generation with strict segment-based grounding:
  - 1-3 questions per segment
  - Questions must quote transcript text in rationale
  - Rejects placeholder or insufficient content
  - Configurable difficulty and language

- **Cached Video Manifests**: Pre-generated JSON manifests in Cloud Storage containing all segment/question data, served via `/api/videos/[videoId]/manifest` endpoint to reduce Firestore reads.

- **Secure Quiz Recording**: Server-side attempt validation via client-side Firestore writes with enrollment verification and automatic progress tracking.

- **Progress Tracking**: Monitor student progress through assigned videos, tracking watch percentage, quiz scores, and completion status.

- **Coach Dashboard**: Dashboard for teachers to manage playlists, assignments, video processing, and student progress with fine-grained control over each processing step.

- **Anti-Skip Controls**: Prevent students from skipping content with playback position tracking and rewind on manual seeking.

- **Comprehensive Logging**: Every processing step logged with actor, timestamp, credits, duration, and error details. Viewable per-video and per-batch.

- **Hardened Security**: Enhanced Firestore and Storage rules preventing data enumeration, enforcing coach-scoped access, and requiring proper authentication.

## Style Guidelines:

- Primary color: Dark blue (#24305E), lending a professional and trustworthy feel, aligning with educational platforms.
- Background color: Light blue (#F0F4FF), a desaturated version of the primary, providing a clean and modern backdrop.
- Accent color: A vibrant shade of purple (#9370DB), to add emphasis to CTAs and highlight key information.
- Body and headline font: 'Inter', a grotesque-style sans-serif, to create a modern, machined, objective, neutral look.
- Use clear and concise icons to represent different features and actions.
- Modern UI/UX design similar to platforms like Loom, Notion, or Linear with soft shadows, rounded corners, and a focus on whitespace.
- Subtle animations on scroll, and transitions on key interactions
