#!/usr/bin/env tsx

/**
 * Firebase Admin Setup Script
 *
 * This script helps set up Firebase Admin SDK credentials for local development.
 * Run this after downloading the service account key from Firebase Console.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

async function setupFirebaseAdmin() {
  console.log('🔧 Firebase Admin SDK Setup');
  console.log('==============================');

  const saKeyPath = resolve(process.cwd(), 'sa-key.json');
  const envPath = resolve(process.cwd(), '.env.local');

  // Check if service account key exists
  if (!existsSync(saKeyPath)) {
    console.log('❌ sa-key.json not found!');
    console.log('');
    console.log('Please download the service account key:');
    console.log('1. Go to: https://console.firebase.google.com/project/studio-1899970548-e54c4/settings/serviceaccounts/adminsdk');
    console.log('2. Click "Generate new private key"');
    console.log('3. Save the file as "sa-key.json" in the project root');
    console.log('4. Run this script again');
    return;
  }

  try {
    // Read and parse the service account key
    const saKey = JSON.parse(readFileSync(saKeyPath, 'utf8'));
    console.log('✅ Service account key found and valid');

    // Read current .env.local
    let envContent = '';
    if (existsSync(envPath)) {
      envContent = readFileSync(envPath, 'utf8');
    }

    // Check if Firebase Admin credentials are already set
    const hasClientEmail = envContent.includes('FIREBASE_CLIENT_EMAIL=');
    const hasPrivateKey = envContent.includes('FIREBASE_PRIVATE_KEY=');

    if (hasClientEmail && hasPrivateKey) {
      console.log('⚠️  Firebase Admin credentials already configured in .env.local');
      console.log('   Skipping environment variable setup...');
    } else {
      // Add environment variables
      const envVars = `
# Firebase Admin (Server-side) - Environment Variables
FIREBASE_CLIENT_EMAIL=${saKey.client_email}
FIREBASE_PRIVATE_KEY="${saKey.private_key.replace(/\n/g, '\\n')}"
`.trim();

      if (envContent && !envContent.endsWith('\n')) {
        envContent += '\n';
      }
      envContent += '\n' + envVars + '\n';

      writeFileSync(envPath, envContent);
      console.log('✅ Firebase Admin credentials added to .env.local');
    }

    console.log('');
    console.log('🎉 Setup Complete!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Restart your development server: npm run dev');
    console.log('2. Test YouTube connection in the dashboard');
    console.log('');
    console.log('The YouTube channel connection should now work properly.');

  } catch (error) {
    console.error('❌ Error setting up Firebase Admin credentials:', error);
    console.log('');
    console.log('Please ensure:');
    console.log('1. sa-key.json is a valid JSON file');
    console.log('2. You have write permissions to .env.local');
  }
}

setupFirebaseAdmin().catch(console.error);
