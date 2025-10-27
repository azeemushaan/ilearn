'use server';
/**
 * @fileOverview A flow for setting custom claims on a Firebase user.
 *
 * - setUserClaims - A function that sets custom claims for a user.
 * - SetUserClaimsInput - The input type for the setUserClaims function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK if not already initialized
if (admin.apps.length === 0) {
  // In a real production environment, you would use a more secure way 
  // to handle credentials, such as environment variables or a secret manager.
  // For this environment, we'll check for an env var.
  try {
    admin.initializeApp();
  } catch(e) {
    console.error("Default admin.initializeApp() failed. This is expected in local dev without GOOGLE_APPLICATION_CREDENTIALS.", e);
    // Fallback for local development if default credentials aren't set
    // NOTE: This part might need adjustment based on the specific dev environment setup.
    // If you have a service account JSON file, you can load it here.
    // For now, we rely on the server environment having the credentials.
  }
}

const SetUserClaimsInputSchema = z.object({
  uid: z.string().describe('The user ID (uid) to set claims for.'),
  claims: z.object({
    role: z.string().describe('The role to assign to the user (e.g., "admin", "teacher").'),
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
      console.log(`[Admin SDK] Attempting to set claims for UID: ${uid}`, claims);
      await admin.auth().setCustomUserClaims(uid, claims);
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
