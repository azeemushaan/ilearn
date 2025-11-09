import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env.local') });

// Initialize Firebase Admin
const serviceAccount = JSON.parse(readFileSync(join(__dirname, '../sa-key.json'), 'utf8'));

// Set environment variable for Firebase Admin
process.env.GOOGLE_APPLICATION_CREDENTIALS = join(__dirname, '../sa-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  storageBucket: 'studio-1899970548-e54c4.appspot.com',
});

const firestore = admin.firestore();
const auth = admin.auth();

async function seedDatabase() {
  console.log('🌱 Seeding database...\n');

  // 1. Create default plans
  console.log('📋 Creating plans...');
  const plans = [
    {
      name: 'free',
      title: 'Free',
      description: 'Perfect for getting started',
      priceUSD: 0,
      maxStudents: 5,
      maxPlaylists: 1,
      enableQuizGeneration: false,
      enableProgressTracking: false,
      enableAntiSkip: false,
      enableCustomBranding: false,
      enableAPIAccess: false,
      enablePrioritySupport: false,
      isActive: true,
      sort: 0,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    },
    {
      name: 'professional',
      title: 'Professional',
      description: 'For growing academies',
      priceUSD: 20,
      maxStudents: 25,
      maxPlaylists: 10,
      enableQuizGeneration: true,
      enableProgressTracking: true,
      enableAntiSkip: true,
      enableCustomBranding: true,
      enableAPIAccess: false,
      enablePrioritySupport: true,
      isActive: true,
      sort: 1,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    },
    {
      name: 'enterprise',
      title: 'Enterprise',
      description: 'For large organizations',
      priceUSD: 50,
      maxStudents: 100,
      maxPlaylists: 50,
      enableQuizGeneration: true,
      enableProgressTracking: true,
      enableAntiSkip: true,
      enableCustomBranding: true,
      enableAPIAccess: true,
      enablePrioritySupport: true,
      isActive: true,
      sort: 2,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    },
  ];

  for (const plan of plans) {
    const ref = await firestore.collection('plans').add(plan);
    console.log(`  ✓ Created ${plan.title} plan (${ref.id})`);
  }

  // 2. Create admin user
  console.log('\n👤 Creating admin user...');
  const adminEmail = 'admin@ilearn.com';
  const adminPassword = 'admin123456';
  
  let adminUser;
  try {
    adminUser = await auth.getUserByEmail(adminEmail);
    console.log(`  ℹ Admin user already exists (${adminUser.uid})`);
  } catch (error) {
    adminUser = await auth.createUser({
      email: adminEmail,
      password: adminPassword,
      displayName: 'Admin User',
      emailVerified: true,
    });
    console.log(`  ✓ Created admin user (${adminUser.uid})`);
  }

  // Set admin custom claims
  await auth.setCustomUserClaims(adminUser.uid, { role: 'admin', coachId: null });
  console.log('  ✓ Set admin custom claims');

  // Create admin user document
  await firestore.collection('users').doc(adminUser.uid).set({
    coachId: 'admin',
    role: 'admin',
    profile: {
      name: 'Admin User',
      email: adminEmail,
      photoUrl: null,
    },
    status: 'active',
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
  });
  console.log('  ✓ Created admin user document');

  // 3. Create sample coach
  console.log('\n🏫 Creating sample coach...');
  const coachRef = await firestore.collection('coaches').add({
    displayName: 'Demo Coach',
    email: 'coach@demo.com',
    phone: '+92-300-1234567',
    brand: {
      name: 'Demo Academy',
      logoUrl: null,
      color: '#3b82f6',
    },
    plan: {
      tier: 'free',
      seats: 5,
      expiresAt: null,
    },
    settings: {
      locale: 'en',
      lowBandwidthDefault: false,
    },
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
  });
  console.log(`  ✓ Created demo coach (${coachRef.id})`);

  // Create coach user
  let coachUser;
  try {
    coachUser = await auth.getUserByEmail('coach@demo.com');
    console.log(`  ℹ Coach user already exists (${coachUser.uid})`);
  } catch (error) {
    coachUser = await auth.createUser({
      email: 'coach@demo.com',
      password: 'coach123456',
      displayName: 'Demo Coach',
      emailVerified: true,
    });
    console.log(`  ✓ Created coach user (${coachUser.uid})`);
  }

  await auth.setCustomUserClaims(coachUser.uid, { role: 'coach', coachId: coachRef.id });
  console.log('  ✓ Set coach custom claims');

  await firestore.collection('users').doc(coachUser.uid).set({
    coachId: coachRef.id,
    role: 'coach',
    profile: {
      name: 'Demo Coach',
      email: 'coach@demo.com',
      photoUrl: null,
    },
    status: 'active',
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
  });
  console.log('  ✓ Created coach user document');

  // 4. Create subscription for coach
  console.log('\n📅 Creating subscription...');
  const freePlanRef = await firestore.collection('plans').where('name', '==', 'free').limit(1).get();
  const freePlanDoc = freePlanRef.docs[0];
  
  const subscriptionRef = await firestore.collection('subscriptions').add({
    coachId: coachRef.id,
    planId: freePlanDoc.id,
    maxStudents: 5,
    status: 'active',
    currentPeriodEnd: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)),
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
  });
  console.log(`  ✓ Created subscription (${subscriptionRef.id})`);

  // Create payment record for free plan
  const paymentRef = await firestore.collection('payments').add({
    coachId: coachRef.id,
    amount: 0,
    currency: 'USD',
    method: 'waiver',
    status: 'approved',
    reference: null,
    bankSlipUrl: null,
    notes: 'Free plan - no payment required',
    reviewedBy: adminUser.uid,
    reviewedAt: admin.firestore.Timestamp.now(),
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
  });
  console.log(`  ✓ Created payment record (${paymentRef.id})`);

  await subscriptionRef.update({ paymentId: paymentRef.id });

  // 5. Create system settings
  console.log('\n⚙️  Creating system settings...');
  await firestore.collection('settings').doc('system').set({
    manualPaymentsEnabled: true,
    supportEmail: 'support@ilearn.com',
    branding: {
      logoUrl: null,
    },
    updatedAt: admin.firestore.Timestamp.now(),
  });
  console.log('  ✓ Created system settings');

  console.log('\n✅ Database seeding complete!\n');
  console.log('📧 Admin login: admin@ilearn.com / admin123456');
  console.log('📧 Coach login: coach@demo.com / coach123456\n');
}

seedDatabase()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error seeding database:', error);
    process.exit(1);
  });
