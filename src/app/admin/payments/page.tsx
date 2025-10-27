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
import { Button } from "@/components/ui/button";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { toast } from "@/hooks/use-toast";

export default function PaymentsPage() {
    const firestore = useFirestore();

    const paymentsCollectionRef = useMemoFirebase(() => {
        if(!firestore) return null;
        return collection(firestore, 'teacher_subscriptions');
    }, [firestore]);

    const { data: payments, isLoading } = useCollection(paymentsCollectionRef);

    const handleApprove = async (id: string) => {
        if (!firestore) return;
        const paymentRef = doc(firestore, "teacher_subscriptions", id);
        try {
            await updateDoc(paymentRef, {
                paymentStatus: 'approved',
                updatedAt: serverTimestamp(),
            });
            toast({
                title: "Payment Approved",
                description: "The payment has been marked as approved.",
            });
        } catch (error: any) {
             toast({
                variant: "destructive",
                title: "Error",
                description: error.message,
            });
        }
    };
    
    const handleReject = async (id: string) => {
        if (!firestore) return;
        const paymentRef = doc(firestore, "teacher_subscriptions", id);
        try {
            await updateDoc(paymentRef, {
                paymentStatus: 'rejected',
                updatedAt: serverTimestamp(),
            });
            toast({
                title: "Payment Rejected",
                description: "The payment has been marked as rejected.",
            });
        } catch (error: any) {
             toast({
                variant: "destructive",
                title: "Error",
                description: error.message,
            });
        }
    };

    const manualTransfers = payments?.filter((p: any) => p.paymentMethod === 'manual_bank_transfer');

    return (
        <div className="flex flex-1 flex-col">
            <header className="p-4 md:p-6 border-b">
                <h1 className="text-2xl font-headline font-bold">Manual Payments</h1>
                <p className="text-muted-foreground mt-1">Review and approve manual bank transfers.</p>
            </header>
            <main className="flex-1 p-4 md:p-6">
                {isLoading ? (
                    <p>Loading payments...</p>
                ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                        <TableHead>Teacher ID</TableHead>
                        <TableHead>Transaction ID</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {manualTransfers?.map((payment: any) => (
                            <TableRow key={payment.id}>
                                <TableCell className="font-mono text-sm">{payment.userId}</TableCell>
                                <TableCell>{payment.transactionId}</TableCell>
                                <TableCell>
                                    <Badge variant={
                                        payment.paymentStatus === 'approved' ? 'default' 
                                        : payment.paymentStatus === 'rejected' ? 'destructive' 
                                        : 'secondary'
                                    }>
                                        {payment.paymentStatus}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    {payment.paymentStatus === 'pending' && (
                                        <div className="flex gap-2 justify-end">
                                            <Button size="sm" onClick={() => handleApprove(payment.id)}>Approve</Button>
                                            <Button size="sm" variant="destructive" onClick={() => handleReject(payment.id)}>Reject</Button>
                                        </div>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                         {manualTransfers?.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center">No pending manual payments.</TableCell>
                            </TableRow>
                         )}
                    </TableBody>
                </Table>
                )}
            </main>
        </div>
    )
}
