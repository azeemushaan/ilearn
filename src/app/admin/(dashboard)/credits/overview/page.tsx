'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { Loader2, Plus, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export default function CreditOverviewPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [addingCredits, setAddingCredits] = useState(false);
  const [selectedCoachId, setSelectedCoachId] = useState('');
  const [creditsToAdd, setCreditsToAdd] = useState('');
  const [reason, setReason] = useState('');

  // Query coach billing
  const billingRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'coach_billing');
  }, [firestore]);

  const { data: billingDocs, isLoading: loadingBilling } = useCollection(billingRef);

  // Query recent credit transactions
  const transactionsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'credit_transactions'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
  }, [firestore]);

  const { data: transactions, isLoading: loadingTransactions } = useCollection(transactionsRef);

  const handleAddCredits = async () => {
    if (!selectedCoachId || !creditsToAdd) {
      toast({
        title: 'Error',
        description: 'Please select coach and enter credit amount',
        variant: 'destructive',
      });
      return;
    }

    setAddingCredits(true);

    try {
      const response = await fetch('/api/admin/credits/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coachId: selectedCoachId,
          amount: parseInt(creditsToAdd),
          reason: reason || 'Manual adjustment',
          actorId: 'admin',
        }),
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: `Added ${creditsToAdd} credits to coach`,
        });
        setSelectedCoachId('');
        setCreditsToAdd('');
        setReason('');
      } else {
        const error = await response.json();
        throw new Error(error.message);
      }
    } catch (error) {
      toast({
        title: 'Failed',
        description: error instanceof Error ? error.message : 'Failed to add credits',
        variant: 'destructive',
      });
    } finally {
      setAddingCredits(false);
    }
  };

  // Calculate totals
  const totalBalance = billingDocs?.reduce((sum: number, doc: any) => sum + (doc.balance || 0), 0) || 0;
  const totalReserved = billingDocs?.reduce((sum: number, doc: any) => sum + (doc.reservedCredits || 0), 0) || 0;
  const totalConsumed = transactions?.filter((t: any) => t.type === 'consume')
    .reduce((sum: number, t: any) => sum + Math.abs(t.amount || 0), 0) || 0;

  if (loadingBilling) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Credit Overview</h1>
          <p className="text-muted-foreground mt-1">
            Monitor credit usage and manage coach balances
          </p>
        </div>
        
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Credits
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Credits to Coach</DialogTitle>
              <DialogDescription>
                Manually add or adjust credits for a coach account
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="coachId">Coach ID</Label>
                <Input
                  id="coachId"
                  value={selectedCoachId}
                  onChange={(e) => setSelectedCoachId(e.target.value)}
                  placeholder="Enter coach ID"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="credits">Credits</Label>
                <Input
                  id="credits"
                  type="number"
                  value={creditsToAdd}
                  onChange={(e) => setCreditsToAdd(e.target.value)}
                  placeholder="Enter credit amount"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reason">Reason (optional)</Label>
                <Input
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g., Monthly allotment, Bonus credits"
                />
              </div>
              <Button 
                onClick={handleAddCredits} 
                disabled={addingCredits}
                className="w-full"
              >
                {addingCredits ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  'Add Credits'
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalBalance.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all coaches
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Reserved Credits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalReserved.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Currently reserved for jobs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Consumed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalConsumed.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              All-time usage
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Coach Balances */}
      <Card>
        <CardHeader>
          <CardTitle>Coach Balances</CardTitle>
          <CardDescription>Credit balances per coach</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {billingDocs?.map((billing: any) => (
              <div key={billing.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                <div>
                  <p className="font-medium">{billing.coachId}</p>
                  <p className="text-xs text-muted-foreground">
                    Monthly allotment: {billing.monthlyAllotment || 0} • 
                    Rollover: {billing.rolloverEnabled ? 'Yes' : 'No'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg">{billing.balance || 0}</p>
                  <p className="text-xs text-muted-foreground">
                    Reserved: {billing.reservedCredits || 0}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>Last 50 credit transactions</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingTransactions ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !transactions || transactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No transactions yet
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((txn: any) => (
                <div key={txn.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                  <div className="flex-1">
                    <p className="font-medium">{txn.coachId}</p>
                    <p className="text-xs text-muted-foreground">
                      {txn.type} • {txn.reason || 'No reason'} • {txn.createdAt?.toDate?.()?.toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={txn.amount > 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                      {txn.amount > 0 ? '+' : ''}{txn.amount}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      → {txn.balanceAfter}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

