
'use client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFirestore, useCollection, useMemoFirebase, useFirebaseAuth, useDoc } from "@/firebase";
import { collection, addDoc, serverTimestamp, query, where, doc, updateDoc } from "firebase/firestore";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SubscriptionPage = () => {
  const { user, claims, initializing, loadingClaims } = useFirebaseAuth();
  const router = useRouter();
  const firestore = useFirestore();

  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [transactionId, setTransactionId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, "users", user.uid);
  }, [firestore, user]);

  const { data: userProfile } = useDoc(userDocRef as any);

  const coachId = claims?.coachId || (userProfile as any)?.coachId;

  const plansCollectionRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'subscription_plans');
  }, [firestore]);

  const { data: plans, isLoading: isLoadingPlans } = useCollection(plansCollectionRef);

  const userSubscriptionRef = useMemoFirebase(() => {
    if (!firestore || !coachId) return null;
    return query(collection(firestore, "subscriptions"), where("coachId", "==", coachId), where("status", "in", ["active", "awaiting_payment"]));
  }, [firestore, coachId]);

  const { data: subscriptions, isLoading: isLoadingSubs } = useCollection(userSubscriptionRef);
  const currentSubscription = subscriptions?.[0];

  const handleChoosePlan = (plan: any) => {
    if (!coachId) {
      toast({ variant: "destructive", title: "You must be logged in to subscribe."});
      return;
    }

    const isFree = (plan.priceUSD === 0 && plan.pricePKR === 0);
    if (isFree) {
        subscribeToPlan(plan, "free", "");
    } else {
        setSelectedPlan(plan);
    }
  };

  const handleManualPayment = async () => {
    if (!transactionId) {
      toast({
        variant: "destructive",
        title: "Transaction ID required",
        description: "Please enter the transaction ID.",
      });
      return;
    }
    setIsSubmitting(true);
    await subscribeToPlan(selectedPlan, "manual_bank_transfer", transactionId);
    setSelectedPlan(null);
    setTransactionId("");
    setIsSubmitting(false);
  };

  const subscribeToPlan = async (plan: any, method: string, reference: string) => {
    if (!coachId || !firestore) {
        toast({ variant: "destructive", title: "Authentication error. Please refresh and try again."});
        return;
    }

    if (currentSubscription) {
        toast({
            title: "Existing Subscription Found",
            description: "You already have an active or pending subscription. Please manage it before subscribing to a new one.",
        });
        return;
    }

    try {
      const amount = plan.currency === 'USD' ? plan.priceUSD : plan.pricePKR;
      const isFree = method === 'free';

      const subscriptionsCollection = collection(firestore, 'subscriptions');
      const transactionsCollection = collection(firestore, 'transactions');

      // Create the subscription record first to get a reference ID
      const subscriptionDocRef = await addDoc(subscriptionsCollection, {
          coachId: coachId,
          planId: plan.id,
          tier: plan.tier,
          seatLimit: plan.maxStudents,
          status: isFree ? 'active' : 'awaiting_payment',
          currentPeriodEnd: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
      });

      // Create a transaction record that references the subscription
      const transactionDocRef = await addDoc(transactionsCollection, {
        coachId: coachId,
        subscriptionId: subscriptionDocRef.id,
        amount: amount,
        currency: plan.currency,
        method: method,
        status: isFree ? 'approved' : 'pending',
        reference: reference,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        planId: plan.id,
        planTitle: plan.name,
      });

      await updateDoc(subscriptionDocRef, {
        transactionId: transactionDocRef.id,
        updatedAt: serverTimestamp(),
      });

      if (!isFree) {
        toast({
            title: "Payment Submitted",
            description: "Admin will approve or reject your payment within 5 minutes.",
            className: "border-green-500 bg-green-50 text-green-900",
        });
      } else {
         toast({
            title: "Subscription successful!",
            description: `You have subscribed to the ${plan.name} plan.`,
        });
      }
      
      router.push('/dashboard');

    } catch (error: any) {
      console.error("Error subscribing to plan:", error);
      toast({
        variant: "destructive",
        title: "Subscription failed",
        description: error.message,
      });
    }
  };

  const Feature = ({ included, text }: { included: boolean; text: string }) => (
    <li className="flex items-start">
        {included ? <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" /> : <X className="h-5 w-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />}
        <span className="text-muted-foreground">{text}</span>
    </li>
  );
  
  const getPriceDisplay = (plan: any) => {
    if (!plan) return '';
    
    // Check for new schema with specific currency prices first
    if (plan.priceUSD === 0 && plan.pricePKR === 0) return 'Free';
    if (plan.currency === 'USD') return `$${plan.priceUSD}`;
    if (plan.currency === 'PKR') return `Rs${plan.pricePKR}`;
    
    // Fallback for old schema or undefined currency
    if (plan.price === 0) return 'Free';
    if (plan.price) return `$${plan.price}`;

    // Default case if no price is found
    return 'Free';
  }


  const isLoading = isLoadingPlans || isLoadingSubs || initializing || loadingClaims;

  return (
    <div className="flex flex-1 flex-col">
       <header className="p-4 md:p-6 border-b">
        <h1 className="text-2xl font-headline font-bold">Manage Subscription</h1>
        <p className="text-muted-foreground mt-1">Choose a plan that fits your needs.</p>
      </header>
      <main className="flex-1 p-4 md:p-6">
        <div className="mt-12 grid gap-8 md:grid-cols-3 items-stretch">
          {isLoading && <div className="md:col-span-3 text-center"><p>Loading plans...</p></div>}
          {!isLoading && plans?.length === 0 && <div className="md:col-span-3 text-center"><p>No subscription plans are currently available.</p></div>}
          {plans?.sort((a:any, b:any) => a.sort - b.sort).map((plan: any) => (
            <Card key={plan.id} className={cn("flex flex-col shadow-lg", currentSubscription?.planId === plan.id && "border-accent ring-2 ring-accent")}>
              <CardHeader className="pb-4">
                {currentSubscription?.planId === plan.id && (
                    <div className="text-sm font-semibold text-accent -mt-2 mb-2">CURRENT PLAN</div>
                )}
                <CardTitle className="text-2xl font-headline">{plan.name}</CardTitle>
                <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold">{getPriceDisplay(plan)}</span>
                    {!(plan.priceUSD === 0 && plan.pricePKR === 0) && <span className="text-muted-foreground">/ month</span>}
                </div>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="space-y-3">
                    <Feature included={true} text={`${plan.maxStudents} Student Seats`} />
                    <Feature included={true} text={`${plan.maxPlaylists} Playlists`} />
                    <Feature included={plan.enableQuizGeneration} text="AI Quiz Generation" />
                    <Feature included={plan.enableProgressTracking} text="Progress Tracking" />
                    <Feature included={plan.enableAntiSkip} text="Anti-Skip Controls" />
                </ul>
              </CardContent>
              <CardFooter>
                <Button 
                  className={cn("w-full", currentSubscription?.planId === plan.id ? "bg-secondary" : "bg-primary text-primary-foreground hover:bg-primary/90")}
                  onClick={() => handleChoosePlan(plan)}
                  disabled={isLoading || !!currentSubscription}
                >
                  {currentSubscription?.planId === plan.id ? 'Your Current Plan' : 'Choose Plan'}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
        <Dialog open={!!selectedPlan} onOpenChange={() => setSelectedPlan(null)}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Manual Bank Transfer</DialogTitle>
                    <DialogDescription>
                        To subscribe to the {selectedPlan?.name} plan, please transfer {getPriceDisplay(selectedPlan)} to the following account:
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="p-4 rounded-lg bg-muted">
                        <p className="font-semibold">Easypaisa</p>
                        <p>Account Number: 03345328814</p>
                    </div>
                    <div>
                        <Label htmlFor="transactionId">Transaction ID</Label>
                        <Input
                            id="transactionId"
                            value={transactionId}
                            onChange={(e) => setTransactionId(e.target.value)}
                            placeholder="Enter your transaction ID"
                            disabled={isSubmitting}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setSelectedPlan(null)} disabled={isSubmitting}>Cancel</Button>
                    <Button onClick={handleManualPayment} disabled={isSubmitting}>
                        {isSubmitting ? 'Submitting...' : 'Submit for Verification'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default SubscriptionPage;
