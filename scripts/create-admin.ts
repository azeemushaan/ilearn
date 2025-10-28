/**
 * create-admin.ts
 * ----------------
 * One-time script to create or update the super-admin user for iLearn (ER21).
 * Uses Firebase Admin SDK with service account credentials.
 *
 * How to run:
 *   1. export GOOGLE_APPLICATION_CREDENTIALS="$PWD/sa-key.json"
 *   2. npx tsx scripts/create-admin.ts
 */

import admin from "firebase-admin";

// Initialize Admin SDK with Application Default Credentials
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

const EMAIL = "ilearn@er21.org";
const PASSWORD = "ChangeMe!Azeem2025"; // You can change this later from the console

async function createAdmin() {
  try {
    console.log(`Checking for existing user: ${EMAIL}...`);
    let user;

    try {
      user = await admin.auth().getUserByEmail(EMAIL);
      console.log("✅ Existing user found:", user.uid);
    } catch {
      user = await admin.auth().createUser({
        email: EMAIL,
        password: PASSWORD,
        emailVerified: true,
        disabled: false,
      });
      console.log("✅ New admin user created:", user.uid);
    }

    // Assign superuser custom claims
    await admin.auth().setCustomUserClaims(user.uid, {
      role: "admin",
      coachId: user.uid,
    });
    console.log("🔑 Custom claims set: { role: 'admin', coachId: uid }");

    // Revoke tokens so next login refreshes claims
    await admin.auth().revokeRefreshTokens(user.uid);
    console.log("🔁 Tokens revoked — next login will load admin privileges.");

    console.log("\n✅ Admin setup complete!");
    console.log("Sign out and log back in as:", EMAIL);
    console.log("Then run:");
    console.log(`await auth.currentUser.getIdTokenResult(true).then(r => console.log(r.claims));`);
  } catch (error) {
    console.error("❌ Error creating admin:", error);
    process.exit(1);
  }
}

createAdmin();
