'use client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection } from "firebase/firestore";
import { formatDistanceToNow } from 'date-fns';

export default function UsersPage() {
    const firestore = useFirestore();

    const usersCollectionRef = useMemoFirebase(() => {
        if(!firestore) return null;
        return collection(firestore, 'users');
    }, [firestore]);

    const { data: users, isLoading } = useCollection(usersCollectionRef);

    return (
        <div className="flex flex-1 flex-col">
            <header className="p-4 md:p-6 border-b">
                <h1 className="text-2xl font-headline font-bold">User Management</h1>
                <p className="text-muted-foreground mt-1">View and manage all users on the platform.</p>
            </header>
            <main className="flex-1 p-4 md:p-6">
                {isLoading ? (
                    <p>Loading users...</p>
                ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Email</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Created At</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users?.map((user: any) => (
                            <TableRow key={user.id}>
                                <TableCell>{user.email}</TableCell>
                                <TableCell>{user.firstName} {user.lastName}</TableCell>
                                <TableCell>
                                    <Badge variant={user.role === 'admin' ? 'destructive' : 'secondary'}>
                                        {user.role}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    {user.createdAt?.seconds ? formatDistanceToNow(new Date(user.createdAt.seconds * 1000), { addSuffix: true }) : 'N/A'}
                                </TableCell>
                            </TableRow>
                        ))}
                         {users?.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center">No users found.</TableCell>
                            </TableRow>
                         )}
                    </TableBody>
                </Table>
                )}
            </main>
        </div>
    )
}
