'use client';
import React, { useEffect, useState } from 'react';
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
import { Separator } from '@/components/ui/separator';

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

function hslStringToHex(hslStr: string): string {
    if (!hslStr) return '#000000';
    const [h, s, l] = hslStr.split(' ').map(val => parseFloat(val.replace('%', '')));
    const sDecimal = s / 100;
    const lDecimal = l / 100;
    const c = (1 - Math.abs(2 * lDecimal - 1)) * sDecimal;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = lDecimal - c / 2;
    let r = 0, g = 0, b = 0;
    if (h >= 0 && h < 60) { [r, g, b] = [c, x, 0]; }
    else if (h >= 60 && h < 120) { [r, g, b] = [x, c, 0]; }
    else if (h >= 120 && h < 180) { [r, g, b] = [0, c, x]; }
    else if (h >= 180 && h < 240) { [r, g, b] = [0, x, c]; }
    else if (h >= 240 && h < 300) { [r, g, b] = [x, 0, c]; }
    else if (h >= 300 && h < 360) { [r, g, b] = [c, 0, x]; }
    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);
    return `#${[r, g, b].map(c => c.toString(16).padStart(2, '0')).join('')}`;
}

function hexToHslString(hex: string): string {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
        r = parseInt(hex[1] + hex[1], 16);
        g = parseInt(hex[2] + hex[2], 16);
        b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
        r = parseInt(hex.substring(1, 3), 16);
        g = parseInt(hex.substring(3, 5), 16);
        b = parseInt(hex.substring(5, 7), 16);
    }
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    h = Math.round(h * 360);
    s = Math.round(s * 100);
    l = Math.round(l * 100);
    return `${h} ${s}% ${l}%`;
}


const ColorPickerInput = ({ value, onChange }: { value: string, onChange: (value: string) => void }) => {
    const hexValue = value ? hslStringToHex(value) : '#000000';

    const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(hexToHslString(e.target.value));
    };

    return (
        <div className="flex items-center gap-2">
            <Input type="color" value={hexValue} onChange={handleHexChange} className="h-10 w-10 p-1" />
            <Input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder="e.g. 227 47% 20%" />
        </div>
    );
};


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
        <form onSubmit={handleSubmit(onSubmit)}>
          <Card>
            <CardHeader>
              <CardTitle>Branding</CardTitle>
              <CardDescription>Upload your organization's logo.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2">
                <Label htmlFor="logo">Logo</Label>
                <Input id="logo" type="file" />
                <p className="text-sm text-muted-foreground">
                  (Logo upload functionality coming soon)
                </p>
              </div>
            </CardContent>
          </Card>

          <Separator className="my-6" />

          <Card>
            <CardHeader>
              <CardTitle>Color Scheme</CardTitle>
              <CardDescription>Use the color pickers or enter HSL values directly. Changes will apply globally.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {Object.keys(themeSchema.shape).map((key) => (
                    <div key={key} className="grid gap-2">
                      <Label htmlFor={key} className="capitalize">{key.replace('-', ' ')}</Label>
                      <Controller
                          name={key as keyof ThemeFormValues}
                          control={control}
                          render={({ field }) => <ColorPickerInput {...field} />}
                        />
                      {errors[key as keyof ThemeFormValues] && <p className="text-red-500 text-sm">{errors[key as keyof ThemeFormValues]?.message}</p>}
                    </div>
                  ))}
                </div>
            </CardContent>
          </Card>
          
          <div className="mt-6 flex justify-end">
            <Button type="submit">Save Changes</Button>
          </div>
        </form>
      </main>
    </div>
  );
}
