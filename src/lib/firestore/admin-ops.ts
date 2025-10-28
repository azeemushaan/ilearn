import { adminFirestore } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import {
  auditSchema,
  coachSchema,
  invoiceSchema,
  paymentSchema,
  planSchema,
  subscriptionSchema,
  type AuditEvent,
  type Coach,
  type Invoice,
  type Payment,
  type Plan,
  type Subscription,
} from '@/lib/schemas';

function nowTimestamp() {
  return Timestamp.now();
}

function withAudit(base: Partial<AuditEvent>) {
  return {
    ...base,
    ts: nowTimestamp(),
  };
}

export async function listCoaches(): Promise<Coach[]> {
  const snapshot = await adminFirestore().collection('coaches').get();
  return snapshot.docs.map((doc) => coachSchema.parse({ ...doc.data(), id: doc.id }));
}

export async function listPlans(): Promise<Plan[]> {
  const snapshot = await adminFirestore().collection('plans').orderBy('sort', 'asc').get();
  return snapshot.docs.map((doc) => planSchema.parse({ ...doc.data(), id: doc.id }));
}

export type SystemSettings = {
  manualPaymentsEnabled: boolean;
  supportEmail: string;
  branding: {
    logoUrl?: string | null;
  };
};

const defaultSettings: SystemSettings = {
  manualPaymentsEnabled: true,
  supportEmail: 'support@example.com',
  branding: {},
};

export async function getSystemSettings(): Promise<SystemSettings> {
  const doc = await adminFirestore().collection('settings').doc('system').get();
  if (!doc.exists) return defaultSettings;
  return { ...defaultSettings, ...doc.data() } as SystemSettings;
}

export async function updateSystemSettings(settings: Partial<SystemSettings>, actorId: string) {
  const payload = { ...settings, updatedAt: nowTimestamp() };
  await adminFirestore().collection('settings').doc('system').set(payload, { merge: true });
  await writeAudit({
    actorId,
    action: 'settings.update',
    target: { collection: 'settings', id: 'system' },
    meta: settings,
  });
}

export async function createPlan(data: Omit<Plan, 'id' | 'createdAt' | 'updatedAt'>, actorId: string) {
  const validated = planSchema.omit({ createdAt: true, updatedAt: true }).parse(data);
  const payload = {
    ...validated,
    createdAt: nowTimestamp(),
    updatedAt: nowTimestamp(),
  };
  const ref = await adminFirestore().collection('plans').add(payload);
  await writeAudit({
    actorId,
    action: 'plan.create',
    target: { collection: 'plans', id: ref.id },
    meta: validated,
  });
  return ref.id;
}

export async function updatePlan(id: string, data: Partial<Plan>, actorId: string) {
  const docRef = adminFirestore().collection('plans').doc(id);
  const snapshot = await docRef.get();
  if (!snapshot.exists) throw new Error('Plan not found');
  const current = planSchema.parse({ ...snapshot.data(), id });
  const merged = planSchema.partial().parse(data);
  await docRef.update({ ...merged, updatedAt: nowTimestamp() });
  await writeAudit({
    actorId,
    action: 'plan.update',
    target: { collection: 'plans', id },
    meta: { before: current, after: { ...current, ...merged } },
  });
}

export async function archivePlan(id: string, actorId: string) {
  const docRef = adminFirestore().collection('plans').doc(id);
  await docRef.update({ isActive: false, updatedAt: nowTimestamp() });
  await writeAudit({
    actorId,
    action: 'plan.archive',
    target: { collection: 'plans', id },
  });
}

export async function activatePlan(id: string, actorId: string) {
  const docRef = adminFirestore().collection('plans').doc(id);
  await docRef.update({ isActive: true, updatedAt: nowTimestamp() });
  await writeAudit({
    actorId,
    action: 'plan.activate',
    target: { collection: 'plans', id },
  });
}

export async function listSubscriptions(): Promise<Subscription[]> {
  const snapshot = await adminFirestore().collection('subscriptions').get();
  return snapshot.docs.map((doc) => subscriptionSchema.parse({ ...doc.data(), id: doc.id }));
}

export async function updateSubscription(id: string, patch: Partial<Subscription>, actorId: string) {
  const docRef = adminFirestore().collection('subscriptions').doc(id);
  const snapshot = await docRef.get();
  if (!snapshot.exists) throw new Error('Subscription not found');
  const current = subscriptionSchema.parse({ ...snapshot.data(), id });
  const payload = subscriptionSchema.partial().parse(patch);
  if (payload.seatLimit && payload.seatLimit < current.seatLimit) {
    // Seat limit enforcement handled in Cloud Function, but we double check here
    const coachUsers = await adminFirestore().collection('users').where('coachId', '==', current.coachId).where('status', '==', 'active').get();
    if (payload.seatLimit < coachUsers.size) {
      throw new Error(`Cannot reduce seat limit below active user count (${coachUsers.size}).`);
    }
  }
  await docRef.update({ ...payload, updatedAt: nowTimestamp() });
  await writeAudit({
    actorId,
    action: 'subscription.update',
    target: { collection: 'subscriptions', id },
    meta: { before: current, patch: payload },
  });
}

export async function cancelSubscription(id: string, actorId: string) {
  await updateSubscription(id, { status: 'canceled' } as Partial<Subscription>, actorId);
}

export async function listPayments(status?: string): Promise<Payment[]> {
  let query = adminFirestore().collection('payments').orderBy('createdAt', 'desc');
  if (status) {
    query = query.where('status', '==', status);
  }
  const snapshot = await query.limit(200).get();
  return snapshot.docs.map((doc) => paymentSchema.parse({ ...doc.data(), id: doc.id }));
}

export async function approvePayment(
  id: string,
  actorId: string,
  notes?: string,
  db = adminFirestore(),
  audit = writeAudit,
) {
  const docRef = db.collection('payments').doc(id);
  const snapshot = await docRef.get();
  if (!snapshot.exists) throw new Error('Payment not found');
  const payment = paymentSchema.parse({ ...snapshot.data(), id });
  if (payment.status === 'approved') return payment;
  await docRef.update({ status: 'approved', notes, reviewedBy: actorId, reviewedAt: nowTimestamp(), updatedAt: nowTimestamp() });
  await audit({
    actorId,
    action: 'payment.approved',
    target: { collection: 'payments', id },
    meta: { notes },
  });
  return payment;
}

export async function rejectPayment(id: string, actorId: string, notes: string) {
  if (!notes) throw new Error('Rejection notes are required');
  const docRef = adminFirestore().collection('payments').doc(id);
  const snapshot = await docRef.get();
  if (!snapshot.exists) throw new Error('Payment not found');
  await docRef.update({ status: 'rejected', notes, reviewedBy: actorId, reviewedAt: nowTimestamp(), updatedAt: nowTimestamp() });
  await writeAudit({
    actorId,
    action: 'payment.rejected',
    target: { collection: 'payments', id },
    meta: { notes },
  });
}

export async function listInvoices(): Promise<Invoice[]> {
  const snapshot = await adminFirestore().collection('invoices').orderBy('createdAt', 'desc').limit(200).get();
  return snapshot.docs.map((doc) => invoiceSchema.parse({ ...doc.data(), id: doc.id }));
}

export async function upsertInvoice(id: string | null, data: Partial<Invoice>, actorId: string) {
  if (id) {
    const validated = invoiceSchema.partial().parse(data);
    await adminFirestore().collection('invoices').doc(id).set({ ...validated, updatedAt: nowTimestamp() }, { merge: true });
    await writeAudit({
      actorId,
      action: 'invoice.update',
      target: { collection: 'invoices', id },
      meta: validated,
    });
    return id;
  }
  const validated = invoiceSchema.parse(data);
  const collection = adminFirestore().collection('invoices');
  const ref = await collection.add({ ...validated, createdAt: nowTimestamp(), updatedAt: nowTimestamp() });
  await writeAudit({
    actorId,
    action: 'invoice.create',
    target: { collection: 'invoices', id: ref.id },
    meta: validated,
  });
  return ref.id;
}

export async function writeAudit(entry: Partial<AuditEvent>) {
  const payload = auditSchema.partial().parse(entry);
  const doc = {
    ...payload,
    ts: nowTimestamp(),
  };
  await adminFirestore().collection('audit').add(doc);
}

export async function disableCoach(coachId: string, actorId: string) {
  const firestore = adminFirestore();
  const usersSnap = await firestore.collection('users').where('coachId', '==', coachId).get();
  const batch = firestore.batch();
  usersSnap.docs.forEach((doc) => {
    batch.update(doc.ref, { status: 'disabled', updatedAt: nowTimestamp() });
  });
  await batch.commit();
  await writeAudit({
    actorId,
    action: 'coach.disabled',
    coachId,
    target: { collection: 'coaches', id: coachId },
  });
}

export async function enableCoach(coachId: string, actorId: string) {
  const firestore = adminFirestore();
  const usersSnap = await firestore.collection('users').where('coachId', '==', coachId).get();
  const batch = firestore.batch();
  usersSnap.docs.forEach((doc) => {
    batch.update(doc.ref, { status: 'active', updatedAt: nowTimestamp() });
  });
  await batch.commit();
  await writeAudit({
    actorId,
    action: 'coach.enabled',
    coachId,
    target: { collection: 'coaches', id: coachId },
  });
}

export async function listAudit(limit = 200) {
  const snapshot = await adminFirestore().collection('audit').orderBy('ts', 'desc').limit(limit).get();
  return snapshot.docs.map((doc) => auditSchema.parse({ ...doc.data(), id: doc.id }));
}
