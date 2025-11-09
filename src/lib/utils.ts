import { clsx, type ClassValue } from 'clsx';
import { format } from 'date-fns';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value?: Date | null) {
  if (!value) return '—';
  return format(value, 'PP pp');
}

export function formatCurrency(amount: number, currency: 'PKR' | 'USD') {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency,
    currencyDisplay: 'symbol',
  }).format(amount);
}

export const KARACHI_TZ = 'Asia/Karachi';

/**
 * Remove undefined values from objects recursively
 * Firestore doesn't allow undefined values
 */
export function cleanFirestoreData(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(cleanFirestoreData);
  }

  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const cleanedValue = cleanFirestoreData(value);
      if (cleanedValue !== undefined) {
        cleaned[key] = cleanedValue;
      }
    }
    return cleaned;
  }

  return obj;
}
