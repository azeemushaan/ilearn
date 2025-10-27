'use client';
import React, { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase/auth/use-user';

// Helper to allow empty strings during validation which are then defaulted
const zstring = () => z.string().optional().default('');

const themeSchema = z.object({
  background: z.string(),
  foreground: z.string(),
  primary: z.string(),
  'primary-foreground': z.string(),
  secondary: z.string(),
  'secondary-foreground': z.string(),
  accent: z.string(),
  'accent-foreground': z.string(),
  card: z.string(),
  'card-foreground': z.string(),
});

type ThemeFormValues = z.infer<typeof themeSchema>;

export default function SettingsPage() {
  const firestore = useFirestore();
  const router = useRouter();
  const { user, isUserLoading } = useUser();

  const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const {data: userData} = useDoc(userDocRef);

  const themeDocRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'settings', 'theme');
  }, [firestore]);
  
  const { data: themeData, isLoading } = useDoc(themeDocRef);

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<ThemeFormValues>({
    resolver: zodResolver(themeSchema),
    defaultValues: {
      background: '225 100% 97%',
      foreground: '227 47% 20%',
      primary: '227 47% 25%',
      'primary-foreground': '0 0% 98%',
      secondary: '225 30% 94%',
      'secondary-foreground': '227 47% 25%',
      accent: '260 59% 65%',
      'accent-foreground': '0 0% 98%',
      card: '0 0% 100%',
      'card-foreground': '227 47% 20%',
    }
  });

  useEffect(() => {
    if (!isUserLoading && userData && (userData as any).role !== 'admin') {
      toast({ variant: 'destructive', title: 'Unauthorized', description: 'You do not have permission to view this page.' });
      router.push('/dashboard');
    }
  }, [isUserLoading, userData, router]);

  useEffect(() => {
    if (themeData) {
      reset(themeData as any);
    }
  }, [themeData, reset]);

  const onSubmit = async (data: ThemeFormValues) => {
    if (!firestore) return;
    try {
      await setDoc(doc(firestore, 'settings', 'theme'), data, { merge: true });
      toast({
        title: 'Theme updated',
        description: 'Your new color theme has been applied.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error updating theme',
        description: error.message,
      });
    }
  };

  if (isUserLoading || isLoading) {
    return <div>Loading...</div>;
  }
  
  if(!isUserLoading && (!user || (userData && (userData as any).role !== 'admin'))){
      return null;
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="p-4 md:p-6 border-b">
        <h1 className="text-2xl font-headline font-bold">Website Settings</h1>
        <p className="text-muted-foreground mt-1">Customize the look and feel of the iLearn platform.</p>
      </header>
      <main className="flex-1 p-4 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle>Color Scheme</CardTitle>
            <CardDescription>Enter HSL values (e.g., '225 100% 97%') for each color. Changes will apply globally.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.keys(themeSchema.shape).map((key) => (
                  <div key={key} className="grid gap-2">
                    <Label htmlFor={key} className="capitalize">{key.replace('-', ' ')}</Label>
                    <Input id={key} {...register(key as keyof ThemeFormValues)} />
                    {errors[key as keyof ThemeFormValues] && <p className="text-red-500 text-sm">{errors[key as keyof ThemeFormValues]?.message}</p>}
                  </div>
                ))}
              </div>
              <div className="mt-6 flex justify-end">
                <Button type="submit">Save Changes</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
