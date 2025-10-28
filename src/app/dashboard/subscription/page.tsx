'use client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFirestore, useCollection, useMemoFirebase, useFirebaseAuth } from "@/firebase";
import { collection, addDoc, serverTimestamp, getDocs, query, where } from "firebase/firestore";
import { toast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SubscriptionPage = () => {
  const { user, claims } = useFirebaseAuth();
  const router = useRouter();
  const firestore = useFirestore();

  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [transactionId, setTransactionId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const plansCollectionRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'subscription_plans');
  }, [firestore]);
  
  const { data: plans, isLoading: isLoadingPlans } = useCollection(plansCollectionRef);

  const userSubscriptionRef = useMemoFirebase(() => {
    if (!firestore || !claims?.coachId) return null;
    return query(collection(firestore, "subscriptions"), where("coachId", "==", claims.coachId), where("status", "in", ["active", "awaiting_payment"]));
  }, [firestore, claims]);

  const { data: subscriptions, isLoading: isLoadingSubs } = useCollection(userSubscriptionRef);
  const currentSubscription = subscriptions?.[0];

  const handleChoosePlan = (plan: any) => {
    if (plan.price > 0) {
      setSelectedPlan(plan);
    } else {
      // Handle free plan subscription directly
      subscribeToPlan(plan, "free", "");
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
    if (!user || !claims?.coachId || !firestore) {
        toast({ variant: "destructive", title: "You must be logged in to subscribe."});
        return;
    }
    
    if (currentSubscription) {
        toast({
            title: "Existing Subscription Found",
            description: "You already have an active or pending subscription. Please wait for it to be processed before changing plans.",
        });
        return;
    }

    try {
      const coachId = claims.coachId;

      await addDoc(collection(firestore, 'payments'), {
        coachId: coachId,
        amount: plan.price,
        currency: 'PKR',
        method: method,
        status: method === 'free' ? 'approved' : 'pending',
        reference: reference,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        planId: plan.id,
        planTitle: plan.name,
      });
      
      await addDoc(collection(firestore, 'subscriptions'), {
          coachId: coachId,
          planId: plan.id,
          tier: plan.tier,
          seatLimit: plan.maxStudents,
          status: method === 'free' ? 'active' : 'awaiting_payment',
          currentPeriodEnd: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
      });
      
      if (method !== 'free') {
        toast({
            title: "Submission Successful!",
            description: "Your payment is pending verification. This may take up to 5 minutes.",
        });
      } else {
         toast({
            title: "Subscription successful!",
            description: `You have subscribed to the ${plan.name} plan.`,
        });
      }
      // Re-route to dashboard to see updated status
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

  const isLoading = isLoadingPlans || isLoadingSubs;

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
                    <span className="text-4xl font-bold">{plan.price === 0 ? 'Free' : `Rs ${plan.price}`}</span>
                    <span className="text-muted-foreground">/ month</span>
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
                        To subscribe to the {selectedPlan?.name} plan, please transfer Rs {selectedPlan?.price} to the following account:
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
