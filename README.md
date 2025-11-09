# iLearn LMS

A modern, AI-powered Learning Management System with YouTube integration, intelligent video segmentation, and automated quiz generation.

## 🎯 Key Features

- **Manual Video Processing** - Teacher-controlled workflow with explicit steps
- **YouTube OAuth Integration** - One-time connect, ownership verification, auto caption fetch
- **AI-Generated Quizzes** - Gemini-powered MCQs with segment-specific grounding
- **Credit Management** - Transparent pricing for AI transcription (1 credit = 1 minute)
- **Batch Processing** - Process multiple videos with concurrency control
- **Real-Time Notifications** - Firestore listeners with tab-visibility awareness
- **Admin Dashboards** - Processing queue, credit overview, system settings
- **Role-Based Access** - Separate experiences for coaches, students, and admins

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Firebase project with Firestore and Storage
- Google Cloud project with YouTube Data API v3 enabled

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Firebase and YouTube OAuth credentials

# 3. Run migration (adds Phase 3 fields to existing data)
npm run migrate:phase3

# 4. Deploy Firestore indexes
firebase deploy --only firestore:indexes

# 5. Start development server
npm run dev
```

Server runs at: `http://localhost:9002`

### YouTube OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Enable **YouTube Data API v3**
3. Create **OAuth 2.0 Client ID** (Web application)
4. Add redirect URI: `http://localhost:9002/api/youtube/auth/callback`
5. Copy Client ID and Secret to `.env.local`

## 📖 Documentation

- **[Setup Guide](docs/QUICK_START.md)** - Detailed setup instructions
- **[Phase 3 Manual Processing](docs/PHASE3_MANUAL_PROCESSING.md)** - Complete feature guide
- **[Guidelines](docs/guidelines.md)** - System architecture and workflows
- **[Blueprint](docs/blueprint.md)** - Feature specifications
- **[Implementation Summary](docs/IMPLEMENTATION_SUMMARY.md)** - Development history
- **[Audit Report](docs/AUDIT_REPORT.md)** - System audit and fixes

## 🎓 User Workflows

### For Teachers
1. **Connect YouTube** (once) - Sidebar → YouTube Connection → Connect Account
2. **Add Playlist** - Paste URL, system fetches metadata only
3. **Process Videos** - Click Process → Choose source (OAuth/SRT/AI) → Select languages → Watch progress
4. **Monitor** - Notification bell shows real-time updates

### For Students
1. **View Assignments** - See only ready videos
2. **Watch Videos** - Click Start → Video plays → Quiz at segment boundaries
3. **Get Notified** - Bell alerts when new videos are ready

### For Admins
1. **Monitor Queue** - `/admin/processing/queue` - View/cancel/prioritize jobs
2. **Manage Credits** - `/admin/credits/overview` - View balances, add credits
3. **Configure** - `/admin/processing/settings` - Toggle sources, set limits

## 🏗️ Architecture

### Tech Stack
- **Frontend**: Next.js 15, React 18, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Firebase Admin SDK, Next.js API Routes
- **Database**: Firestore
- **Auth**: Firebase Authentication with custom claims
- **Storage**: Firebase Cloud Storage
- **AI**: Google Gemini 2.5 Flash, Google Speech-to-Text, Whisper
- **Video**: YouTube iframe API with embedded player

### Key Libraries
- `googleapis` - YouTube Data API and Speech-to-Text
- `genkit` - AI workflow orchestration
- `zod` - Schema validation
- `firebase-admin` - Server-side Firebase operations

## 🔐 Security

- Role-based access control (admin, coach, student)
- Custom claims for multi-tenancy
- Session cookies (HTTP-only, secure)
- Firestore security rules with coach-scoped access
- Storage rules for manifests and captions
- Audit trail for all privileged actions

## 📊 Status System

- 🟡 **not_ready** - Metadata fetched, awaiting processing
- 🔵 **processing** - Currently running a processing step
- ✅ **ready** - Manifest built, playable by students
- ❌ **failed** - Processing error (coaches only)

Students see yellow/blue/green only. Coaches see all 4 with error details.

## 💳 Credit System

- **Pricing**: 1 credit = 1 minute video (minimum 2 credits for < 60s)
- **Flow**: Reserve → Consume → Refund on failure
- **Tracking**: All transactions logged in `credit_transactions`
- **Admin**: Add credits via dashboard or API

## 🔧 Development

### Available Scripts

```bash
npm run dev          # Start development server (port 9002)
npm run build        # Build for production
npm run lint         # Run ESLint
npm run typecheck    # TypeScript type checking
npm run test         # Run tests

# Database
npm run seed         # Seed initial data
npm run migrate:phase3  # Run Phase 3 migration

# Admin
npm run create-admin # Create admin user
```

### Project Structure

```
src/
├── app/              # Next.js App Router pages
│   ├── api/          # API routes (22 endpoints)
│   ├── dashboard/    # Teacher/student dashboards
│   └── admin/        # Admin dashboards
├── components/       # React components
│   ├── ui/           # shadcn/ui components
│   └── video/        # Video-specific components
├── lib/              # Utility libraries
│   ├── youtube/      # YouTube OAuth, captions, transcription
│   ├── credits/      # Credit management
│   ├── batch/        # Batch processing
│   └── notifications/ # Notification system
└── firebase/         # Firebase client setup
```

## 🐛 Troubleshooting

### npm install fails
- Check Node.js version (18+ required)
- Try `npm install --legacy-peer-deps`
- Clear cache: `rm -rf node_modules package-lock.json && npm install`

### OAuth not working
- Verify redirect URI in Google Cloud Console matches exactly
- Check credentials in `.env.local`
- Ensure YouTube Data API v3 is enabled

### Videos show placeholder questions
- Run migration: `npm run migrate:phase3`
- Reprocess affected videos with real captions
- Check processing logs for errors

### Firestore permission denied
- Deploy security rules: `firebase deploy --only firestore:rules`
- Check user has correct role claim
- Verify coach ID is set correctly

## 📝 License

Proprietary - iLearn LMS

## 🤝 Support

For issues or questions:
1. Check documentation in `docs/` folder
2. Review Firebase Console logs
3. Check processing logs via admin dashboard
4. Contact support team

---

**Built with ❤️ for iLearn**

Version: Phase 3 (Manual Processing System)
Last Updated: November 2025
