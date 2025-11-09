import { Timestamp } from 'firebase-admin/firestore';
import { adminFirestore, adminStorage, adminAuth } from '@/lib/firebase/admin';
import { hashSecret } from '@/lib/crypto/hash';
import {
  aiProviderSchema,
  aiSettingsSchema,
  auditSchema,
  coachSchema,
  invoiceSchema,
  paymentSchema,
  planSchema,
  promptTemplateSchema,
  subscriptionSchema,
  type AiProvider,
  systemSettingsSchema,
  systemSettingsUpdateSchema,
  type AuditEvent,
  type Coach,
  type Invoice,
  type Payment,
  type Plan,
  type PromptTemplate,
  type Subscription,
  type SystemSettings,
} from '@/lib/schemas';

function nowTimestamp(date?: Date) {
  return date ? Timestamp.fromDate(date) : Timestamp.now();
}

function withAudit(base: Partial<AuditEvent>) {
  return {
    ...base,
    ts: nowTimestamp(),
  };
}

export async function listCoaches(): Promise<Coach[]> {
  const snapshot = await adminFirestore().collection('coaches').get();
  return snapshot.docs.map((doc) => ({
    ...coachSchema.parse(doc.data()),
    id: doc.id,
  }));
}

export async function createCoach(data: Omit<Coach, 'id' | 'createdAt' | 'updatedAt'>, actorId: string) {
  const validated = coachSchema.omit({ createdAt: true, updatedAt: true }).parse(data);
  const payload = {
    ...validated,
    createdAt: nowTimestamp(),
    updatedAt: nowTimestamp(),
  };
  const ref = await adminFirestore().collection('coaches').add(payload);
  await writeAudit({
    actorId,
    action: 'coach.create',
    target: { collection: 'coaches', id: ref.id },
    coachId: ref.id,
    meta: validated,
  });
  return ref.id;
}

export async function updateCoach(id: string, data: Partial<Coach>, actorId: string) {
  const docRef = adminFirestore().collection('coaches').doc(id);
  const snapshot = await docRef.get();
  if (!snapshot.exists) throw new Error('Coach not found');
  const merged = coachSchema.partial().parse(data);
  await docRef.update({ ...merged, updatedAt: nowTimestamp() });
  await writeAudit({
    actorId,
    action: 'coach.update',
    target: { collection: 'coaches', id },
    coachId: id,
    meta: data,
  });
}

export async function listPlans(): Promise<Plan[]> {
  const snapshot = await adminFirestore().collection('plans').orderBy('sort', 'asc').get();
  return snapshot.docs.map((doc) => ({
    ...planSchema.parse(doc.data()),
    id: doc.id,
  }));
}

export async function getSystemSettings(): Promise<SystemSettings> {
  const doc = await adminFirestore().collection('settings').doc('system').get();
  if (!doc.exists) {
    return systemSettingsSchema.parse({});
  }
  return systemSettingsSchema.parse(doc.data() ?? {});
}

export async function updateSystemSettings(settings: Partial<SystemSettings>, actorId: string) {
  const parsed = systemSettingsUpdateSchema.parse(settings);
  
  // Remove undefined values to prevent Firestore errors
  const cleanPayload = Object.entries({ ...parsed, updatedAt: nowTimestamp() }).reduce((acc, [key, value]) => {
    if (value !== undefined) {
      // Handle nested objects
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const cleanNested = Object.entries(value).reduce((nestedAcc, [nestedKey, nestedValue]) => {
          if (nestedValue !== undefined) {
            nestedAcc[nestedKey] = nestedValue;
          }
          return nestedAcc;
        }, {} as any);
        
        if (Object.keys(cleanNested).length > 0) {
          acc[key] = cleanNested;
        }
      } else {
        acc[key] = value;
      }
    }
    return acc;
  }, {} as any);
  
  await adminFirestore().collection('settings').doc('system').set(cleanPayload, { merge: true });
  await writeAudit({
    actorId,
    action: 'settings.update',
    target: { collection: 'settings', id: 'system' },
    meta: settings,
  });
}

const aiProviderValues = aiProviderSchema.options as readonly AiProvider[];

const defaultAiSettings: { provider: AiProvider; model: string; activePromptId: string | null } = {
  provider: 'google',
  model: 'googleai/gemini-2.5-flash',
  activePromptId: null,
};

export type SystemAiSettings = {
  provider: AiProvider;
  model: string;
  activePromptId: string | null;
  apiKeyMask: string | null;
  hasApiKey: boolean;
  apiKeyHash?: string | null;
  apiKeyUpdatedAt?: Date | null;
};

function maskApiKey(apiKey: string) {
  if (!apiKey) return null;
  const trimmed = apiKey.trim();
  if (trimmed.length <= 8) return '••••';
  const start = trimmed.slice(0, 4);
  const end = trimmed.slice(-4);
  return `${start}••••${end}`;
}

export async function getSystemAiSettings(): Promise<SystemAiSettings> {
  const doc = await adminFirestore().collection('settings').doc('system.ai').get();
  if (!doc.exists) {
    return {
      provider: defaultAiSettings.provider,
      model: defaultAiSettings.model,
      activePromptId: defaultAiSettings.activePromptId,
      apiKeyMask: null,
      hasApiKey: false,
    } satisfies SystemAiSettings;
  }

  // Parse the main AI settings fields
  const aiSettingsData = aiSettingsSchema._def.innerType.partial().parse(doc.data() ?? {});
  
  // Extract the specific fields we need
  const provider = aiProviderValues.includes(aiSettingsData.provider as AiProvider)
    ? (aiSettingsData.provider as AiProvider)
    : defaultAiSettings.provider;
  const model = typeof aiSettingsData.model === 'string' && aiSettingsData.model.length > 0
    ? aiSettingsData.model
    : defaultAiSettings.model;
    
  // Get the additional fields that are stored in the same document
  const docData = doc.data() ?? {};
  const activePromptId = typeof docData.activePromptId === 'string' && docData.activePromptId.length > 0
    ? docData.activePromptId
    : null;
  const apiKey = typeof docData.apiKey === 'string' ? docData.apiKey : null;
  const apiKeyHash = typeof docData.apiKeyHash === 'string' ? docData.apiKeyHash : null;
  const apiKeyUpdatedAtRaw = docData.apiKeyUpdatedAt;
  const apiKeyUpdatedAt = apiKeyUpdatedAtRaw instanceof Timestamp
    ? apiKeyUpdatedAtRaw.toDate()
    : typeof apiKeyUpdatedAtRaw?.toDate === 'function'
    ? apiKeyUpdatedAtRaw.toDate()
    : null;

  return {
    provider,
    model,
    activePromptId,
    apiKeyMask: maskApiKey(apiKey ?? ''),
    hasApiKey: Boolean(apiKey),
    apiKeyHash,
    apiKeyUpdatedAt,
  } satisfies SystemAiSettings;
}

type UpdateAiSettingsInput = Partial<{
  provider: AiProvider;
  model: string;
  apiKey: string | null;
  activePromptId: string | null;
}>;

export async function updateSystemAiSettings(settings: UpdateAiSettingsInput, actorId: string) {
  const firestore = adminFirestore();
  const payload: Record<string, unknown> = {
    updatedAt: nowTimestamp(),
  };

  if (settings.provider && aiProviderValues.includes(settings.provider)) {
    payload.provider = settings.provider;
  }

  if (typeof settings.model === 'string' && settings.model.trim()) {
    payload.model = settings.model.trim();
  }

  if (settings.apiKey !== undefined) {
    const sanitized = settings.apiKey && settings.apiKey.trim().length > 0 ? settings.apiKey.trim() : null;
    payload.apiKey = sanitized;
    payload.apiKeyHash = sanitized ? hashSecret(sanitized) : null;
    payload.apiKeyUpdatedAt = nowTimestamp();
  }

  if ('activePromptId' in settings) {
    payload.activePromptId = settings.activePromptId ?? null;
    await setActivePromptTemplate(settings.activePromptId ?? null, actorId, { updateSettingsDocument: false });
  }

  await firestore.collection('settings').doc('system.ai').set(payload, { merge: true });

  const meta: Record<string, unknown> = {};
  if (payload.provider) meta.provider = payload.provider;
  if (payload.model) meta.model = payload.model;
  if ('apiKey' in payload) meta.apiKeyUpdated = Boolean(payload.apiKey);
  if ('activePromptId' in payload) meta.activePromptId = payload.activePromptId;
  if ('apiKeyHash' in payload) meta.apiKeyHash = payload.apiKeyHash;

  await writeAudit({
    actorId,
    action: 'settings.ai.update',
    target: { collection: 'settings', id: 'system.ai' },
    meta,
  });
}

export async function listPromptTemplates(): Promise<PromptTemplate[]> {
  const snapshot = await adminFirestore().collection('prompts').orderBy('updatedAt', 'desc').get();
  return snapshot.docs.map((doc) => ({
    ...promptTemplateSchema.parse(doc.data()),
    id: doc.id,
  }));
}

export async function getPromptTemplate(id: string): Promise<PromptTemplate | null> {
  const doc = await adminFirestore().collection('prompts').doc(id).get();
  if (!doc.exists) return null;
  return { ...promptTemplateSchema.parse(doc.data()), id: doc.id };
}

export async function getActivePromptTemplate(
  aiSettings?: SystemAiSettings,
): Promise<PromptTemplate | null> {
  const settings = aiSettings ?? (await getSystemAiSettings());
  if (settings.activePromptId) {
    const fromSettings = await getPromptTemplate(settings.activePromptId);
    if (fromSettings) return fromSettings;
  }

  const snapshot = await adminFirestore().collection('prompts').where('active', '==', true).limit(1).get();
  if (!snapshot.empty) {
    const doc = snapshot.docs[0];
    return { ...promptTemplateSchema.parse(doc.data()), id: doc.id };
  }

  return null;
}

type PromptTemplatePayload = {
  name: string;
  description?: string | null;
  content: string;
  active?: boolean;
};

export async function createPromptTemplate(data: PromptTemplatePayload, actorId: string) {
  const firestore = adminFirestore();
  const name = data.name.trim();
  const content = data.content.trim();

  if (!name) {
    throw new Error('Prompt name is required');
  }

  if (!content) {
    throw new Error('Prompt content is required');
  }

  const now = nowTimestamp();
  const payload = {
    name,
    description: data.description?.trim() || null,
    content,
    active: Boolean(data.active),
    createdAt: now,
    updatedAt: now,
  };

  const ref = await firestore.collection('prompts').add(payload);

  await writeAudit({
    actorId,
    action: 'prompt.create',
    target: { collection: 'prompts', id: ref.id },
    meta: { name: payload.name, active: payload.active },
  });

  if (payload.active) {
    await setActivePromptTemplate(ref.id, actorId);
  }

  return ref.id;
}

export async function updatePromptTemplate(
  id: string,
  data: Partial<PromptTemplatePayload>,
  actorId: string,
) {
  const firestore = adminFirestore();
  const docRef = firestore.collection('prompts').doc(id);
  const snapshot = await docRef.get();
  if (!snapshot.exists) throw new Error('Prompt template not found');

  const current = promptTemplateSchema.parse({ ...snapshot.data(), id });
  const updates: Record<string, unknown> = { updatedAt: nowTimestamp() };

  if (typeof data.name === 'string') {
    const trimmed = data.name.trim();
    if (!trimmed) throw new Error('Prompt name cannot be empty');
    updates.name = trimmed;
  }

  if (data.description !== undefined) {
    const trimmed = data.description ? data.description.trim() : null;
    updates.description = trimmed;
  }

  if (typeof data.content === 'string') {
    const trimmed = data.content.trim();
    if (!trimmed) throw new Error('Prompt content cannot be empty');
    updates.content = trimmed;
  }

  if (typeof data.active === 'boolean') {
    updates.active = data.active;
  }

  await docRef.update(updates);

  await writeAudit({
    actorId,
    action: 'prompt.update',
    target: { collection: 'prompts', id },
    meta: updates,
  });

  if (data.active === true) {
    await setActivePromptTemplate(id, actorId);
  } else if (data.active === false && current.active) {
    await setActivePromptTemplate(null, actorId);
  }
}

export async function deletePromptTemplate(id: string, actorId: string) {
  const firestore = adminFirestore();
  const docRef = firestore.collection('prompts').doc(id);
  const snapshot = await docRef.get();
  if (!snapshot.exists) return;

  const current = promptTemplateSchema.parse({ ...snapshot.data(), id });
  await docRef.delete();

  await writeAudit({
    actorId,
    action: 'prompt.delete',
    target: { collection: 'prompts', id },
    meta: { name: current.name },
  });

  if (current.active) {
    await setActivePromptTemplate(null, actorId);
  }
}

type SetActivePromptTemplateOptions = {
  updateSettingsDocument?: boolean;
};

export async function setActivePromptTemplate(
  id: string | null,
  actorId: string,
  options: SetActivePromptTemplateOptions = {},
) {
  const firestore = adminFirestore();
  const prompts = firestore.collection('prompts');
  const now = nowTimestamp();
  const batch = firestore.batch();
  let hasUpdates = false;

  const activeSnap = await prompts.where('active', '==', true).get();
  activeSnap.docs.forEach((doc) => {
    if (!id || doc.id !== id) {
      batch.update(doc.ref, { active: false, updatedAt: now });
      hasUpdates = true;
    }
  });

  if (id) {
    const targetRef = prompts.doc(id);
    const targetDoc = await targetRef.get();
    if (!targetDoc.exists) {
      throw new Error('Prompt template not found');
    }
    const targetData = promptTemplateSchema.parse({ ...targetDoc.data(), id });
    if (!targetData.active) {
      batch.update(targetRef, { active: true, updatedAt: now });
      hasUpdates = true;
    } else {
      batch.update(targetRef, { updatedAt: now });
      hasUpdates = true;
    }
  }

  if (hasUpdates) {
    await batch.commit();
  }

  if (options.updateSettingsDocument !== false) {
    await firestore
      .collection('settings')
      .doc('system.ai')
      .set({ activePromptId: id ?? null, updatedAt: nowTimestamp() }, { merge: true });
  }

  await writeAudit({
    actorId,
    action: 'prompt.setActive',
    target: { collection: 'prompts', id: id ?? 'default-template' },
    meta: { activePromptId: id },
  });
}

type PromptUsageLog = {
  promptId: string | null;
  status: 'success' | 'error';
  videoTitle: string;
  chapterName: string;
  difficulty: string;
  locale?: string;
  coachId?: string | null;
  videoId?: string | null;
  usedFallback: boolean;
  provider?: string;
  model?: string;
  errorMessage?: string;
};

export async function recordPromptUsage(event: PromptUsageLog) {
  const meta: Record<string, unknown> = {
    status: event.status,
    videoTitle: event.videoTitle,
    chapterName: event.chapterName,
    difficulty: event.difficulty,
    usedFallback: event.usedFallback,
  };

  if (event.locale !== undefined) meta.locale = event.locale;
  if (event.videoId !== undefined) meta.videoId = event.videoId;
  if (event.provider !== undefined) meta.provider = event.provider;
  if (event.model !== undefined) meta.model = event.model;
  if (event.errorMessage !== undefined) meta.errorMessage = event.errorMessage;

  await writeAudit({
    actorId: 'system',
    coachId: event.coachId ?? undefined,
    action: 'prompt.usage',
    target: { collection: 'prompts', id: event.promptId ?? 'default-template' },
    meta,
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
  return snapshot.docs.map((doc) => ({
    ...subscriptionSchema.parse(doc.data()),
    id: doc.id,
  }));
}

export async function createSubscription(data: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>, actorId: string) {
  const validated = subscriptionSchema.omit({ createdAt: true, updatedAt: true }).parse(data);
  const payload = {
    ...validated,
    createdAt: nowTimestamp(),
    updatedAt: nowTimestamp(),
  };
  const ref = await adminFirestore().collection('subscriptions').add(payload);
  await writeAudit({
    actorId,
    action: 'subscription.create',
    target: { collection: 'subscriptions', id: ref.id },
    coachId: validated.coachId,
    meta: validated,
  });
  return ref.id;
}

export async function updateSubscription(id: string, patch: Partial<Subscription>, actorId: string) {
  const docRef = adminFirestore().collection('subscriptions').doc(id);
  const snapshot = await docRef.get();
  if (!snapshot.exists) throw new Error('Subscription not found');
  const current = subscriptionSchema.parse({ ...snapshot.data(), id });
  const payload = subscriptionSchema.partial().parse(patch);
  if (payload.maxStudents && payload.maxStudents < current.maxStudents) {
    const coachUsers = await adminFirestore().collection('users').where('coachId', '==', current.coachId).where('status', '==', 'active').get();
    if (payload.maxStudents < coachUsers.size) {
      throw new Error(`Cannot reduce student limit below active user count (${coachUsers.size}).`);
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
  const payments = await Promise.all(
    snapshot.docs.map(async (doc) => {
      const payment = { ...paymentSchema.parse(doc.data()), id: doc.id };
      if (payment.bankSlipUrl && payment.bankSlipUrl.startsWith('gs://')) {
        try {
          const path = payment.bankSlipUrl.replace(/^gs:\/\/[^\/]+\//, '');
          const file = adminStorage().bucket().file(path);
          const [url] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
          });
          return { ...payment, bankSlipUrl: url };
        } catch (error) {
          console.error('Failed to get signed URL for bank slip:', error);
          return payment;
        }
      }
      return payment;
    })
  );
  return payments;
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
  
  // Update payment status
  const updateData: any = {
    status: 'approved',
    reviewedBy: actorId,
    reviewedAt: nowTimestamp(),
    updatedAt: nowTimestamp(),
  };
  
  if (notes) {
    updateData.notes = notes;
  }
  
  await docRef.update(updateData);
  
  // Find and activate the associated subscription
  const subscriptionsSnap = await db.collection('subscriptions')
    .where('coachId', '==', payment.coachId)
    .where('paymentId', '==', id)
    .limit(1)
    .get();
  
  if (!subscriptionsSnap.empty) {
    const subscriptionDoc = subscriptionsSnap.docs[0];
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
    
    await subscriptionDoc.ref.update({
      status: 'active',
      currentPeriodEnd: nowTimestamp(oneYearFromNow),
      updatedAt: nowTimestamp(),
    });
  }
  
  await audit({
    actorId,
    action: 'payment.approved',
    target: { collection: 'payments', id },
    meta: notes ? { notes } : {},
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
  return snapshot.docs.map((doc) => ({
    ...invoiceSchema.parse(doc.data()),
    id: doc.id,
  }));
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

/**
 * Completely deletes a coach and all associated data
 * This includes:
 * - Coach document
 * - All users (students) associated with the coach
 * - All subscriptions
 * - All payments
 * - All invoices
 * - All playlists
 * - All videos
 * - All assignments
 * - All progress records
 * - All attempts
 * - Firebase Auth accounts for associated users
 * - Storage files (bank slips, etc.)
 */
export async function deleteCoach(coachId: string, actorId: string) {
  const firestore = adminFirestore();
  const auth = adminAuth();
  const storage = adminStorage();
  
  console.log(`[DELETE COACH] Starting deletion for coach: ${coachId}`);
  
  try {
    // 1. Get all users associated with this coach
    const usersSnap = await firestore.collection('users').where('coachId', '==', coachId).get();
    const userIds = usersSnap.docs.map(doc => doc.id);
    console.log(`[DELETE COACH] Found ${userIds.length} users to delete`);
    
    // 2. Delete Firebase Auth accounts for all users
    for (const uid of userIds) {
      try {
        await auth.deleteUser(uid);
        console.log(`[DELETE COACH] Deleted auth account: ${uid}`);
      } catch (error: any) {
        // User might not exist in auth, continue
        console.warn(`[DELETE COACH] Could not delete auth for ${uid}:`, error.message);
      }
    }
    
    // 3. Delete all Firestore data in batches (Firestore batch limit is 500)
    const deleteInBatches = async (collectionName: string, query: any) => {
      const snapshot = await query.get();
      if (snapshot.empty) return 0;
      
      const batches = [];
      let currentBatch = firestore.batch();
      let operationCount = 0;
      
      for (const doc of snapshot.docs) {
        currentBatch.delete(doc.ref);
        operationCount++;
        
        if (operationCount === 500) {
          batches.push(currentBatch.commit());
          currentBatch = firestore.batch();
          operationCount = 0;
        }
      }
      
      if (operationCount > 0) {
        batches.push(currentBatch.commit());
      }
      
      await Promise.all(batches);
      return snapshot.size;
    };
    
    // Delete collections associated with coach
    const deletedUsers = await deleteInBatches('users', firestore.collection('users').where('coachId', '==', coachId));
    console.log(`[DELETE COACH] Deleted ${deletedUsers} user documents`);
    
    const deletedSubscriptions = await deleteInBatches('subscriptions', firestore.collection('subscriptions').where('coachId', '==', coachId));
    console.log(`[DELETE COACH] Deleted ${deletedSubscriptions} subscriptions`);
    
    const deletedPayments = await deleteInBatches('payments', firestore.collection('payments').where('coachId', '==', coachId));
    console.log(`[DELETE COACH] Deleted ${deletedPayments} payments`);
    
    const deletedInvoices = await deleteInBatches('invoices', firestore.collection('invoices').where('coachId', '==', coachId));
    console.log(`[DELETE COACH] Deleted ${deletedInvoices} invoices`);
    
    // Delete LMS-related data
    const deletedPlaylists = await deleteInBatches('playlists', firestore.collection('playlists').where('coachId', '==', coachId));
    console.log(`[DELETE COACH] Deleted ${deletedPlaylists} playlists`);
    
    const deletedVideos = await deleteInBatches('videos', firestore.collection('videos').where('coachId', '==', coachId));
    console.log(`[DELETE COACH] Deleted ${deletedVideos} videos`);
    
    const deletedAssignments = await deleteInBatches('assignments', firestore.collection('assignments').where('coachId', '==', coachId));
    console.log(`[DELETE COACH] Deleted ${deletedAssignments} assignments`);
    
    // Delete student progress and attempts
    for (const userId of userIds) {
      const deletedProgress = await deleteInBatches('progress', firestore.collection('progress').where('studentId', '==', userId));
      const deletedAttempts = await deleteInBatches('attempts', firestore.collection('attempts').where('studentId', '==', userId));
      console.log(`[DELETE COACH] Deleted ${deletedProgress} progress records and ${deletedAttempts} attempts for user ${userId}`);
    }
    
    // Delete segments, questions, and invitations
    const videosForSegments = await firestore.collection('videos').where('coachId', '==', coachId).get();
    for (const videoDoc of videosForSegments.docs) {
      const deletedSegments = await deleteInBatches('segments', firestore.collection('segments').where('videoId', '==', videoDoc.id));
      const deletedQuestions = await deleteInBatches('questions', firestore.collection('questions').where('videoId', '==', videoDoc.id));
      console.log(`[DELETE COACH] Deleted ${deletedSegments} segments and ${deletedQuestions} questions for video ${videoDoc.id}`);
    }
    
    const deletedInvitations = await deleteInBatches('invitations', firestore.collection('invitations').where('coachId', '==', coachId));
    console.log(`[DELETE COACH] Deleted ${deletedInvitations} invitations`);
    
    // 4. Delete storage files (bank slips, receipts, etc.)
    try {
      const bucket = storage.bucket();
      const [files] = await bucket.getFiles({ prefix: `coaches/${coachId}/` });
      if (files.length > 0) {
        await Promise.all(files.map(file => file.delete()));
        console.log(`[DELETE COACH] Deleted ${files.length} storage files`);
      }
      
      // Delete bank slips
      const [bankSlips] = await bucket.getFiles({ prefix: `bank-slips/${coachId}/` });
      if (bankSlips.length > 0) {
        await Promise.all(bankSlips.map(file => file.delete()));
        console.log(`[DELETE COACH] Deleted ${bankSlips.length} bank slip files`);
      }
    } catch (error: any) {
      console.warn(`[DELETE COACH] Could not delete storage files:`, error.message);
    }
    
    // 5. Finally, delete the coach document itself
    await firestore.collection('coaches').doc(coachId).delete();
    console.log(`[DELETE COACH] Deleted coach document`);
    
    // 6. Write audit log
    await writeAudit({
      actorId,
      action: 'coach.delete',
      coachId,
      target: { collection: 'coaches', id: coachId },
      meta: {
        deletedUsers,
        deletedSubscriptions,
        deletedPayments,
        deletedInvoices,
        deletedPlaylists,
        deletedVideos,
        deletedAssignments,
        deletedInvitations,
        userIds,
      },
    });
    
    console.log(`[DELETE COACH] Successfully deleted coach ${coachId} and all associated data`);
  } catch (error) {
    console.error(`[DELETE COACH] Error deleting coach ${coachId}:`, error);
    throw new Error(`Failed to delete coach: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function listAudit(limit = 200) {
  const snapshot = await adminFirestore().collection('audit').orderBy('ts', 'desc').limit(limit).get();
  return snapshot.docs.map((doc) => auditSchema.parse({ ...doc.data(), id: doc.id }));
}
