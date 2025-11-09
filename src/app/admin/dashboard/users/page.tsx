import { UsersTable } from '@/components/admin/users-table';
import { adminFirestore } from '@/lib/firebase/admin';
import { userSchema, type CoachUser } from '@/lib/schemas';
import { listCoaches } from '@/lib/firestore/admin-ops';

export const dynamic = 'force-dynamic';

async function listUsers(): Promise<CoachUser[]> {
  const snapshot = await adminFirestore().collection('users').limit(500).get();
  return snapshot.docs.map((doc) => ({ ...userSchema.parse(doc.data()), id: doc.id }));
}

export default async function UsersPage() {
  const [users, coaches] = await Promise.all([listUsers(), listCoaches()]);
  
  // Filter to show only students
  const students = users.filter(user => user.role === 'student');
  
  return (
    <div className="space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold">Students</h1>
        <p className="text-muted-foreground">View all students and their assigned coaches.</p>
      </header>
      <UsersTable users={students} coaches={coaches} />
    </div>
  );
}
