'use server';

import { revalidatePath } from 'next/cache';
import { upsertInvoice } from '@/lib/firestore/admin-ops';
import { invoiceSchema } from '@/lib/schemas';
import { requireAdmin } from '@/lib/auth/server';

export async function updateInvoiceStatusAction(id: string, status: 'draft' | 'sent' | 'paid' | 'void') {
  const admin = await requireAdmin();
  await upsertInvoice(id, { status } as any, admin.uid);
  revalidatePath('/admin/invoices');
  revalidatePath('/admin/payments');
}
