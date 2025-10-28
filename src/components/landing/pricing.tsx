'use client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, addDoc, serverTimestamp, doc } from "firebase/firestore";
import { useUser } from "@/firebase/auth/use-user";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const Pricing = () => {
  const firestore = useFirestore();
  const { user } = useUser();
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [transactionId, setTransactionId] = useState("");

  const plansCollectionRef = useMemoFirebase(() => {
      if(!firestore) return null;
      return collection(firestore, 'subscription_plans');
  }, [firestore]);
  
  const { data: plans, isLoading } = useCollection(plansCollectionRef);

  const handleChoosePlan = (plan: any) => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Not logged in",
        description: "You need to be logged in to choose a plan.",
      });
      return;
    }
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
    await subscribeToPlan(selectedPlan, "manual_bank_transfer", transactionId);
    setSelectedPlan(null);
    setTransactionId("");
  };

  const subscribeToPlan = async (plan: any, paymentMethod: string, transactionId: string) => {
    if (!firestore || !user) return;

    try {
      await addDoc(collection(firestore, 'teacher_subscriptions'), {
        userId: user.uid,
        subscriptionPlanId: plan.id,
        startDate: serverTimestamp(),
        endDate: null, // or calculate based on plan
        paymentMethod,
        transactionId,
        paymentStatus: paymentMethod === 'free' ? 'approved' : 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      toast({
        title: "Subscription successful!",
        description: `You have subscribed to the ${plan.name} plan.`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Subscription failed",
        description: error.message,
      });
    }
  };


  return (
    <section id="pricing" className="py-16 md:py-24 bg-secondary/30">
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-headline font-bold text-primary">
            Simple, Transparent Pricing
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Choose the plan that's right for you.
          </p>
        </div>
        <div className="mt-12 grid gap-8 md:grid-cols-3 items-stretch">
          {isLoading && <p>Loading plans...</p>}
          {plans?.map((plan: any) => (
            <Card key={plan.id} className={cn("flex flex-col shadow-lg", plan.name === "Pro" && "border-accent ring-2 ring-accent")}>
              <CardHeader className="pb-4">
                {plan.name === "Pro" && (
                    <div className="text-sm font-semibold text-accent -mt-2 mb-2">MOST POPULAR</div>
                )}
                <CardTitle className="text-2xl font-headline">{plan.name}</CardTitle>
                <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold">{plan.price === 0 ? 'Free' : `$${plan.price}`}</span>
                    <span className="text-muted-foreground">/ month</span>
                </div>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{plan.maxPlaylists} Playlists</span>
                  </li>
                   <li className="flex items-start">
                    <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{plan.maxStudents} Students</span>
                  </li>
                  <li className="flex items-start">
                    {plan.enableQuizGeneration ? <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" /> : <X className="h-5 w-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />}
                    <span className="text-muted-foreground">Quiz Generation</span>
                  </li>
                   <li className="flex items-start">
                    {plan.enableProgressTracking ? <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" /> : <X className="h-5 w-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />}
                    <span className="text-muted-foreground">Progress Tracking</span>
                  </li>
                  <li className="flex items-start">
                    {plan.enableAntiSkip ? <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" /> : <X className="h-5 w-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />}
                    <span className="text-muted-foreground">Anti-Skip Controls</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button 
                  className={cn("w-full", plan.name === "Pro" ? "bg-accent text-accent-foreground hover:bg-accent/90" : "bg-primary text-primary-foreground hover:bg-primary/90")}
                  onClick={() => handleChoosePlan(plan)}
                >
                  Choose Plan
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
                        To subscribe to the {selectedPlan?.name} plan, please transfer ${selectedPlan?.price} to the following account:
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
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setSelectedPlan(null)}>Cancel</Button>
                    <Button onClick={handleManualPayment}>Submit for Verification</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      </div>
    </section>
  );
};

export default Pricing;
