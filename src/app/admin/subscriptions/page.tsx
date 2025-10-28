'use client';
import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Check, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

const planSchema = z.object({
  name: z.string().min(1, "Plan name is required"),
  description: z.string().min(1, "Description is required"),
  priceUSD: z.preprocess((a) => parseFloat(z.string().parse(a)), z.number().min(0)),
  pricePKR: z.preprocess((a) => parseFloat(z.string().parse(a)), z.number().min(0)),
  currency: z.enum(["USD", "PKR"]),
  maxStudents: z.preprocess((a) => parseInt(z.string().parse(a), 10), z.number().int().min(0)),
  maxPlaylists: z.preprocess((a) => parseInt(z.string().parse(a), 10), z.number().int().min(0)),
  tier: z.enum(["free", "pro", "enterprise"]),
  sort: z.preprocess((a) => parseInt(z.string().parse(a), 10), z.number().int()),
  isActive: z.boolean().default(true),
  enableQuizGeneration: z.boolean().default(true),
  enableProgressTracking: z.boolean().default(true),
  enableAntiSkip: z.boolean().default(true),
});

type PlanFormValues = z.infer<typeof planSchema>;

export default function PlansPage() {
  const firestore = useFirestore();
  const [open, setOpen] = React.useState(false);

  const plansCollectionRef = useMemoFirebase(() => {
      if(!firestore) return null;
      return collection(firestore, 'subscription_plans');
  }, [firestore]);
  
  const { data: plans, isLoading } = useCollection(plansCollectionRef);

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<PlanFormValues>({
    resolver: zodResolver(planSchema),
    defaultValues: {
        name: "",
        description: "",
        priceUSD: 0,
        pricePKR: 0,
        currency: "USD",
        maxStudents: 10,
        maxPlaylists: 1,
        tier: "free",
        sort: 1,
        isActive: true,
        enableQuizGeneration: true,
        enableProgressTracking: true,
        enableAntiSkip: false,
    }
  });

  const onSubmit = async (data: PlanFormValues) => {
    if (!firestore) return;
    try {
      await addDoc(collection(firestore, "subscription_plans"), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toast({
        title: "Plan created",
        description: "The new subscription plan has been added.",
      });
      setOpen(false);
      reset();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error creating plan",
        description: error.message,
      });
    }
  };
  
  const Feature = ({ included, text }: { included: boolean; text: string }) => (
    <li className="flex items-center gap-2 text-sm text-muted-foreground">
        {included ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-red-500" />}
        <span>{text}</span>
    </li>
  );

  return (
    <div className="flex flex-1 flex-col">
      <header className="p-4 md:p-6 border-b">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-headline font-bold">Subscription Plans</h1>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
                <PlusCircle className="mr-2 h-4 w-4" />
                Create New Plan
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Plan</DialogTitle>
                <DialogDescription>
                  Fill out the details for the new plan.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)}>
                <div className="grid gap-4 py-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Plan Name</Label>
                    <Input id="name" {...register("name")} />
                    {errors.name && <p className="text-red-500 text-sm">{errors.name.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Input id="description" {...register("description")} placeholder="e.g. Best for small teams" />
                     {errors.description && <p className="text-red-500 text-sm">{errors.description.message}</p>}
                  </div>
                   <div className="space-y-2">
                    <Label htmlFor="priceUSD">Price (USD)</Label>
                    <Input id="priceUSD" type="number" {...register("priceUSD")} />
                     {errors.priceUSD && <p className="text-red-500 text-sm">{errors.priceUSD.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pricePKR">Price (PKR)</Label>
                    <Input id="pricePKR" type="number" {...register("pricePKR")} />
                     {errors.pricePKR && <p className="text-red-500 text-sm">{errors.pricePKR.message}</p>}
                  </div>
                   <div className="space-y-2">
                    <Label htmlFor="currency">Default Currency</Label>
                    <select id="currency" {...register("currency")} className="w-full border p-2 rounded-md bg-transparent">
                        <option value="USD">USD ($)</option>
                        <option value="PKR">PKR (Rs)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxStudents">Student Seats</Label>
                    <Input id="maxStudents" type="number" {...register("maxStudents")} />
                     {errors.maxStudents && <p className="text-red-500 text-sm">{errors.maxStudents.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxPlaylists">Max Playlists</Label>
                    <Input id="maxPlaylists" type="number" {...register("maxPlaylists")} />
                     {errors.maxPlaylists && <p className="text-red-500 text-sm">{errors.maxPlaylists.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tier">Tier</Label>
                    <select id="tier" {...register("tier")} className="w-full border p-2 rounded-md bg-transparent">
                        <option value="free">Free</option>
                        <option value="pro">Pro</option>
                        <option value="enterprise">Enterprise</option>
                    </select>
                  </div>
                   <div className="space-y-2">
                    <Label htmlFor="sort">Sort Order</Label>
                    <Input id="sort" type="number" {...register("sort")} />
                     {errors.sort && <p className="text-red-500 text-sm">{errors.sort.message}</p>}
                  </div>
                  <div className="md:col-span-2 space-y-4 pt-4">
                     <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                        <Label htmlFor="isActive" className="flex flex-col space-y-1">
                            <span>Active</span>
                            <span className="font-normal leading-snug text-muted-foreground">Is this plan available for selection?</span>
                        </Label>
                        <Controller control={control} name="isActive" render={({ field }) => <Switch id="isActive" checked={field.value} onCheckedChange={field.onChange} />} />
                     </div>
                     <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                        <Label htmlFor="enableQuizGeneration" className="flex flex-col space-y-1">
                            <span>AI Quiz Generation</span>
                            <span className="font-normal leading-snug text-muted-foreground">Allow AI to generate quizzes.</span>
                        </Label>
                        <Controller control={control} name="enableQuizGeneration" render={({ field }) => <Switch id="enableQuizGeneration" checked={field.value} onCheckedChange={field.onChange} />} />
                     </div>
                     <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                        <Label htmlFor="enableProgressTracking" className="flex flex-col space-y-1">
                            <span>Progress Tracking</span>
                            <span className="font-normal leading-snug text-muted-foreground">Enable progress tracking for students.</span>
                        </Label>
                        <Controller control={control} name="enableProgressTracking" render={({ field }) => <Switch id="enableProgressTracking" checked={field.value} onCheckedChange={field.onChange} />} />
                     </div>
                     <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                        <Label htmlFor="enableAntiSkip" className="flex flex-col space-y-1">
                            <span>Anti-Skip Controls</span>
                            <span className="font-normal leading-snug text-muted-foreground">Prevent students from skipping video content.</span>
                        </Label>
                        <Controller control={control} name="enableAntiSkip" render={({ field }) => <Switch id="enableAntiSkip" checked={field.value} onCheckedChange={field.onChange} />} />
                     </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">Save Plan</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>
      <main className="flex-1 p-4 md:p-6">
        <div className="grid gap-6">
          {isLoading ? (
            <p>Loading plans...</p>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {plans?.map((plan: any) => (
                <Card key={plan.id}>
                  <CardHeader>
                    <CardTitle className="flex justify-between items-center">
                        {plan.name}
                        <Badge variant={plan.priceUSD === 0 && plan.pricePKR === 0 ? "secondary" : "default"}>
                            {plan.currency === 'USD' ? `$${plan.priceUSD}` : `Rs${plan.pricePKR}`}
                        </Badge>
                    </CardTitle>
                     <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                     <ul className="space-y-2">
                        <Feature included={true} text={`${plan.maxStudents} Student Seats`} />
                        <Feature included={true} text={`${plan.maxPlaylists} Playlists`} />
                        <Feature included={plan.enableQuizGeneration} text="AI Quiz Generation" />
                        <Feature included={plan.enableProgressTracking} text="Progress Tracking" />
                        <Feature included={plan.enableAntiSkip} text="Anti-Skip Controls" />
                    </ul>
                  </CardContent>
                  <CardFooter>
                      <Badge variant={plan.isActive ? "default" : "destructive"}>{plan.isActive ? 'Active' : 'Inactive'}</Badge>
                      <span className="text-xs text-muted-foreground ml-auto">Sort: {plan.sort}</span>
                  </CardFooter>
                </Card>
              ))}
               {plans?.length === 0 && !isLoading && (
                    <div className="md:col-span-3 text-center py-10">
                        <p>No plans found. Create one to get started.</p>
                    </div>
               )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
