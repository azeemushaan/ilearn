# iLearn LMS — System Guidelines (Complete Implementation - Production Ready)

## Purpose
This document defines the **complete, production-ready system architecture** and enforced workflow for iLearn LMS — covering playlist ingestion, video processing, AI integration, credits, roles, and notifications.

**Status: ✅ FULLY IMPLEMENTED AND PRODUCTION READY**

All 27 rules have been implemented with comprehensive testing and documentation. The system includes:
- Manual video processing workflow with teacher control
- MCQ CRUD management with versioning and quality control
- YouTube OAuth integration with ownership verification
- Credit management system with transaction safety
- Real-time notifications and batch processing
- Comprehensive admin monitoring and management tools  

---

## Playlist Workflow 
1. **Adding a playlist will NOT trigger automatic video processing.**
   - Playlist ingestion only fetches metadata (titles, thumbnails, durations, etc.).
2. **Processing is manual and per-video.**
   - Each video in the assignment view has a **Process** button.
   - The coach selects caption source and language (default: English).
   - No mockups or background auto-processing are permitted.

---

## Caption Source Handling
3. **Caption Source Flow (strict priority):**
   - OAuth-based captions → SRT Upload → AI Transcription.
   - OAuth fetch allowed only if video is owned by the authenticated channel.
   - Ownership verification failure = hard error.
4. **Language Handling:**
   - Default language: English.
   - If English unavailable, fallback to first human-readable caption track.
   - Teachers can override via picker.
5. **Manual Uploads:**
   - Accept `.srt` and `.vtt` up to **200 MB**.
   - Validate timestamp integrity (reject overlapping/invalid entries).
   - Store both the raw file and parsed text transcript.

---

## AI Transcription & Credits 
6. **Credits & Billing:**
   - 1 credit = 1 minute of video.  
   - If duration < 1 minute, charge 2 credits minimum.
   - Refund credits on failure.
   - Hard block if insufficient credits (show cost and available credits before start).
7. **Credit System:**
   - Credits are assigned in **plans** by admin.
   - No post-paid usage; hard block at 0 credits.
   - Coaches see “Buy Credits” option.
8. **Transcription Engine:**
   - Supported: **Google Speech-to-Text** and **Whisper**.
   - Configurable from Admin Dashboard.
   - Punctuation enabled, diarization disabled.
   - Store all raw transcripts and confidence data.

---

## OAuth Ownership Enforcement
9. **OAuth Connection:**
   - Each coach/teacher connects their own YouTube account (no org-level token sharing).
   - On connection, prompt for which channel to link.
10. **Scopes:**
   - Use `youtube.force-ssl` or `youtube.readonly`.
   - Store refresh tokens securely (encrypted at rest).
11. **Ownership Validation:**
   - For OAuth caption fetching, verify channel ownership.
   - If the video isn’t owned, block with clear error message.

---

## Status Model & Visibility 
12. **Statuses:**
   - `not_ready` (yellow): metadata exists, not processed yet.
   - `processing` (blue): step active or queued.
   - `ready` (green): manifest built, playable by students.
   - `failed` (red): last step failed (visible to coach only).
13. **Student Visibility Rules:**
   - Students see yellow/blue/green only.
   - Red (failed) hidden from students.
   - Disabled state shown for processing/not_ready items.
   - Last known good manifest shown if failure occurs post-ready.

---

## Processing Steps 
14. **Separate Processing Buttons:**
   - Step 1: Captions.
   - Step 2: Segment transcript (60–120s chunks).
   - Step 3: Generate MCQs (1 per segment).  
   - Show console-like logs per step (success/failure messages).
   - Handle multi-language prompts (e.g., Urdu captions → English MCQs).
15. **Failure Policy:**
   - Manual **Retry** button only.
   - Retry re-runs the failed step.
   - Logs must show failure cause for audit.

---

## Dashboard Buttons & Batch Processing 
16. **Dashboard Actions:**
   - On assignments page: global “Process” with status label.
   - Works only if connected channel owns the videos.
   - Assignment detail page: per-video actions → Process / Retry / Change Source / Language.
17. **Batch Processing:**
   - Multi-select batch allowed for OAuth & AI sources.
   - SRT upload excluded from batch.
   - Admin can toggle source availability per plan.

---

##  Processing Indicators & UI Feedback 
18. **Progress Meters:**
   - Real-time badges: “Captions ✔ / Segmenting ✔ / Generating ✔ / Manifest ✔”.
   - Step-by-step feedback only (no ETA).
   - Each step logs actor, timestamp, and outcome.

---

## 9. Student Experience 
19. **Status Indicators:**
   - Playlist view: show yellow/blue/green chips; hide red.
   - “Processing” videos show message: “This video is being prepared.”
   - Only green (ready) videos are playable.

---

##  Localization & Prompt Handling 
20. **MCQ Localization:**
   - Teachers can choose MCQ language independent of caption language.
   - Language metadata passed to LLM prompt to ensure generated MCQs match selected language.

---

##  Permissions & Roles 
21. **Role Matrix:**
   - `coach` and `teacher` are identical roles.
   - Students = read-only access (status, attempts, progress only).
22. **Audit & Logging:**
   - Log every action with: actor, videoId, source, language, time, credits, and failure code.
   - Store logs in Firestore under `audit`.
   - Retain all audit records indefinitely.

---

## Billing & Plans  
23. **Plan Management:**
   - Monthly credit allotment defined by plan.
   - Unused credits rollover or expire based on plan config.
   - Admin can add/remove credits manually.
   - No post-paid model; strict blocking when credits reach zero.

---

## Rate Limits & Scaling 
24. **Concurrency & Rate Control:**
   - Configurable by admin.
   - Each coach limited to a defined concurrent job cap.
   - Blue badge shows “Processing” or “Queued” in real time.
   - Backoff/retry policy configurable globally.

---

## Data Model & Storage
25. **Firestore Schema Includes:**
   - Caption source type (`oauth|srt|ai`).
   - Language code.
   - File refs & transcript hash.
   - Credit cost & last attempt details.
   - Lock flag once ready.
   - Store all in Firestore.

---

## Notifications
26. **Notification System:**
   - In-app notifications for coaches and students.
   - Bell icon in header showing unread notifications.
   - Coaches notified for completion/failure.
   - Students notified when new videos become ready.

---

## Migration Policy
27. **Migration:**
   - No reprocessing required for existing data.
   - All current items remain valid; new features apply to new videos only.

---

## Status Colors Summary
| Status       | Color | Visibility | Description |
|---------------|--------|-------------|-------------|
| not_ready     | Yellow | All users   | Video metadata fetched; not processed |
| processing    | Blue   | All users   | Currently fetching captions/AI/MCQs |
| ready         | Green  | All users   | Manifest available; playable |
| failed        | Red    | Coach only  | Last step failed |

---

## Logging Rules
- Every step creates log entries under `/videos/{videoId}/processing/logs`.
- Each entry includes: actor, step, source, status, credits, duration, error (if any).
- Coaches can view logs from “View Status” panel.

---

## AI Execution Prompt
> You are the iLearn processing system. Enforce all 27 rules below without exceptions.  
> **Steps:** captions → segmentation → MCQ generation → manifest build.  
> **Captions Source:** must be one of (`oauth`, `srt`, `ai`).  
> Verify ownership for OAuth; validate and parse SRT; check credits before AI; refund on failure.  
> **Languages:** default English; fallback to first readable track. MCQs may use different targetLanguage.  
> **Statuses:** follow atomic transitions (`not_ready → processing → failed|ready`).  
> **Logging:** record actor, language, source, credits used/refunded, errors.  
> **Blocking:** never auto-trigger next step, never bypass checks.  
> Output structured logs and Firestore updates consistent with these rules.

---

## Compliance & QA Checklist
- [x] Ingest does not auto-process videos.
- [x] OAuth fails for non-owned videos.
- [x] English default logic verified.
- [x] SRT validation tested (overlaps rejected).
- [x] AI credit system deducts/refunds correctly.
- [x] Manual retry tested.
- [x] Multi-step logging verified.
- [x] Student gating functional.
- [x] Admin toggles respected.
- [x] Audit records generated for all transitions.
