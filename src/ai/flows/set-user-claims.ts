'use server';
/**
 * @fileOverview A flow for setting custom claims on a Firebase user.
 *
 * - setUserClaims - A function that sets custom claims for a user.
 * - SetUserClaimsInput - The input type for the setUserClaims function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { adminAuth } from '@/lib/firebase/admin';

const SetUserClaimsInputSchema = z.object({
  uid: z.string().describe('The user ID (uid) to set claims for.'),
  claims: z.object({
    role: z.string().describe('The role to assign to the user (e.g., "admin", "coach").'),
    coachId: z.string().optional().describe('The coach ID associated with the user.'),
  }),
});
export type SetUserClaimsInput = z.infer<typeof SetUserClaimsInputSchema>;

export async function setUserClaims(input: SetUserClaimsInput): Promise<{ success: boolean; message: string }> {
  return setUserClaimsFlow(input);
}

const setUserClaimsFlow = ai.defineFlow(
  {
    name: 'setUserClaimsFlow',
    inputSchema: SetUserClaimsInputSchema,
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
    }),
  },
  async ({ uid, claims }) => {
    try {
      const auth = adminAuth();
      console.log(`[Admin SDK] Attempting to set claims for UID: ${uid}`, claims);
      await auth.setCustomUserClaims(uid, claims);
      console.log(`[Admin SDK] Successfully set claims for UID: ${uid}`);
      return {
        success: true,
        message: `Successfully set custom claims for user ${uid}.`,
      };
    } catch (error: any) {
      console.error('[Admin SDK] Error setting custom claims:', error);
      return {
        success: false,
        message: error.message || 'An unknown error occurred while setting custom claims.',
      };
    }
  }
);
