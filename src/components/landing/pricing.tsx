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
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const Pricing = () => {
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [transactionId, setTransactionId] = useState("");

  const plansCollectionRef = useMemoFirebase(() => {
      if(!firestore) return null;
      // The collection is named 'plans' as per the latest backend.json
      return collection(firestore, 'plans');
  }, [firestore]);
  
  const { data: plans, isLoading } = useCollection(plansCollectionRef);

  const handleChoosePlan = (plan: any) => {
    if (!user) {
      router.push('/signup');
      return;
    }
    if (plan.pricePKR > 0) {
      setSelectedPlan(plan);
    } else {
      // This will now use the /payments collection as per the new schema
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
    await subscribeToPlan(selectedPlan, "manual_bank", transactionId);
    setSelectedPlan(null);
    setTransactionId("");
  };

  const subscribeToPlan = async (plan: any, method: string, reference: string) => {
    if (!firestore || !user) return;

    try {
      // As per the new schema, we should create a payment record
      await addDoc(collection(firestore, 'payments'), {
        coachId: user.uid, // Assuming the user is the coach
        amount: plan.pricePKR,
        currency: 'PKR',
        method: method,
        status: method === 'free' ? 'approved' : 'pending',
        reference: reference,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      if (method !== 'free') {
        toast({
            title: "Submission Successful!",
            description: "Your payment is pending. An admin will approve or reject it within 5 minutes.",
        });
      } else {
         toast({
            title: "Subscription successful!",
            description: `You have subscribed to the ${plan.title} plan.`,
        });
      }

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
          {plans?.filter((p: any) => p.isActive).sort((a: any, b: any) => a.sort - b.sort).map((plan: any) => (
            <Card key={plan.id} className={cn("flex flex-col shadow-lg", plan.tier === "pro" && "border-accent ring-2 ring-accent")}>
              <CardHeader className="pb-4">
                {plan.tier === "pro" && (
                    <div className="text-sm font-semibold text-accent -mt-2 mb-2">MOST POPULAR</div>
                )}
                <CardTitle className="text-2xl font-headline">{plan.title}</CardTitle>
                <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold">{plan.pricePKR === 0 ? 'Free' : `Rs ${plan.pricePKR}`}</span>
                    <span className="text-muted-foreground">/ month</span>
                </div>
                <CardDescription>{plan.features.split(',')[0]}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{plan.seatLimit} Seats</span>
                  </li>
                  {plan.features.split(',').map((feature: string, index: number) => (
                       <li key={index} className="flex items-start">
                           <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                           <span className="text-muted-foreground">{feature.trim()}</span>
                       </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button 
                  className={cn("w-full", plan.tier === "pro" ? "bg-accent text-accent-foreground hover:bg-accent/90" : "bg-primary text-primary-foreground hover:bg-primary/90")}
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
                        To subscribe to the {selectedPlan?.title} plan, please transfer Rs {selectedPlan?.pricePKR} to the following account:
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
