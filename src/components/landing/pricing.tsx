

'use client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, addDoc, serverTimestamp, getDocs, query, where, getFirestore } from "firebase/firestore";
import { getApps, initializeApp } from "firebase/app";
import { firebaseConfig } from "@/firebase/config";
import { useAuth } from "@/firebase";
import { toast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const Pricing = () => {
  const { user } = useAuth();
  const router = useRouter();

  const [plans, setPlans] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPlans = async () => {
      setIsLoading(true);
      try {
        const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
        const db = getFirestore(app);
        
        const plansCollectionRef = collection(db, 'subscription_plans');
        const q = query(plansCollectionRef, where("isActive", "==", true));
        const querySnapshot = await getDocs(q);
        
        const plansData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        setPlans(plansData.sort((a, b) => a.sort - b.sort));
      } catch (error) {
        console.error("Error fetching plans:", error);
        toast({
          variant: "destructive",
          title: "Could not load pricing plans",
          description: "There was an issue fetching pricing information.",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlans();
  }, []);

  const handleChoosePlan = (plan: any) => {
      router.push('/signup');
  };

  const Feature = ({ included, text }: { included: boolean; text: string }) => (
    <li className="flex items-start">
        {included ? <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" /> : <X className="h-5 w-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />}
        <span className="text-muted-foreground">{text}</span>
    </li>
  );


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
                  className={cn("w-full", plan.tier === "pro" ? "bg-accent text-accent-foreground hover:bg-accent/90" : "bg-primary text-primary-foreground hover:bg-primary/90")}
                  onClick={() => handleChoosePlan(plan)}
                  disabled={isLoading}
                >
                  Choose Plan
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Pricing;
