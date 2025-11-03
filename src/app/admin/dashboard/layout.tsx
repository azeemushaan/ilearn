import type { Metadata } from 'next';
import { AdminShell } from '@/components/admin/admin-shell';
import { requireAdmin } from '@/lib/auth/server';

export const metadata: Metadata = {
  title: 'iLearn Admin',
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <AdminShell>{children}</AdminShell>;
}
