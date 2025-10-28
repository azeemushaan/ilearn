import { requireRole } from '@/lib/auth/server';
import { adminFirestore } from '@/lib/firebase/admin';
import { subscriptionSchema, paymentSchema } from '@/lib/schemas';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SubmitManualPaymentForm } from '@/components/dashboard/manual-payment-form';
import { formatCurrency, formatDate } from '@/lib/utils';

async function getCoachData(coachId: string) {
  const [subscriptionsSnap, paymentsSnap] = await Promise.all([
    adminFirestore().collection('subscriptions').where('coachId', '==', coachId).orderBy('createdAt', 'desc').limit(3).get(),
    adminFirestore().collection('payments').where('coachId', '==', coachId).orderBy('createdAt', 'desc').limit(10).get(),
  ]);
  const subscriptions = subscriptionsSnap.docs.map((doc) => subscriptionSchema.parse({ ...doc.data(), id: doc.id }));
  const payments = paymentsSnap.docs.map((doc) => paymentSchema.parse({ ...doc.data(), id: doc.id }));
  return { subscriptions, payments };
}

export default async function BillingPage() {
  const user = await requireRole(['admin', 'teacher']);
  if (!user.coachId) throw new Error('Coach required');
  const { subscriptions, payments } = await getCoachData(user.coachId);
  const activeSubscription = subscriptions.find((subscription) => subscription.status === 'active') ?? subscriptions[0] ?? null;

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="text-muted-foreground">Manage your plan and submit manual payments.</p>
      </header>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Current plan</CardTitle>
          </CardHeader>
          <CardContent>
            {activeSubscription ? (
              <div className="space-y-2 text-sm">
                <div className="font-semibold capitalize">{activeSubscription.tier}</div>
                <div>Seat limit: {activeSubscription.seatLimit}</div>
                <div>Renewal date: {formatDate(activeSubscription.currentPeriodEnd)}</div>
                <div>Status: {activeSubscription.status}</div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No active subscription found.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Submit manual bank transfer</CardTitle>
          </CardHeader>
          <CardContent>
            <SubmitManualPaymentForm />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Payment history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {payments.map((payment) => (
            <div key={payment.id} className="flex items-center justify-between border-b py-2 last:border-none">
              <div>
                <div className="font-medium">{formatCurrency(payment.amount, payment.currency)}</div>
                <div className="text-xs text-muted-foreground">{formatDate(payment.createdAt)} · {payment.method}</div>
              </div>
              <div className="text-sm capitalize">{payment.status.replace('_', ' ')}</div>
            </div>
          ))}
          {!payments.length && <p className="text-muted-foreground">No payments yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
