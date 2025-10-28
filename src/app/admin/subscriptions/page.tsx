'use client';
import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle } from "lucide-react";
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
  title: z.string().min(1, "Plan name is required"),
  features: z.string().min(1, "Description is required"),
  pricePKR: z.preprocess((a) => parseFloat(z.string().parse(a)), z.number().min(0)),
  seatLimit: z.preprocess((a) => parseInt(z.string().parse(a), 10), z.number().int().min(0)),
  tier: z.enum(["free", "pro", "enterprise"]),
  sort: z.preprocess((a) => parseInt(z.string().parse(a), 10), z.number().int()),
  isActive: z.boolean().default(true),
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
        title: "",
        features: "",
        pricePKR: 0,
        seatLimit: 1,
        tier: "free",
        sort: 1,
        isActive: true,
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

  return (
    <div className="flex flex-1 flex-col">
      <header className="p-4 md:p-6 border-b">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-headline font-bold">Plans</h1>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
                <PlusCircle className="mr-2 h-4 w-4" />
                Create New Plan
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create New Plan</DialogTitle>
                <DialogDescription>
                  Fill out the details for the new plan.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)}>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="title" className="text-right">Name</Label>
                    <Input id="title" {...register("title")} className="col-span-3" />
                    {errors.title && <p className="col-span-4 text-red-500 text-sm text-right">{errors.title.message}</p>}
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="features" className="text-right">Features</Label>
                    <Input id="features" {...register("features")} className="col-span-3" placeholder="One feature per line" />
                     {errors.features && <p className="col-span-4 text-red-500 text-sm text-right">{errors.features.message}</p>}
                  </div>
                   <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="pricePKR" className="text-right">Price (PKR)</Label>
                    <Input id="pricePKR" type="number" {...register("pricePKR")} className="col-span-3" />
                     {errors.pricePKR && <p className="col-span-4 text-red-500 text-sm text-right">{errors.pricePKR.message}</p>}
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="seatLimit" className="text-right">Seat Limit</Label>
                    <Input id="seatLimit" type="number" {...register("seatLimit")} className="col-span-3" />
                     {errors.seatLimit && <p className="col-span-4 text-red-500 text-sm text-right">{errors.seatLimit.message}</p>}
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="tier" className="text-right">Tier</Label>
                    <select id="tier" {...register("tier")} className="col-span-3 border p-2 rounded-md">
                        <option value="free">Free</option>
                        <option value="pro">Pro</option>
                        <option value="enterprise">Enterprise</option>
                    </select>
                  </div>
                   <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="sort" className="text-right">Sort Order</Label>
                    <Input id="sort" type="number" {...register("sort")} className="col-span-3" />
                     {errors.sort && <p className="col-span-4 text-red-500 text-sm text-right">{errors.sort.message}</p>}
                  </div>
                   <div className="grid grid-cols-2 items-center gap-4 px-3 py-2 rounded-md border">
                     <Label htmlFor="isActive">Active</Label>
                    <Controller
                      control={control}
                      name="isActive"
                      render={({ field }) => (
                        <Switch
                          id="isActive"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          className="ml-auto"
                        />
                      )}
                    />
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
                        {plan.title}
                        <Badge variant={plan.pricePKR === 0 ? "secondary" : "default"}>
                            {plan.pricePKR === 0 ? 'Free' : `Rs ${plan.pricePKR}`}
                        </Badge>
                    </CardTitle>
                     <CardDescription>{(plan.features || "").split('\n')[0]}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                     <ul className="list-disc list-inside text-muted-foreground text-sm space-y-1">
                        <li>{plan.seatLimit} Teacher Seat(s)</li>
                       {(plan.features || "").split('\n').slice(1).map((feature: string, index: number) => (
                           <li key={index}>{feature}</li>
                       ))}
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
