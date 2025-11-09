/**
 * Migration Script: Phase 3 - Manual Processing System
 * 
 * Adds new fields to existing data with safe defaults
 * - Videos: captionSource, captionLanguage, mcqLanguage, creditsConsumed, flags
 * - Playlists: ownershipPreflightStatus, ownershipResults
 * - Coaches: credits (balance, allotment, rollover)
 * - Initializes coach_billing documents
 */

import { adminFirestore } from '../src/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

async function migrateVideos() {
  console.log('\n📹 Migrating videos...');
  
  const db = adminFirestore();
  const videosSnapshot = await db.collection('videos').get();
  
  let migrated = 0;
  let skipped = 0;

  for (const videoDoc of videosSnapshot.docs) {
    const data = videoDoc.data();
    
    // Check if already migrated
    if (data.captionSource !== undefined) {
      skipped++;
      continue;
    }

    const updates: any = {
      captionSource: 'unknown',
      captionLanguage: null,
      mcqLanguage: null,
      creditsConsumed: 0,
      updatedAt: Timestamp.now(),
    };

    // Set lockedReady flag for videos that are already ready
    if (data.status === 'ready') {
      updates.flags = {
        lockedReady: true,
      };
    }

    await videoDoc.ref.update(updates);
    migrated++;
  }

  console.log(`✓ Videos migrated: ${migrated}, skipped: ${skipped}`);
}

async function migratePlaylists() {
  console.log('\n📋 Migrating playlists...');
  
  const db = adminFirestore();
  const playlistsSnapshot = await db.collection('playlists').get();
  
  let migrated = 0;
  let skipped = 0;

  for (const playlistDoc of playlistsSnapshot.docs) {
    const data = playlistDoc.data();
    
    // Check if already migrated
    if (data.ownershipPreflightStatus !== undefined) {
      skipped++;
      continue;
    }

    await playlistDoc.ref.update({
      ownershipPreflightStatus: 'pending',
      ownershipResults: {
        owned: [],
        notOwned: [],
        unknown: [],
        checkedAt: null,
      },
      updatedAt: Timestamp.now(),
    });

    migrated++;
  }

  console.log(`✓ Playlists migrated: ${migrated}, skipped: ${skipped}`);
}

async function migrateCoaches() {
  console.log('\n👥 Migrating coaches...');
  
  const db = adminFirestore();
  const coachesSnapshot = await db.collection('coaches').get();
  
  let migrated = 0;
  let skipped = 0;

  for (const coachDoc of coachesSnapshot.docs) {
    const data = coachDoc.data();
    
    // Check if already migrated
    if (data.credits !== undefined) {
      skipped++;
      continue;
    }

    await coachDoc.ref.update({
      credits: {
        balance: 0,
        monthlyAllotment: 0,
        rolloverEnabled: false,
      },
      updatedAt: Timestamp.now(),
    });

    migrated++;
  }

  console.log(`✓ Coaches migrated: ${migrated}, skipped: ${skipped}`);
}

async function initializeCoachBilling() {
  console.log('\n💳 Initializing coach billing documents...');
  
  const db = adminFirestore();
  const coachesSnapshot = await db.collection('coaches').get();
  
  let created = 0;
  let skipped = 0;

  for (const coachDoc of coachesSnapshot.docs) {
    const coachId = coachDoc.id;
    
    // Check if billing document already exists
    const billingDoc = await db.collection('coach_billing').doc(coachId).get();
    
    if (billingDoc.exists) {
      skipped++;
      continue;
    }

    await db.collection('coach_billing').doc(coachId).set({
      coachId,
      balance: 0,
      reservedCredits: 0,
      monthlyAllotment: 0,
      rolloverEnabled: false,
      lastAllotmentDate: null,
      updatedAt: Timestamp.now(),
    });

    created++;
  }

  console.log(`✓ Billing documents created: ${created}, skipped: ${skipped}`);
}

async function cleanupOldData() {
  console.log('\n🧹 Cleaning up old data...');
  
  const db = adminFirestore();
  
  try {
    // Check for placeholder data by examining videos directly
    // (collectionGroup query requires index, so we'll check videos instead)
    const videosSnapshot = await db.collection('videos').get();
    const videoIdsToCheck: string[] = [];

    for (const videoDoc of videosSnapshot.docs) {
      const data = videoDoc.data();
      // Check if video has segments
      if (data.segmentCount > 0) {
        videoIdsToCheck.push(videoDoc.id);
      }
    }

    console.log(`  Checking ${videoIdsToCheck.length} videos for placeholder data...`);

    const affectedVideoIds = new Set<string>();
    let checkedCount = 0;

    // Check each video's segments for placeholder text
    for (const videoId of videoIdsToCheck) {
      const segmentsSnapshot = await db.collection(`videos/${videoId}/segments`)
        .limit(1)
        .get();

      if (!segmentsSnapshot.empty) {
        const firstSegment = segmentsSnapshot.docs[0].data();
        const textChunk = firstSegment.textChunk || '';
        
        // Check if it's placeholder text
        if (textChunk.match(/^Segment at \d+:\d+ - \d+:\d+$/)) {
          affectedVideoIds.add(videoId);
        }
      }

      checkedCount++;
      if (checkedCount % 10 === 0) {
        console.log(`  Checked ${checkedCount}/${videoIdsToCheck.length} videos...`);
      }
    }

    if (affectedVideoIds.size === 0) {
      console.log('✓ No placeholder segments found');
      return;
    }

    console.log(`⚠ Found ${affectedVideoIds.size} videos with placeholder text`);
    console.log(`  Video IDs: ${Array.from(affectedVideoIds).slice(0, 5).join(', ')}${affectedVideoIds.size > 5 ? '...' : ''}`);
    
    // Mark these videos as not_ready so they can be reprocessed
    const batch = db.batch();
    let marked = 0;

    for (const videoId of affectedVideoIds) {
      const videoRef = db.collection('videos').doc(videoId);
      batch.update(videoRef, {
        status: 'not_ready',
        errorMessage: 'Video has placeholder data and needs reprocessing with real captions',
        updatedAt: Timestamp.now(),
      });
      marked++;
    }

    await batch.commit();
    console.log(`✓ Marked ${marked} videos as not_ready for reprocessing`);
  } catch (error) {
    console.log('⚠ Could not check for placeholder data (non-fatal)');
    console.log('  You can manually identify affected videos later');
    console.log('  Error:', error instanceof Error ? error.message : String(error));
  }
}

async function runMigration() {
  console.log('🚀 Starting Phase 3 migration...\n');
  console.log('This will add new fields to existing data with safe defaults\n');

  try {
    await migrateVideos();
    await migratePlaylists();
    await migrateCoaches();
    await initializeCoachBilling();
    await cleanupOldData();

    console.log('\n✅ Migration complete!');
    console.log('\nNext steps:');
    console.log('1. Set up YouTube OAuth credentials in Google Cloud Console');
    console.log('2. Add YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET to .env.local');
    console.log('3. Teachers can now connect YouTube and process videos manually');
    console.log('4. Videos marked as not_ready should be reprocessed with real captions\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
runMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

