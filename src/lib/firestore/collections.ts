import { FieldValue, FirestoreDataConverter, QueryDocumentSnapshot, SnapshotOptions } from 'firebase/firestore';
import {
  auditSchema,
  coachSchema,
  invoiceSchema,
  paymentSchema,
  planSchema,
  subscriptionSchema,
  coachSubscriptionSchema,
  userSchema,
  type AuditEvent,
  type Coach,
  type CoachUser,
  type Invoice,
  type LegacycoachSubscription,
  type Payment,
  type Plan,
  type Subscription,
} from '@/lib/schemas';

const withTimestamps = <T extends Record<string, unknown>>(data: T) => ({
  ...data,
  createdAt: data.createdAt instanceof Date ? data.createdAt : data.createdAt?.toDate?.() ?? null,
  updatedAt: data.updatedAt instanceof Date ? data.updatedAt : data.updatedAt?.toDate?.() ?? null,
});

function createConverter<T extends { id?: string }>(schema: typeof coachSchema): FirestoreDataConverter<T>;
function createConverter<T extends { id?: string }>(schema: typeof planSchema): FirestoreDataConverter<T>;
function createConverter<T extends { id?: string }>(schema: typeof subscriptionSchema): FirestoreDataConverter<T>;
function createConverter<T extends { id?: string }>(schema: typeof paymentSchema): FirestoreDataConverter<T>;
function createConverter<T extends { id?: string }>(schema: typeof invoiceSchema): FirestoreDataConverter<T>;
function createConverter<T extends { id?: string }>(schema: typeof auditSchema): FirestoreDataConverter<T>;
function createConverter<T extends { id?: string }>(schema: typeof userSchema): FirestoreDataConverter<T>;
function createConverter<T extends { id?: string }>(schema: typeof coachSubscriptionSchema): FirestoreDataConverter<T>;
function createConverter<T extends { id?: string }>(schema: any): FirestoreDataConverter<T> {
  return {
    toFirestore(modelObject) {
      return {
        ...modelObject,
        createdAt: modelObject.createdAt ?? FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      } as T;
    },
    fromFirestore(snapshot: QueryDocumentSnapshot, options: SnapshotOptions) {
      const data = snapshot.data(options);
      const parsed = schema.parse(data);
      return { id: snapshot.id, ...withTimestamps(parsed) } as T;
    },
  };
}

export const converters = {
  coaches: createConverter<Coach>(coachSchema),
  users: createConverter<CoachUser>(userSchema),
  plans: createConverter<Plan>(planSchema),
  subscriptions: createConverter<Subscription>(subscriptionSchema),
  payments: createConverter<Payment>(paymentSchema),
  invoices: createConverter<Invoice>(invoiceSchema),
  audit: createConverter<AuditEvent>(auditSchema),
  coachSubscriptions: createConverter<LegacycoachSubscription>(coachSubscriptionSchema),
};

export type FirestoreCollectionName = keyof typeof converters;

export const collectionNames: Record<FirestoreCollectionName, string> = {
  coaches: 'coaches',
  users: 'users',
  plans: 'plans',
  subscriptions: 'subscriptions',
  payments: 'payments',
  invoices: 'invoices',
  audit: 'audit',
  coachSubscriptions: 'coach_subscriptions',
};
