import * as admin from 'firebase-admin';
import { onDocumentUpdated, HttpsError } from 'firebase-functions/v2/firestore';
import { onCall } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { Timestamp, DocumentData } from 'firebase-admin/firestore';
import Handlebars from 'handlebars';

admin.initializeApp();

const firestore = admin.firestore();
const auth = admin.auth();
const storage = admin.storage();

const SUPPORT_EMAIL = defineSecret('SUPPORT_EMAIL');

function now() {
  return Timestamp.now();
}

async function writeAudit(event: { actorId: string; action: string; target: { collection: string; id: string }; coachId?: string | null; meta?: unknown }) {
  await firestore.collection('audit').add({
    ...event,
    ts: now(),
  });
}

export const onPaymentApproved = onDocumentUpdated('payments/{paymentId}', async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after) return;
  if (before.status === 'approved' || after.status !== 'approved') return;

  const subscriptionSnap = await firestore
    .collection('subscriptions')
    .where('coachId', '==', after.coachId)
    .where('status', 'in', ['awaiting_payment', 'past_due'])
    .limit(1)
    .get();

  if (!subscriptionSnap.empty) {
    const subscriptionRef = subscriptionSnap.docs[0].ref;
    await subscriptionRef.update({
      status: 'active',
      currentPeriodEnd: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
      updatedAt: now(),
    });
    await writeAudit({
      actorId: 'system',
      action: 'subscription.auto_activated',
      target: { collection: 'subscriptions', id: subscriptionRef.id },
      coachId: after.coachId,
      meta: { paymentId: event.params.paymentId },
    });
  }

  const receiptUrl = await generateReceiptPdf(after, event.params.paymentId);
  await firestore.collection('receipts').doc(event.params.paymentId).set({
    coachId: after.coachId,
    paymentId: event.params.paymentId,
    url: receiptUrl,
    createdAt: now(),
  });
});

export const onPaymentRejected = onDocumentUpdated('payments/{paymentId}', async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after) return;
  if (before.status === 'rejected' || after.status !== 'rejected') return;

  await writeAudit({
    actorId: after.reviewedBy ?? 'system',
    action: 'payment.rejected',
    target: { collection: 'payments', id: event.params.paymentId },
    coachId: after.coachId,
    meta: { notes: after.notes },
  });
});

export const onPlanChange = onDocumentUpdated('subscriptions/{subscriptionId}', async (event) => {
  const after = event.data?.after.data();
  if (!after) return;
  const usersSnap = await firestore
    .collection('users')
    .where('coachId', '==', after.coachId)
    .where('status', '==', 'active')
    .get();
  if (after.seatLimit < usersSnap.size) {
    await event.data?.after.ref.update({ seatLimit: usersSnap.size, updatedAt: now() });
    await writeAudit({
      actorId: 'system',
      action: 'subscription.seat_autocorrect',
      target: { collection: 'subscriptions', id: event.params.subscriptionId },
      coachId: after.coachId,
      meta: { enforcedSeatLimit: usersSnap.size },
    });
  }
});

export const setCustomClaims = onCall({ region: 'asia-south1' }, async (request) => {
  const { uid, role, coachId } = request.data as { uid?: string; role?: string; coachId?: string | null };
  if (!request.auth || request.auth.token.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Only admins can set claims.');
  }
  if (!uid || !role) {
    throw new HttpsError('invalid-argument', 'Missing uid or role.');
  }
  if (!['admin', 'teacher', 'student'].includes(role)) {
    throw new HttpsError('invalid-argument', 'Invalid role.');
  }
  await auth.setCustomUserClaims(uid, { role, coachId: coachId ?? null });
  await writeAudit({
    actorId: request.auth.uid,
    action: 'user.claims.set',
    target: { collection: 'users', id: uid },
    coachId: coachId ?? null,
    meta: { role },
  });
  return { success: true };
});

async function generateReceiptPdf(payment: DocumentData, paymentId: string) {
  const template = Handlebars.compile(`Payment receipt\nCoach: {{coachId}}\nAmount: {{amount}} {{currency}}\nStatus: {{status}}`);
  const pdfContent = template(payment);
  const file = storage.bucket().file(`receipts/${paymentId}.txt`);
  await file.save(pdfContent, { contentType: 'text/plain' });
  await file.makePrivate();
  const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 7 * 24 * 60 * 60 * 1000 });
  return url;
}

export const createInvoice = onCall({ region: 'asia-south1', secrets: [SUPPORT_EMAIL] }, async (request) => {
  if (!request.auth || request.auth.token.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Only admins can create invoices.');
  }
  const { coachId, items, total, currency, status, dueAt } = request.data as Record<string, any>;
  if (!coachId || !Array.isArray(items)) {
    throw new HttpsError('invalid-argument', 'Invalid invoice payload.');
  }
  const doc = await firestore.collection('invoices').add({
    coachId,
    items,
    total,
    currency,
    status,
    dueAt: dueAt ? Timestamp.fromDate(new Date(dueAt)) : null,
    createdAt: now(),
  });
  await writeAudit({
    actorId: request.auth.uid,
    action: 'invoice.create',
    target: { collection: 'invoices', id: doc.id },
    coachId,
    meta: { total, currency },
  });
  return { id: doc.id };
});

export const sendInvoiceEmail = onCall({ region: 'asia-south1', secrets: [SUPPORT_EMAIL] }, async (request) => {
  if (!request.auth || request.auth.token.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Only admins can send invoices.');
  }
  const { invoiceId, email } = request.data as { invoiceId?: string; email?: string };
  if (!invoiceId || !email) {
    throw new HttpsError('invalid-argument', 'Missing invoiceId or email.');
  }
  const doc = await firestore.collection('invoices').doc(invoiceId).get();
  if (!doc.exists) {
    throw new HttpsError('not-found', 'Invoice not found');
  }
  await writeAudit({
    actorId: request.auth.uid,
    action: 'invoice.email.sent',
    target: { collection: 'invoices', id: invoiceId },
    coachId: doc.data()?.coachId,
    meta: { email },
  });
  return { success: true };
});

export { generateReceiptPdf };
