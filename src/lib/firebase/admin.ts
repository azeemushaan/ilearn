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

  // Load from service account key file
  try {
    const serviceAccountPath = resolve(process.cwd(), 'sa-key.json');
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    
    const config: FirebaseAdminConfig = {
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key,
    };

    // Firebase Storage can use either the new .firebasestorage.app domain or legacy .appspot.com
    // Both point to the same bucket, but Admin SDK works with both formats
    const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${config.projectId}.appspot.com`;
    
    app = initializeApp({
      credential: cert(config),
      storageBucket,
    });
    
    console.log('[FIREBASE] Storage bucket configured:', storageBucket);

    console.log('[FIREBASE] Initialized with service account key file');
    return app;
  } catch (error) {
    console.error('[FIREBASE] Failed to load service account key file:', error);
    throw new Error('Failed to initialize Firebase Admin SDK. Please check your service account key file.');
  }
}

export const adminFirestore = () => getFirestore(getAdminApp());
export const adminAuth = () => getAuth(getAdminApp());
export const adminStorage = () => getStorage(getAdminApp());