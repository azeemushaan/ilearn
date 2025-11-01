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
  isActive: z.boolean().default(true),
  sort: z.number().int().default(0),
  createdAt: nullableTimestamp,
  updatedAt: nullableTimestamp,
});

export type Plan = z.infer<typeof planSchema> & { id: string };

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

export const teacherSubscriptionSchema = z.object({
  userId: z.string().min(1),
  planRef: z.string().min(1),
  createdAt: nullableTimestamp,
  updatedAt: nullableTimestamp,
});

export type LegacyTeacherSubscription = z.infer<typeof teacherSubscriptionSchema> & { id: string };

export const createTimestamp = () => new Date();

export type EntityWithTimestamps<T> = T & {
  createdAt: Date | null;
  updatedAt: Date | null;
};

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
  assignmentId: z.string().min(1),
  questionId: z.string().min(1),
  segmentId: z.string().min(1),
  videoId: z.string().min(1),
  chosenIndex: z.number().int().min(0).max(3),
  isCorrect: z.boolean(),
  latencyMs: z.number().int().min(0).optional(),
  ts: nullableTimestamp,
});

export type Attempt = z.infer<typeof attemptSchema> & { id: string };

export const progressSchema = z.object({
  studentId: z.string().min(1),
  assignmentId: z.string().min(1),
  videoId: z.string().min(1),
  watchPct: z.number().min(0).max(100).default(0),
  score: z.number().min(0).max(100).default(0),
  attempts: z.number().int().min(0).default(0),
  lastSegmentId: z.string().optional(),
  lastActivityAt: nullableTimestamp,
  completedAt: nullableTimestamp,
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
