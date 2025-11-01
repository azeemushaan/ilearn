import * as admin from 'firebase-admin';
import { onDocumentUpdated, onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { Timestamp, DocumentData } from 'firebase-admin/firestore';
import Handlebars from 'handlebars';
import * as nodemailer from 'nodemailer';

admin.initializeApp();

const firestore = admin.firestore();
const auth = admin.auth();
const storage = admin.storage();

const SUPPORT_EMAIL = defineSecret('SUPPORT_EMAIL');
const GMAIL_EMAIL = defineSecret('GMAIL_EMAIL');
const GMAIL_PASSWORD = defineSecret('GMAIL_PASSWORD');

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

// Send invitation email when a new invitation is created
export const onInvitationCreated = onDocumentCreated(
  { document: 'invitations/{invitationId}', secrets: [GMAIL_EMAIL, GMAIL_PASSWORD] },
  async (event) => {
    const invitation = event.data?.data();
    if (!invitation) return;

    try {
      // Get coach details
      const coachDoc = await firestore.collection('coaches').doc(invitation.coachId).get();
      const coach = coachDoc.data();

      // Configure email transporter
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: GMAIL_EMAIL.value(),
          pass: GMAIL_PASSWORD.value(),
        },
      });

      const signupUrl = `https://ilearn.er21.org/signup-student`;
      
      // Email HTML template
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .invite-code { background: white; border: 2px dashed #667eea; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
            .code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 4px; font-family: 'Courier New', monospace; }
            .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">🎓 iLearn by ER21</h1>
              <p style="margin: 10px 0 0 0;">You've been invited to join!</p>
            </div>
            <div class="content">
              <h2>Hello!</h2>
              <p>You've been invited by <strong>${coach?.displayName || 'your coach'}</strong> to join their class on iLearn.</p>
              
              <div class="invite-code">
                <p style="margin: 0 0 10px 0; color: #6b7280;">Your Invite Code:</p>
                <div class="code">${invitation.inviteCode}</div>
              </div>

              <p><strong>Next Steps:</strong></p>
              <ol>
                <li>Click the button below to sign up</li>
                <li>Enter your details</li>
                <li>Use the invite code above</li>
                <li>Start learning!</li>
              </ol>

              <center>
                <a href="${signupUrl}" class="button">Sign Up Now</a>
              </center>

              <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
                This invitation will expire on ${new Date(invitation.expiresAt.toDate()).toLocaleDateString()}.
              </p>
            </div>
            <div class="footer">
              <p>iLearn by ER21 - Transform YouTube into Interactive Learning</p>
              <p>If you didn't expect this invitation, you can safely ignore this email.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      // Send email
      await transporter.sendMail({
        from: `"iLearn by ER21" <${GMAIL_EMAIL.value()}>`,
        to: invitation.email,
        subject: `You're invited to join ${coach?.displayName || 'iLearn'}!`,
        html: emailHtml,
      });

      console.log(`Invitation email sent to ${invitation.email}`);
      
      // Log the email send
      await writeAudit({
        actorId: invitation.coachId,
        action: 'invitation.email.sent',
        target: { collection: 'invitations', id: event.params.invitationId },
        coachId: invitation.coachId,
        meta: { email: invitation.email, inviteCode: invitation.inviteCode },
      });
    } catch (error) {
      console.error('Error sending invitation email:', error);
      // Don't fail the function, just log the error
    }
  }
);
