import { getApps, initializeApp, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { readFileSync } from 'fs';
import { resolve } from 'path';

type FirebaseAdminConfig = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

let app: App | undefined;

export function getAdminApp() {
  if (app) {
    return app;
  }

  const existing = getApps()[0];
  if (existing) {
    app = existing;
    return app;
  }

  // Priority 1: Try service account key file first (more reliable)
  try {
    console.log('[FIREBASE] Attempting to load service account key file first');
    const serviceAccountPath = resolve(process.cwd(), 'sa-key.json');
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

    const config: FirebaseAdminConfig = {
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key,
    };

    const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${config.projectId}.appspot.com`;

    app = initializeApp({
      credential: cert(config),
      storageBucket,
    });

    console.log('[FIREBASE] Storage bucket configured:', storageBucket);
    console.log('[FIREBASE] Initialized with service account key file');
    return app;
  } catch (fileError) {
    console.warn('[FIREBASE] Service account key file not found or invalid:', fileError instanceof Error ? fileError.message : String(fileError));
  }

  // Priority 2: Try environment variables
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (projectId && clientEmail && privateKey) {
      console.log('[FIREBASE] Initializing with environment variables');

      const config: FirebaseAdminConfig = {
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'), // Handle escaped newlines
      };

      const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${config.projectId}.appspot.com`;

      app = initializeApp({
        credential: cert(config),
        storageBucket,
      });

      console.log('[FIREBASE] Storage bucket configured:', storageBucket);
      console.log('[FIREBASE] Initialized with environment variables');
      return app;
    }
  } catch (envError) {
    console.warn('[FIREBASE] Environment variable initialization failed:', envError);
  }


  // Priority 3: Fallback to application default credentials (for Google Cloud environments)
  try {
    console.log('[FIREBASE] Attempting to use application default credentials');
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`;

    app = initializeApp({
      projectId,
      storageBucket,
    });

    console.log('[FIREBASE] Storage bucket configured:', storageBucket);
    console.log('[FIREBASE] Initialized with application default credentials');
    return app;
  } catch (adcError) {
    console.error('[FIREBASE] All initialization methods failed');
    console.error('[FIREBASE] ADC Error:', adcError);
    throw new Error('Failed to initialize Firebase Admin SDK. Please configure Firebase credentials via environment variables or service account key file.');
  }
}

export const adminFirestore = () => getFirestore(getAdminApp());
export const adminAuth = () => getAuth(getAdminApp());
export const adminStorage = () => getStorage(getAdminApp());