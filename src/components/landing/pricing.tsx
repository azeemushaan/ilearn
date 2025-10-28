
'use client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/firebase";
import { collection, addDoc, serverTimestamp, getDocs, query, getFirestore } from "firebase/firestore";
import { getApp, getApps, initializeApp } from "firebase/app";
import { toast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { firebaseConfig } from "@/firebase/config";

// Helper to initialize Firebase outside of the normal authenticated flow
const getPublicFirestore = () => {
    const apps = getApps();
    const app = apps.length > 0 ? apps[0] : initializeApp(firebaseConfig);
    return getFirestore(app);
}

const Pricing = () => {
  const { user } = useUser();
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [transactionId, setTransactionId] = useState("");
  const [plans, setPlans] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPlans = async () => {
      setIsLoading(true);
      try {
        const db = getPublicFirestore();
        const plansCollectionRef = collection(db, 'plans');
        // Fetch ALL plans, not just active ones.
        const q = query(plansCollectionRef);
        const querySnapshot = await getDocs(q);
        const plansData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setPlans(plansData.sort((a, b) => a.sort - b.sort));
      } catch (error) {
        console.error("Error fetching plans:", error);
        toast({
          variant: "destructive",
          title: "Could not load pricing plans",
          description: "Please try refreshing the page.",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlans();
  }, []);

  const handleChoosePlan = (plan: any) => {
    if (!user) {
      router.push('/signup');
      return;
    }
    if (plan.pricePKR > 0) {
      setSelectedPlan(plan);
    } else {
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
    const firestore = getPublicFirestore();
    await subscribeToPlan(selectedPlan, "manual_bank", transactionId, firestore);
    setSelectedPlan(null);
    setTransactionId("");
  };

  const subscribeToPlan = async (plan: any, method: string, reference: string, db?: any) => {
    const firestore = db || getPublicFirestore();
    if (!user) return;

    try {
      await addDoc(collection(firestore, 'payments'), {
        coachId: user.uid,
        amount: plan.pricePKR,
        currency: 'PKR',
        method: method,
        status: method === 'free' ? 'approved' : 'pending',
        reference: reference,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        planId: plan.id,
        planTitle: plan.title,
      });
      
      if (method !== 'free') {
        toast({
            title: "Submission Successful!",
            description: "Your payment is pending verification. This may take up to 24 hours.",
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
          {isLoading && <div className="md:col-span-3 text-center"><p>Loading plans...</p></div>}
          {!isLoading && plans.length === 0 && <div className="md:col-span-3 text-center"><p>No plans found.</p></div>}
          {plans.map((plan: any) => (
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
                <CardDescription>{(plan.features || "").split('\n')[0]}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{plan.seatLimit} Teacher Seats</span>
                  </li>
                  {(plan.features || "").split('\n').filter((f: string) => f.trim() !== '').map((feature: string, index: number) => (
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
