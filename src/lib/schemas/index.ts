import { Timestamp } from 'firebase/firestore';
import { z } from 'zod';

const timestampSchema = z.union([
  z.instanceof(Date),
  z.instanceof(Timestamp),
  z.object({ seconds: z.number(), nanoseconds: z.number() }),
  z.number().transform((value) => new Date(value)),
]);

const nullableTimestamp = timestampSchema.nullish().transform((value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if ('seconds' in value && 'nanoseconds' in value) {
    return new Date(value.seconds * 1000 + value.nanoseconds / 1_000_000);
  }
  return value as Date;
});

export const coachSchema = z.object({
  displayName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().nullish(),
  brand: z.object({
    name: z.string().min(1),
    logoUrl: z.string().url().nullish(),
    color: z.string().regex(/^#([0-9a-fA-F]{3}){1,2}$/).nullish(),
  }).optional(),
  plan: z.object({
    tier: z.enum(['free', 'pro', 'enterprise']),
    seats: z.number().int().min(0),
    expiresAt: nullableTimestamp,
  }).optional(),
  settings: z.object({
    locale: z.enum(['en', 'ur']).default('en'),
    lowBandwidthDefault: z.boolean().default(false),
  }).optional(),
  createdAt: nullableTimestamp,
  updatedAt: nullableTimestamp,
});

export type Coach = z.infer<typeof coachSchema> & { id: string };

export const userSchema = z.object({
  coachId: z.string().min(1),
  role: z.enum(['admin', 'coach', 'student']),
  profile: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    photoUrl: z.string().url().nullish().or(z.literal('')),
  }),
  status: z.enum(['active', 'invited', 'disabled']).default('invited'),
  createdAt: nullableTimestamp,
  updatedAt: nullableTimestamp,
});

export type CoachUser = z.infer<typeof userSchema> & { id: string };

export const planSchema = z.object({
  name: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  priceUSD: z.number().nonnegative(),
  maxStudents: z.number().int().min(1),
  maxPlaylists: z.number().int().min(1),
  enableQuizGeneration: z.boolean().default(false),
  enableProgressTracking: z.boolean().default(false),
  enableAntiSkip: z.boolean().default(false),
  enableCustomBranding: z.boolean().default(false),
  enableAPIAccess: z.boolean().default(false),
  enablePrioritySupport: z.boolean().default(false),
  concurrency: z
    .object({
      perCoach: z.number().int().min(1),
      global: z.number().int().min(1),
    })
    .optional(),
  isActive: z.boolean().default(true),
  sort: z.number().int().default(0),
  createdAt: nullableTimestamp,
  updatedAt: nullableTimestamp,
});

export type Plan = z.infer<typeof planSchema> & { id: string };

export const aiProviderSchema = z.enum(['google', 'openai', 'anthropic']);

export type AiProvider = z.infer<typeof aiProviderSchema>;

export const promptTemplateSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullish(),
  content: z.string().min(1),
  active: z.boolean().default(false),
  createdAt: nullableTimestamp,
  updatedAt: nullableTimestamp,
});

export type PromptTemplate = z.infer<typeof promptTemplateSchema> & { id: string };

export const subscriptionSchema = z.object({
  coachId: z.string().min(1),
  planId: z.string().min(1),
  maxStudents: z.number().int().min(1),
  paymentId: z.string().nullish(),
  status: z.enum(['active', 'past_due', 'canceled', 'awaiting_payment']),
  currentPeriodEnd: nullableTimestamp,
  createdAt: nullableTimestamp,
  updatedAt: nullableTimestamp,
});

export type Subscription = z.infer<typeof subscriptionSchema> & { id: string };

export const paymentSchema = z.object({
  coachId: z.string().min(1),
  amount: z.number().nonnegative(),
  currency: z.enum(['PKR', 'USD']),
  method: z.enum(['manual_bank', 'card', 'waiver']),
  status: z.enum(['pending', 'approved', 'rejected']),
  reference: z.string().min(1).nullish(),
  bankSlipUrl: z.string().url().nullish(),
  notes: z.string().max(2000).nullish(),
  reviewedBy: z.string().nullish(),
  reviewedAt: nullableTimestamp,
  createdAt: nullableTimestamp,
  updatedAt: nullableTimestamp,
});

export type Payment = z.infer<typeof paymentSchema> & { id: string };

export const invoiceSchema = z.object({
  coachId: z.string().min(1),
  items: z.array(z.object({
    label: z.string().min(1),
    amount: z.number().nonnegative(),
  })).min(1),
  total: z.number().nonnegative(),
  currency: z.enum(['PKR', 'USD']),
  status: z.enum(['draft', 'sent', 'paid', 'void']),
  dueAt: nullableTimestamp,
  createdAt: nullableTimestamp,
});

export type Invoice = z.infer<typeof invoiceSchema> & { id: string };

export const auditSchema = z.object({
  coachId: z.string().nullish(),
  actorId: z.string().min(1),
  action: z.string().min(1),
  target: z.object({
    collection: z.string().min(1),
    id: z.string().min(1),
  }),
  meta: z.record(z.any()).nullish(),
  ts: nullableTimestamp,
});

export type AuditEvent = z.infer<typeof auditSchema> & { id: string };

export const coachSubscriptionSchema = z.object({
  userId: z.string().min(1),
  planRef: z.string().min(1),
  createdAt: nullableTimestamp,
  updatedAt: nullableTimestamp,
});

export type LegacycoachSubscription = z.infer<typeof coachSubscriptionSchema> & { id: string };

export const createTimestamp = () => new Date();

export type EntityWithTimestamps<T> = T & {
  createdAt: Date | null;
  updatedAt: Date | null;
};

const aiRuntimeSchema = z
  .object({
    temperature: z.number().min(0).max(2).optional(),
    maxOutputTokens: z.number().int().positive().optional(),
    topP: z.number().min(0).max(1).optional(),
    topK: z.number().int().min(0).optional(),
    stopSequences: z.array(z.string()).optional(),
    presencePenalty: z.number().optional(),
    frequencyPenalty: z.number().optional(),
  })
  .passthrough();

export const defaultAiSettings = {
  provider: 'googleai',
  model: 'googleai/gemini-2.5-flash',
  runtime: {},
  requestHeaders: {},
} as const;

export const aiSettingsSchema = z
  .object({
    provider: z.string().min(1).default(defaultAiSettings.provider),
    model: z.string().min(1).default(defaultAiSettings.model),
    baseUrl: z.string().url().optional(),
    apiKeySecret: z.string().min(1).optional(),
    apiKeyHash: z.string().optional(),
    apiKeyUpdatedAt: nullableTimestamp,
    runtime: aiRuntimeSchema.default({}),
    requestHeaders: z.record(z.string()).default({}),
  })
  .default(defaultAiSettings);

export type AiRuntimeOptions = z.infer<typeof aiRuntimeSchema>;
export type AiSettings = z.infer<typeof aiSettingsSchema>;

export const systemBrandingSchema = z
  .object({
    logoUrl: z.string().url().nullish().or(z.literal('')),
    primaryColor: z.string().regex(/^#([0-9a-fA-F]{3}){1,2}$/).nullish().or(z.literal('')),
    secondaryColor: z.string().regex(/^#([0-9a-fA-F]{3}){1,2}$/).nullish().or(z.literal('')),
  })
  .default({});

const processingSettingsSchema = z
  .object({
    concurrency: z
      .object({
        perCoach: z.number().int().min(1).default(2),
        global: z.number().int().min(1).default(10),
      })
      .default({ perCoach: 2, global: 10 }),
    jobHeartbeatTimeoutSec: z.number().int().min(30).default(300),
  })
  .default({ concurrency: { perCoach: 2, global: 10 }, jobHeartbeatTimeoutSec: 300 });

const systemSettingsBaseSchema = z.object({
  manualPaymentsEnabled: z.boolean().default(true),
  supportEmail: z.string().email().default('support@example.com'),
  branding: systemBrandingSchema,
  ai: aiSettingsSchema,
  processing: processingSettingsSchema,
});

export const systemSettingsSchema = systemSettingsBaseSchema.default({
  manualPaymentsEnabled: true,
  supportEmail: 'support@example.com',
  branding: {},
  ai: defaultAiSettings,
  processing: { concurrency: { perCoach: 2, global: 10 }, jobHeartbeatTimeoutSec: 300 },
});

export const systemSettingsUpdateSchema = systemSettingsBaseSchema.partial();

export type SystemSettings = z.infer<typeof systemSettingsSchema>;

// Core LMS schemas for YouTube playlist assignments

export const playlistSchema = z.object({
  coachId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  youtubePlaylistId: z.string().min(1),
  youtubePlaylistUrl: z.string().url(),
  videoCount: z.number().int().min(0).default(0),
  status: z.enum(['pending', 'processing', 'ready', 'error']).default('pending'),
  createdAt: nullableTimestamp,
  updatedAt: nullableTimestamp,
});

export type Playlist = z.infer<typeof playlistSchema> & { id: string };

export const videoSchema = z.object({
  playlistId: z.string().min(1),
  coachId: z.string().min(1),
  youtubeVideoId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  duration: z.number().int().min(0),
  thumbnailUrl: z.string().url().optional(),
  hasCaptions: z.boolean().default(false),
  chaptersOnly: z.boolean().default(false),
  status: z.enum(['pending', 'processing', 'ready', 'error']).default('pending'),
  segmentCount: z.number().int().min(0).default(0),
  createdAt: nullableTimestamp,
  updatedAt: nullableTimestamp,
});

export type Video = z.infer<typeof videoSchema> & { id: string };

export const segmentSchema = z.object({
  coachId: z.string().min(1),
  videoId: z.string().min(1),
  tStartSec: z.number().min(0),
  tEndSec: z.number().min(0),
  textChunk: z.string().optional(),
  textChunkHash: z.string().optional(),
  summary: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  questionCount: z.number().int().min(0).default(0),
  createdAt: nullableTimestamp,
});

export type Segment = z.infer<typeof segmentSchema> & { id: string };

export const questionSchema = z.object({
  coachId: z.string().min(1),
  segmentId: z.string().min(1),
  videoId: z.string().min(1),
  stem: z.string().min(1),
  options: z.array(z.string()).length(4),
  correctIndex: z.number().int().min(0).max(3),
  rationale: z.string().optional(),
  tags: z.array(z.string()).default([]),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  createdAt: nullableTimestamp,
});

export type Question = z.infer<typeof questionSchema> & { id: string };

export const assignmentSchema = z.object({
  coachId: z.string().min(1),
  playlistId: z.string().min(1),
  studentIds: z.array(z.string()).default([]),
  title: z.string().min(1),
  startAt: nullableTimestamp,
  endAt: nullableTimestamp,
  rules: z.object({
    watchPct: z.number().min(0).max(100).default(80),
    minScore: z.number().min(0).max(100).default(70),
    antiSkip: z.boolean().default(true),
    attemptLimit: z.number().int().min(1).default(3),
  }).optional(),
  createdAt: nullableTimestamp,
  updatedAt: nullableTimestamp,
});

export type Assignment = z.infer<typeof assignmentSchema> & { id: string };

export const attemptSchema = z.object({
  studentId: z.string().min(1),
  assignmentId: z.string().min(1).nullable(),
  questionId: z.string().min(1),
  segmentId: z.string().min(1),
  videoId: z.string().min(1),
  chosenIndex: z.number().int().min(0).max(3),
  isCorrect: z.boolean(),
  segmentIndex: z.number().int().min(0).optional(),
  latencyMs: z.number().int().min(0).optional(),
  ts: nullableTimestamp,
});

export type Attempt = z.infer<typeof attemptSchema> & { id: string };

export const progressSchema = z.object({
  studentId: z.string().min(1),
  assignmentId: z.string().min(1).nullable(),
  videoId: z.string().min(1),
  watchPct: z.number().min(0).max(100).default(0),
  score: z.number().min(0).max(100).default(0),
  attempts: z.number().int().min(0).default(0),
  correctAttempts: z.number().int().min(0).default(0),
  lastSegmentId: z.string().optional(),
  lastActivityAt: nullableTimestamp,
  completedAt: nullableTimestamp,
  segmentsCompleted: z.array(z.string()).default([]),
  lastVerifiedTimeSec: z.number().min(0).default(0),
  questionHistory: z.record(z.array(z.string())).default({}),
  createdAt: nullableTimestamp,
  updatedAt: nullableTimestamp,
});

export type Progress = z.infer<typeof progressSchema> & { id: string };

export const invitationSchema = z.object({
  coachId: z.string().min(1),
  email: z.string().email(),
  status: z.enum(['pending', 'accepted', 'expired']).default('pending'),
  inviteCode: z.string().min(6),
  expiresAt: nullableTimestamp,
  acceptedAt: nullableTimestamp,
  createdAt: nullableTimestamp,
});

export type Invitation = z.infer<typeof invitationSchema> & { id: string };

// Video manifest schemas for cached segment/question data
export const manifestQuestionSchema = z.object({
  questionId: z.string(),
  stem: z.string(),
  options: z.tuple([z.string(), z.string(), z.string(), z.string()]),
  correctIndex: z.number().int().min(0).max(3),
  rationale: z.string().optional(),
  support: z
    .array(
      z.object({
        tStartSec: z.number().min(0),
        tEndSec: z.number().min(0),
        text: z.string(),
      })
    )
    .default([]),
  language: z.string().default('en'),
});

export const manifestSegmentSchema = z.object({
  segmentId: z.string(),
  segmentIndex: z.number().int().min(0),
  title: z.string(),
  language: z.string().default('en'),
  tStartSec: z.number().min(0),
  tEndSec: z.number().min(0),
  durationSec: z.number().min(0),
  questions: z.array(manifestQuestionSchema).max(1),
});

export const videoManifestSchema = z.object({
  videoId: z.string(),
  youtubeVideoId: z.string(),
  title: z.string(),
  duration: z.number().int().min(0),
  status: z.enum(['ready', 'processing', 'error']),
  hasCaptions: z.boolean(),
  chaptersOnly: z.boolean(),
  segments: z.array(manifestSegmentSchema),
  totalSegments: z.number().int().min(0),
  totalQuestions: z.number().int().min(0),
  generatedAt: z.string(), // ISO timestamp
  version: z.string().default('2.0'),
});

export type ManifestSegment = z.infer<typeof manifestSegmentSchema>;
export type ManifestQuestion = z.infer<typeof manifestQuestionSchema>;
export type VideoManifest = z.infer<typeof videoManifestSchema>;

// Manual Processing System Schemas

// Ownership cache for YouTube channel verification
export const ownershipCacheSchema = z.object({
  videoId: z.string().min(1),
  channelId: z.string().min(1).optional(),
  owned: z.boolean(),
  verifiedAt: nullableTimestamp,
  userId: z.string().min(1), // Teacher who connected the channel
  ttlHours: z.number().int().default(24),
});

export type OwnershipCache = z.infer<typeof ownershipCacheSchema> & { id: string };

// Batch job tracking for processing operations
export const batchJobSchema = z.object({
  type: z.enum(['captions', 'segment', 'mcq', 'manifest', 'full']),
  videoIds: z.array(z.string()).min(1),
  coachId: z.string().min(1),
  createdBy: z.string().min(1), // Teacher userId
  config: z.object({
    captionSource: z.enum(['oauth', 'srt', 'ai']).optional(),
    captionLanguage: z.string().optional(),
    mcqLanguage: z.string().optional(),
    engine: z.enum(['google', 'whisper']).optional(),
  }).optional(),
  status: z.enum(['queued', 'running', 'completed', 'failed', 'cancelled']).default('queued'),
  progress: z.object({
    total: z.number().int().min(0),
    completed: z.number().int().min(0),
    failed: z.number().int().min(0),
    running: z.number().int().min(0),
  }),
  statusByVideo: z.record(z.enum(['queued', 'running', 'completed', 'failed'])),
  reservedCredits: z.number().int().min(0).default(0),
  consumedCredits: z.number().int().min(0).default(0),
  createdAt: nullableTimestamp,
  startedAt: nullableTimestamp,
  completedAt: nullableTimestamp,
});

export type BatchJob = z.infer<typeof batchJobSchema> & { id: string };

// Credit transaction for billing
export const creditTransactionSchema = z.object({
  coachId: z.string().min(1),
  type: z.enum(['allotment', 'purchase', 'reserve', 'consume', 'refund', 'release', 'adjustment']),
  amount: z.number().int(),
  videoId: z.string().optional(),
  batchJobId: z.string().optional(),
  reason: z.string().optional(),
  balanceBefore: z.number().int().min(0),
  balanceAfter: z.number().int().min(0),
  actorId: z.string().min(1),
  createdAt: nullableTimestamp,
});

export type CreditTransaction = z.infer<typeof creditTransactionSchema> & { id: string };

// Coach billing for credit management
export const coachBillingSchema = z.object({
  coachId: z.string().min(1),
  balance: z.number().int().min(0).default(0),
  reservedCredits: z.number().int().min(0).default(0),
  monthlyAllotment: z.number().int().min(0).default(0),
  rolloverEnabled: z.boolean().default(false),
  lastAllotmentDate: nullableTimestamp,
  updatedAt: nullableTimestamp,
});

export type CoachBilling = z.infer<typeof coachBillingSchema> & { id: string };

// YouTube connection for OAuth
export const youtubeChannelSchema = z.object({
  channelId: z.string().min(1),
  title: z.string().min(1),
  thumbnailUrl: z.string().url().optional(),
  connectedAt: nullableTimestamp,
});

export const youtubeConnectionSchema = z.object({
  userId: z.string().min(1),
  coachId: z.string().min(1),
  channels: z.array(youtubeChannelSchema).default([]),
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresAt: nullableTimestamp,
  scopes: z.array(z.string()).default([]),
  createdAt: nullableTimestamp,
  updatedAt: nullableTimestamp,
});

export type YouTubeChannel = z.infer<typeof youtubeChannelSchema>;
export type YouTubeConnection = z.infer<typeof youtubeConnectionSchema> & { id: string };

// Processing log for video-level tracking
export const processingLogSchema = z.object({
  videoId: z.string().min(1),
  batchJobId: z.string().optional(),
  step: z.enum(['caption_fetch', 'segment', 'mcq_generate', 'manifest_build']),
  status: z.enum(['started', 'completed', 'failed']),
  actor: z.string().min(1),
  metadata: z.object({
    source: z.string().optional(),
    language: z.string().optional(),
    credits: z.number().int().optional(),
    duration: z.number().int().optional(), // milliseconds
    error: z.string().optional(),
    errorCode: z.string().optional(),
  }).optional(),
  timestamp: nullableTimestamp,
});

export type ProcessingLog = z.infer<typeof processingLogSchema> & { id: string };

// Notification for user alerts
export const notificationSchema = z.object({
  userId: z.string().min(1),
  type: z.enum(['coach_video_ready', 'coach_video_failed', 'coach_batch_complete', 'student_video_ready', 'oauth_expired']),
  title: z.string().min(1),
  message: z.string().min(1),
  actionUrl: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  read: z.boolean().default(false),
  createdAt: nullableTimestamp,
});

export type Notification = z.infer<typeof notificationSchema> & { id: string };

// Updated video schema with manual processing fields
export const videoSchemaExtended = videoSchema.extend({
  captionSource: z.enum(['oauth', 'srt', 'ai', 'unknown']).default('unknown'),
  captionLanguage: z.string().optional(),
  mcqLanguage: z.string().optional(),
  creditsConsumed: z.number().int().min(0).default(0),
  flags: z.object({
    lockedReady: z.boolean().default(false),
  }).optional(),
  errorMessage: z.string().optional(),
});

export type VideoExtended = z.infer<typeof videoSchemaExtended> & { id: string };

// Updated playlist schema with ownership preflight
export const playlistSchemaExtended = playlistSchema.extend({
  ownershipPreflightStatus: z.enum(['pending', 'completed', 'failed']).optional(),
  ownershipResults: z.object({
    owned: z.array(z.string()).default([]),
    notOwned: z.array(z.string()).default([]),
    unknown: z.array(z.string()).default([]),
    checkedAt: nullableTimestamp,
  }).optional(),
});

export type PlaylistExtended = z.infer<typeof playlistSchemaExtended> & { id: string };

// Updated coach schema with credits
export const coachSchemaExtended = coachSchema.extend({
  credits: z.object({
    balance: z.number().int().min(0).default(0),
    monthlyAllotment: z.number().int().min(0).default(0),
    rolloverEnabled: z.boolean().default(false),
  }).optional(),
});

export type CoachExtended = z.infer<typeof coachSchemaExtended> & { id: string };
