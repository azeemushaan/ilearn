/**
 * Credit Management System
 * Handles credit balance, reservations, consumption, and refunds
 */

import { adminFirestore } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

export interface CreditBalance {
  coachId: string;
  balance: number;
  reservedCredits: number;
  availableCredits: number;
  monthlyAllotment: number;
  rolloverEnabled: boolean;
}

export interface CreditEstimate {
  required: number;
  available: number;
  sufficient: boolean;
}

/**
 * Estimate credits required for AI transcription
 * 1 credit = 1 minute of video
 * Minimum 2 credits for videos < 60 seconds
 */
export function estimateCredits(durationSeconds: number): number {
  if (durationSeconds < 60) return 2;
  return Math.ceil(durationSeconds / 60);
}

/**
 * Get coach credit balance
 */
export async function getCreditBalance(coachId: string): Promise<CreditBalance> {
  const db = adminFirestore();
  const billingRef = db.collection('coach_billing').doc(coachId);
  const billingDoc = await billingRef.get();

  if (!billingDoc.exists) {
    // Initialize billing document
    const initialData = {
      coachId,
      balance: 0,
      reservedCredits: 0,
      monthlyAllotment: 0,
      rolloverEnabled: false,
      lastAllotmentDate: null,
      updatedAt: Timestamp.now(),
    };

    await billingRef.set(initialData);

    return {
      coachId,
      balance: 0,
      reservedCredits: 0,
      availableCredits: 0,
      monthlyAllotment: 0,
      rolloverEnabled: false,
    };
  }

  const data = billingDoc.data()!;

  return {
    coachId,
    balance: data.balance || 0,
    reservedCredits: data.reservedCredits || 0,
    availableCredits: (data.balance || 0) - (data.reservedCredits || 0),
    monthlyAllotment: data.monthlyAllotment || 0,
    rolloverEnabled: data.rolloverEnabled || false,
  };
}

/**
 * Check if coach has sufficient credits
 */
export async function checkSufficientCredits(
  coachId: string,
  required: number
): Promise<CreditEstimate> {
  const balance = await getCreditBalance(coachId);

  return {
    required,
    available: balance.availableCredits,
    sufficient: balance.availableCredits >= required,
  };
}

/**
 * Reserve credits for a batch job
 */
export async function reserveCredits(
  coachId: string,
  amount: number,
  actorId: string,
  metadata?: { videoId?: string; batchJobId?: string; reason?: string }
): Promise<{ success: boolean; newBalance: number }> {
  const db = adminFirestore();

  return await db.runTransaction(async (transaction) => {
    const billingRef = db.collection('coach_billing').doc(coachId);
    const billingDoc = await transaction.get(billingRef);

    if (!billingDoc.exists) {
      throw new Error('Billing record not found');
    }

    const data = billingDoc.data()!;
    const currentBalance = data.balance || 0;
    const currentReserved = data.reservedCredits || 0;
    const available = currentBalance - currentReserved;

    if (available < amount) {
      throw new Error(`Insufficient credits. Need ${amount}, have ${available} available`);
    }

    const newReserved = currentReserved + amount;

    transaction.update(billingRef, {
      reservedCredits: newReserved,
      updatedAt: Timestamp.now(),
    });

    // Log transaction
    const transactionRef = db.collection('credit_transactions').doc();
    transaction.set(transactionRef, {
      coachId,
      type: 'reserve',
      amount,
      videoId: metadata?.videoId || null,
      batchJobId: metadata?.batchJobId || null,
      reason: metadata?.reason || null,
      balanceBefore: currentBalance,
      balanceAfter: currentBalance, // Balance stays same, just reserved
      actorId,
      createdAt: Timestamp.now(),
    });

    return {
      success: true,
      newBalance: currentBalance,
    };
  });
}

/**
 * Consume reserved credits
 */
export async function consumeCredits(
  coachId: string,
  amount: number,
  actorId: string,
  metadata?: { videoId?: string; batchJobId?: string; reason?: string }
): Promise<{ success: boolean; newBalance: number }> {
  const db = adminFirestore();

  return await db.runTransaction(async (transaction) => {
    const billingRef = db.collection('coach_billing').doc(coachId);
    const billingDoc = await transaction.get(billingRef);

    if (!billingDoc.exists) {
      throw new Error('Billing record not found');
    }

    const data = billingDoc.data()!;
    const currentBalance = data.balance || 0;
    const currentReserved = data.reservedCredits || 0;

    if (currentBalance < amount) {
      throw new Error(`Insufficient balance to consume ${amount} credits`);
    }

    if (currentReserved < amount) {
      throw new Error(`Insufficient reserved credits to consume ${amount}`);
    }

    const newBalance = currentBalance - amount;
    const newReserved = currentReserved - amount;

    transaction.update(billingRef, {
      balance: newBalance,
      reservedCredits: newReserved,
      updatedAt: Timestamp.now(),
    });

    // Log transaction
    const transactionRef = db.collection('credit_transactions').doc();
    transaction.set(transactionRef, {
      coachId,
      type: 'consume',
      amount: -amount,
      videoId: metadata?.videoId || null,
      batchJobId: metadata?.batchJobId || null,
      reason: metadata?.reason || null,
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
      actorId,
      createdAt: Timestamp.now(),
    });

    return {
      success: true,
      newBalance,
    };
  });
}

/**
 * Refund credits on failure
 */
export async function refundCredits(
  coachId: string,
  amount: number,
  actorId: string,
  metadata?: { videoId?: string; batchJobId?: string; reason?: string }
): Promise<{ success: boolean; newBalance: number }> {
  const db = adminFirestore();

  return await db.runTransaction(async (transaction) => {
    const billingRef = db.collection('coach_billing').doc(coachId);
    const billingDoc = await transaction.get(billingRef);

    if (!billingDoc.exists) {
      throw new Error('Billing record not found');
    }

    const data = billingDoc.data()!;
    const currentBalance = data.balance || 0;
    const currentReserved = data.reservedCredits || 0;

    const newBalance = currentBalance + amount;
    const newReserved = Math.max(0, currentReserved - amount);

    transaction.update(billingRef, {
      balance: newBalance,
      reservedCredits: newReserved,
      updatedAt: Timestamp.now(),
    });

    // Log transaction
    const transactionRef = db.collection('credit_transactions').doc();
    transaction.set(transactionRef, {
      coachId,
      type: 'refund',
      amount,
      videoId: metadata?.videoId || null,
      batchJobId: metadata?.batchJobId || null,
      reason: metadata?.reason || 'Processing failed',
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
      actorId,
      createdAt: Timestamp.now(),
    });

    return {
      success: true,
      newBalance,
    };
  });
}

/**
 * Release unused reserved credits
 */
export async function releaseReservedCredits(
  coachId: string,
  amount: number,
  actorId: string,
  metadata?: { videoId?: string; batchJobId?: string; reason?: string }
): Promise<{ success: boolean }> {
  const db = adminFirestore();

  return await db.runTransaction(async (transaction) => {
    const billingRef = db.collection('coach_billing').doc(coachId);
    const billingDoc = await transaction.get(billingRef);

    if (!billingDoc.exists) {
      throw new Error('Billing record not found');
    }

    const data = billingDoc.data()!;
    const currentBalance = data.balance || 0;
    const currentReserved = data.reservedCredits || 0;

    const newReserved = Math.max(0, currentReserved - amount);

    transaction.update(billingRef, {
      reservedCredits: newReserved,
      updatedAt: Timestamp.now(),
    });

    // Log transaction
    const transactionRef = db.collection('credit_transactions').doc();
    transaction.set(transactionRef, {
      coachId,
      type: 'release',
      amount: -amount,
      videoId: metadata?.videoId || null,
      batchJobId: metadata?.batchJobId || null,
      reason: metadata?.reason || 'Reservation released',
      balanceBefore: currentBalance,
      balanceAfter: currentBalance, // Balance unchanged
      actorId,
      createdAt: Timestamp.now(),
    });

    return {
      success: true,
    };
  });
}

/**
 * Add credits to coach account (admin only)
 */
export async function addCredits(
  coachId: string,
  amount: number,
  actorId: string,
  reason?: string
): Promise<{ success: boolean; newBalance: number }> {
  const db = adminFirestore();

  return await db.runTransaction(async (transaction) => {
    const billingRef = db.collection('coach_billing').doc(coachId);
    const billingDoc = await transaction.get(billingRef);

    const currentBalance = billingDoc.exists ? (billingDoc.data()!.balance || 0) : 0;
    const newBalance = currentBalance + amount;

    if (billingDoc.exists) {
      transaction.update(billingRef, {
        balance: newBalance,
        updatedAt: Timestamp.now(),
      });
    } else {
      transaction.set(billingRef, {
        coachId,
        balance: newBalance,
        reservedCredits: 0,
        monthlyAllotment: 0,
        rolloverEnabled: false,
        lastAllotmentDate: null,
        updatedAt: Timestamp.now(),
      });
    }

    // Log transaction
    const transactionRef = db.collection('credit_transactions').doc();
    transaction.set(transactionRef, {
      coachId,
      type: amount > 0 ? 'purchase' : 'adjustment',
      amount,
      reason: reason || 'Manual adjustment',
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
      actorId,
      createdAt: Timestamp.now(),
    });

    return {
      success: true,
      newBalance,
    };
  });
}

