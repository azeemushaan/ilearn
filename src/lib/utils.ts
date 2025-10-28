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
