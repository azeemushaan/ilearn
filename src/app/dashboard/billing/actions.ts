'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/server';
import { adminFirestore, adminStorage } from '@/lib/firebase/admin';
import { paymentSchema } from '@/lib/schemas';

export async function submitManualPayment(formData: FormData) {
  const user = await requireRole(['admin', 'coach']);
  if (!user.coachId) {
    throw new Error('Coach context missing');
  }

  const amount = Number(formData.get('amount'));
  const reference = String(formData.get('reference') ?? '');
  const notes = String(formData.get('notes') ?? '');
  const currency = (formData.get('currency') as 'PKR' | 'USD') ?? 'PKR';
  const file = formData.get('bankSlip');
  let bankSlipUrl: string | null = null;

  if (file && typeof file === 'object' && 'arrayBuffer' in file) {
    const blob = file as Blob;
    if (blob.size > 0) {
      const bucket = adminStorage().bucket();
      const filename = 'name' in file ? (file as File).name : 'slip';
      const fileId = `${user.uid ?? 'user'}/${Date.now()}-${filename}`;
      const storageFile = bucket.file(`bank-slips/${fileId}`);
      const arrayBuffer = await blob.arrayBuffer();
      const contentType = 'type' in file ? (file as File).type : 'application/octet-stream';
      await storageFile.save(Buffer.from(arrayBuffer), { contentType });
      bankSlipUrl = `gs://${bucket.name}/bank-slips/${fileId}`;
    }
  }

  const payload = paymentSchema.omit({ createdAt: true, updatedAt: true }).parse({
    coachId: user.coachId,
    amount,
    currency,
    method: 'manual_bank',
    status: 'pending',
    reference,
    notes,
    bankSlipUrl,
  });

  await adminFirestore().collection('payments').add({
    ...payload,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  revalidatePath('/dashboard/billing');
}
