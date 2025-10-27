
import * as admin from 'firebase-admin';
import { config } from 'dotenv';
config();

// --- Configuration ---
const ADMIN_EMAIL = 'ilearn@er21.org';
const ADMIN_PASSWORD = '123456789';
// --- End Configuration ---


// Initialize Firebase Admin SDK
if (admin.apps.length === 0) {
  try {
    // In a managed environment, this will use default credentials
    admin.initializeApp();
    console.log("✅ [Admin SDK] Initialized successfully using default credentials.");
  } catch (e: any) {
    console.error("❌ [Admin SDK] Default initialization failed. This script must be run in a GCP environment or with service account credentials configured.", e.message);
    process.exit(1);
  }
}

const auth = admin.auth();
const firestore = admin.firestore();

async function createAdminUser() {
  console.log(`Checking for existing user: ${ADMIN_EMAIL}...`);

  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(ADMIN_EMAIL);
    console.log(`Found existing user with UID: ${userRecord.uid}. Deleting...`);
    await auth.deleteUser(userRecord.uid);
    console.log(`User ${userRecord.uid} deleted.`);
  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      console.log('No existing user found. Proceeding to create a new one.');
    } else {
      console.error('❌ Error fetching/deleting user:', error);
      process.exit(1);
    }
  }

  try {
    console.log(`Creating new admin user: ${ADMIN_EMAIL}...`);
    const newUserRecord = await auth.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      emailVerified: true,
      displayName: "iLearn Admin",
    });

    const uid = newUserRecord.uid;
    console.log(`✅ User created with UID: ${uid}`);

    const adminClaims = {
      role: 'admin',
      coachId: uid, // The admin is their own coach
    };

    console.log(`Setting custom claims: ${JSON.stringify(adminClaims)}...`);
    await auth.setCustomUserClaims(uid, adminClaims);
    console.log('✅ Custom claims set successfully.');

    // Firestore batch write
    const batch = firestore.batch();
    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    // Create coach document
    const coachRef = firestore.collection('coaches').doc(uid);
    batch.set(coachRef, {
      displayName: "iLearn Admin",
      email: ADMIN_EMAIL,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
     console.log(`Firestore: Queued write for /coaches/${uid}`);

    // Create user document
    const userRef = firestore.collection('users').doc(uid);
    batch.set(userRef, {
      coachId: uid,
      role: 'admin',
      profile: {
        name: "iLearn Admin",
        email: ADMIN_EMAIL,
        photoUrl: '',
      },
      status: 'active',
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    console.log(`Firestore: Queued write for /users/${uid}`);

    await batch.commit();
    console.log('✅ Firestore documents written successfully.');
    console.log('\n🎉 Admin user setup complete!');
    console.log(`You can now log in at /admin/login with:\nEmail: ${ADMIN_EMAIL}\nPassword: [the password you set]`);
    process.exit(0);

  } catch (error) {
    console.error('❌ An error occurred during the admin creation process:', error);
    process.exit(1);
  }
}

createAdminUser();
