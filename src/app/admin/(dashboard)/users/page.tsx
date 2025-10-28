import { UsersTable } from '@/components/admin/users-table';
import { adminFirestore } from '@/lib/firebase/admin';
import { userSchema, type CoachUser } from '@/lib/schemas';
import { listCoaches } from '@/lib/firestore/admin-ops';

async function listUsers(): Promise<CoachUser[]> {
  const snapshot = await adminFirestore().collection('users').limit(500).get();
  return snapshot.docs.map((doc) => userSchema.parse({ ...doc.data(), id: doc.id }));
}

export default async function UsersPage() {
  const [users, coaches] = await Promise.all([listUsers(), listCoaches()]);
  return (
    <div className="space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold">Users</h1>
        <p className="text-muted-foreground">Manage identities, custom claims, and account status.</p>
      </header>
      <UsersTable users={users} coaches={coaches} />
    </div>
  );
}
