import * as admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join } from 'path';

const serviceAccount = JSON.parse(readFileSync(join(__dirname, '../sa-key.json'), 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});

const auth = admin.auth();

async function setAdminClaims() {
  const email = 'ilearn@er21.org';
  
  try {
    const user = await auth.getUserByEmail(email);
    await auth.setCustomUserClaims(user.uid, { role: 'admin', coachId: null });
    console.log(`✓ Set admin claims for ${email} (${user.uid})`);
    
    const userRecord = await auth.getUser(user.uid);
    console.log('Claims:', userRecord.customClaims);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

setAdminClaims();
