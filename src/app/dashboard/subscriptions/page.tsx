'use client';
import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  name: z.string().min(1, "Plan name is required"),
  description: z.string().min(1, "Description is required"),
  price: z.preprocess((a) => parseFloat(z.string().parse(a)), z.number().min(0)),
  maxStudents: z.preprocess((a) => parseInt(z.string().parse(a), 10), z.number().int().min(0)),
  maxPlaylists: z.preprocess((a) => parseInt(z.string().parse(a), 10), z.number().int().min(0)),
  enableQuizGeneration: z.boolean().default(false),
  enableProgressTracking: z.boolean().default(false),
  enableAntiSkip: z.boolean().default(false),
});

type PlanFormValues = z.infer<typeof planSchema>;

export default function SubscriptionsPage() {
  const firestore = useFirestore();
  const [open, setOpen] = React.useState(false);

  const plansCollectionRef = useMemoFirebase(() => {
      if(!firestore) return null;
      return collection(firestore, 'subscription_plans');
  }, [firestore]);
  
  const { data: plans, isLoading } = useCollection(plansCollectionRef);

  const { register, handleSubmit, control, formState: { errors } } = useForm<PlanFormValues>({
    resolver: zodResolver(planSchema),
    defaultValues: {
        name: "",
        description: "",
        price: 0,
        maxStudents: 0,
        maxPlaylists: 0,
        enableQuizGeneration: false,
        enableProgressTracking: false,
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
          <h1 className="text-2xl font-headline font-bold">Subscription Plans</h1>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
                <PlusCircle className="mr-2 h-4 w-4" />
                Create New Plan
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create New Subscription Plan</DialogTitle>
                <DialogDescription>
                  Fill out the details for the new plan.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)}>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">Name</Label>
                    <Input id="name" {...register("name")} className="col-span-3" />
                    {errors.name && <p className="col-span-4 text-red-500 text-sm text-right">{errors.name.message}</p>}
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="description" className="text-right">Description</Label>
                    <Input id="description" {...register("description")} className="col-span-3" />
                     {errors.description && <p className="col-span-4 text-red-500 text-sm text-right">{errors.description.message}</p>}
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="price" className="text-right">Price</Label>
                    <Input id="price" type="number" {...register("price")} className="col-span-3" />
                     {errors.price && <p className="col-span-4 text-red-500 text-sm text-right">{errors.price.message}</p>}
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="maxStudents" className="text-right">Max Students</Label>
                    <Input id="maxStudents" type="number" {...register("maxStudents")} className="col-span-3" />
                     {errors.maxStudents && <p className="col-span-4 text-red-500 text-sm text-right">{errors.maxStudents.message}</p>}
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="maxPlaylists" className="text-right">Max Playlists</Label>
                    <Input id="maxPlaylists" type="number" {...register("maxPlaylists")} className="col-span-3" />
                     {errors.maxPlaylists && <p className="col-span-4 text-red-500 text-sm text-right">{errors.maxPlaylists.message}</p>}
                  </div>
                   <div className="grid grid-cols-2 items-center gap-4 px-3 py-2 rounded-md border">
                     <Label htmlFor="enableQuizGeneration">Quiz Generation</Label>
                    <Controller
                      control={control}
                      name="enableQuizGeneration"
                      render={({ field }) => (
                        <Switch
                          id="enableQuizGeneration"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          className="ml-auto"
                        />
                      )}
                    />
                  </div>
                   <div className="grid grid-cols-2 items-center gap-4 px-3 py-2 rounded-md border">
                     <Label htmlFor="enableProgressTracking">Progress Tracking</Label>
                     <Controller
                      control={control}
                      name="enableProgressTracking"
                      render={({ field }) => (
                        <Switch
                          id="enableProgressTracking"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          className="ml-auto"
                        />
                      )}
                    />
                  </div>
                   <div className="grid grid-cols-2 items-center gap-4 px-3 py-2 rounded-md border">
                     <Label htmlFor="enableAntiSkip">Anti-Skip Feature</Label>
                     <Controller
                      control={control}
                      name="enableAntiSkip"
                      render={({ field }) => (
                        <Switch
                          id="enableAntiSkip"
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
                        {plan.name}
                        <Badge variant={plan.price === 0 ? "secondary" : "default"}>
                            {plan.price === 0 ? 'Free' : `$${plan.price}`}
                        </Badge>
                    </CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                        <p className="font-semibold">Limits:</p>
                        <ul className="list-disc list-inside text-muted-foreground text-sm">
                            <li>{plan.maxStudents} Students</li>
                            <li>{plan.maxPlaylists} Playlists</li>
                        </ul>
                    </div>
                    <div>
                        <p className="font-semibold">Features:</p>
                         <ul className="list-disc list-inside text-muted-foreground text-sm">
                            <li>Quiz Generation: {plan.enableQuizGeneration ? "✅" : "❌"}</li>
                            <li>Progress Tracking: {plan.enableProgressTracking ? "✅" : "❌"}</li>
                            <li>Anti-Skip Controls: {plan.enableAntiSkip ? "✅" : "❌"}</li>
                        </ul>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
