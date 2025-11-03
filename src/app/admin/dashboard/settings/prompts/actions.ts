'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/server';
import {
  createPromptTemplate,
  deletePromptTemplate,
  updatePromptTemplate,
} from '@/lib/firestore/admin-ops';

function isOn(values: FormDataEntryValue[]) {
  if (values.length === 0) return false;
  return values.some(value => String(value).toLowerCase() === 'on' || String(value).toLowerCase() === 'true');
}

export async function createPromptTemplateAction(formData: FormData) {
  const admin = await requireAdmin();
  const name = formData.get('name');
  const description = formData.get('description');
  const content = formData.get('content');
  const active = isOn(formData.getAll('active'));

  if (typeof name !== 'string' || !name.trim()) {
    throw new Error('Prompt name is required');
  }

  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Prompt content is required');
  }

  await createPromptTemplate(
    {
      name,
      description: typeof description === 'string' ? description : undefined,
      content,
      active,
    },
    admin.uid,
  );

  revalidatePath('/admin/dashboard/settings/prompts');
  revalidatePath('/admin/dashboard/settings');
}

export async function updatePromptTemplateAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = formData.get('id');
  const name = formData.get('name');
  const description = formData.get('description');
  const content = formData.get('content');
  const active = isOn(formData.getAll('active'));

  if (typeof id !== 'string' || !id) {
    throw new Error('Prompt id is required');
  }

  if (typeof name !== 'string' || !name.trim()) {
    throw new Error('Prompt name is required');
  }

  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Prompt content is required');
  }

  await updatePromptTemplate(
    id,
    {
      name,
      description: typeof description === 'string' ? description : undefined,
      content,
      active,
    },
    admin.uid,
  );

  revalidatePath('/admin/dashboard/settings/prompts');
  revalidatePath('/admin/dashboard/settings');
}

export async function deletePromptTemplateAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = formData.get('id');

  if (typeof id !== 'string' || !id) {
    throw new Error('Prompt id is required');
  }

  await deletePromptTemplate(id, admin.uid);
  revalidatePath('/admin/dashboard/settings/prompts');
  revalidatePath('/admin/dashboard/settings');
}
