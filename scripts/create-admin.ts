
/**
 * create-admin.ts
 * ----------------
 * One-time script to create or update the super-admin user for iLearn (ER21).
 * This script uses the Firebase Admin SDK to ensure custom claims are set correctly.
 *
 * How to run:
 *   1. Make sure your service account key is at sa-key.json
 *   2. Set the environment variable:
 *      export GOOGLE_APPLICATION_CREDENTIALS="$PWD/sa-key.json"
 *   3. Run the script:
 *      npx tsx scripts/create-admin.ts
 */

import admin from "firebase-admin";

// Initialize Admin SDK with Application Default Credentials
// This automatically uses the GOOGLE_APPLICATION_CREDENTIALS environment variable
try {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
  console.log("Firebase Admin SDK initialized successfully.");
} catch (error: any) {
  console.error("Error initializing Firebase Admin SDK:", error.message);
  console.log("Please ensure you have set the GOOGLE_APPLICATION_CREDENTIALS environment variable correctly.");
  process.exit(1);
}


const EMAIL = "ilearn@er21.org";
// IMPORTANT: For security, use a strong, unique password.
// This password should be changed immediately by the admin after first login.
const PASSWORD = "ChangeMe!Azeem2025"; 

async function createAdmin() {
  try {
    console.log(`Attempting to create or update admin user: ${EMAIL}...`);
    let userRecord;

    try {
      // Check if the user already exists
      userRecord = await admin.auth().getUserByEmail(EMAIL);
      console.log(`✅ User found: ${userRecord.uid}. Updating claims and user document.`);
      // If user exists, we'll still update their claims and Firestore doc to ensure consistency.
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        // If user does not exist, create them
        userRecord = await admin.auth().createUser({
          email: EMAIL,
          password: PASSWORD,
          emailVerified: true,
          disabled: false,
          displayName: "iLearn Admin",
        });
        console.log("✅ New admin user created successfully:", userRecord.uid);
      } else {
        // For other errors (e.g., network issues), throw them
        throw error;
      }
    }

    const uid = userRecord.uid;

    // --- 1. Set Custom Claims ---
    // This is the most critical step for security rules.
    const customClaims = {
      role: "admin",
      coachId: uid, // The admin is their own coach
    };
    await admin.auth().setCustomUserClaims(uid, customClaims);
    console.log("🔑 Custom claims set successfully:", customClaims);

    // --- 2. Create/Update Firestore Coach Document ---
    const coachRef = admin.firestore().collection("coaches").doc(uid);
    await coachRef.set({
      displayName: "iLearn Admin",
      email: EMAIL,
      plan: { tier: 'enterprise', seats: 999 },
      settings: { locale: 'en', lowBandwidthDefault: false },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log(`Firestore document updated for coach: /coaches/${uid}`);

    // --- 3. Create/Update Firestore User Document ---
    const userRef = admin.firestore().collection("users").doc(uid);
    await userRef.set({
      coachId: uid, // User is linked to their own coach document
      role: 'admin',
      profile: {
        name: "iLearn Admin",
        email: EMAIL,
      },
      status: 'active',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log(`Firestore document updated for user: /users/${uid}`);


    // --- 4. Revoke Refresh Tokens ---
    // This forces the user to get a new ID token with the fresh claims on their next login.
    await admin.auth().revokeRefreshTokens(uid);
    console.log("🔁 User tokens revoked. Next login will load the new admin privileges.");

    console.log("\n✅ Admin setup complete!");
    console.log("---------------------------------");
    console.log(`Email:    ${EMAIL}`);
    console.log(`Password: ${PASSWORD}`);
    console.log("---------------------------------");
    console.log("You can now log in at /admin/login.");
    
  } catch (error) {
    console.error("❌ Error during admin setup:", error);
    process.exit(1);
  }
}

createAdmin();
