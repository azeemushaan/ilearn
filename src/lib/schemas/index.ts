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
  }),
  plan: z.object({
    tier: z.enum(['free', 'pro', 'enterprise']),
    seats: z.number().int().min(0),
    expiresAt: nullableTimestamp,
  }),
  settings: z.object({
    locale: z.enum(['en', 'ur']).default('en'),
    lowBandwidthDefault: z.boolean().default(false),
  }),
  createdAt: nullableTimestamp,
  updatedAt: nullableTimestamp,
});

export type Coach = z.infer<typeof coachSchema> & { id: string };

export const userSchema = z.object({
  coachId: z.string().min(1),
  role: z.enum(['admin', 'teacher', 'student']),
  profile: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    photoUrl: z.string().url().nullish(),
  }),
  status: z.enum(['active', 'invited', 'disabled']).default('invited'),
  createdAt: nullableTimestamp,
  updatedAt: nullableTimestamp,
});

export type CoachUser = z.infer<typeof userSchema> & { id: string };

export const planSchema = z.object({
  title: z.string().min(1),
  tier: z.enum(['free', 'pro', 'enterprise']),
  pricePKR: z.number().nonnegative(),
  priceUSD: z.number().nonnegative().nullish(),
  seatLimit: z.number().int().min(1),
  features: z.array(z.string().min(1)),
  isActive: z.boolean().default(true),
  sort: z.number().int().default(0),
  createdAt: nullableTimestamp,
  updatedAt: nullableTimestamp,
});

export type Plan = z.infer<typeof planSchema> & { id: string };

export const subscriptionSchema = z.object({
  coachId: z.string().min(1),
  planId: z.string().min(1),
  tier: z.enum(['free', 'pro', 'enterprise']),
  seatLimit: z.number().int().min(1),
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
