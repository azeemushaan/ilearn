import { AuditTable } from '@/components/admin/audit-table';
export const dynamic = 'force-dynamic';
import { listAudit } from '@/lib/firestore/admin-ops';

export default async function AuditPage() {
  const events = await listAudit();
  return (
    <div className="space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold">Audit trail</h1>
        <p className="text-muted-foreground">Complete record of privileged actions.</p>
      </header>
      <AuditTable events={events} />
    </div>
  );
}
