'use client';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useEffect } from 'react';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const firestore = useFirestore();

    const themeDocRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return doc(firestore, 'settings', 'theme');
    }, [firestore]);

    const { data: themeData } = useDoc(themeDocRef);
    
    useEffect(() => {
        if (themeData) {
            const root = document.documentElement;
            Object.entries(themeData).forEach(([key, value]) => {
                if(key !== 'id') {
                    root.style.setProperty(`--${key}`, value as string);
                }
            });
        }
    }, [themeData]);

    return <>{children}</>;
}
