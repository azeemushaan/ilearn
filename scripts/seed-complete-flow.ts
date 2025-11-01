import { adminFirestore, adminAuth } from '../src/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import { join } from 'path';

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env.local') });

/**
 * Complete seed script for testing the full student assignment flow
 * Creates: Coach, Students, Playlist, Videos (with segments & questions), Assignment
 */

async function seedCompleteFlow() {
  const db = adminFirestore();
  const auth = adminAuth();
  
  console.log('🌱 Seeding complete assignment flow...\n');

  try {
    // 1. Find or create coach
    console.log('👨‍🏫 Setting up coach...');
    let coachDoc;
    const existingCoaches = await db.collection('coaches').limit(1).get();
    
    if (existingCoaches.empty) {
      const coachRef = await db.collection('coaches').add({
        displayName: 'Demo Coach',
        email: 'coach@demo.com',
        phone: '+92-300-1234567',
        brand: {
          name: 'Demo Academy',
          logoUrl: null,
          color: '#3b82f6',
        },
        plan: {
          tier: 'professional',
          seats: 25,
          expiresAt: null,
        },
        settings: {
          locale: 'en',
          lowBandwidthDefault: false,
        },
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      coachDoc = await coachRef.get();
      console.log(`  ✓ Created coach: ${coachRef.id}`);
    } else {
      coachDoc = existingCoaches.docs[0];
      console.log(`  ✓ Using existing coach: ${coachDoc.id}`);
    }

    const coachId = coachDoc.id;

    // 2. Create sample students
    console.log('\n👨‍🎓 Creating students...');
    const studentData = [
      { name: 'Alice Johnson', email: 'alice@student.com', password: 'student123' },
      { name: 'Bob Smith', email: 'bob@student.com', password: 'student123' },
      { name: 'Carol Martinez', email: 'carol@student.com', password: 'student123' },
    ];

    const studentIds: string[] = [];

    for (const student of studentData) {
      let authUser;
      try {
        authUser = await auth.getUserByEmail(student.email);
        console.log(`  ℹ Student ${student.name} already exists`);
      } catch {
        authUser = await auth.createUser({
          email: student.email,
          password: student.password,
          displayName: student.name,
          emailVerified: true,
        });
        console.log(`  ✓ Created auth user: ${student.name}`);
      }

      await auth.setCustomUserClaims(authUser.uid, { role: 'student', coachId });

      await db.collection('users').doc(authUser.uid).set({
        coachId,
        role: 'student',
        profile: {
          name: student.name,
          email: student.email,
          photoUrl: null,
        },
        status: 'active',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      studentIds.push(authUser.uid);
    }

    console.log(`  ✓ Created/updated ${studentIds.length} students`);

    // 3. Create playlist
    console.log('\n📋 Creating playlist...');
    const playlistRef = await db.collection('playlists').add({
      coachId,
      title: 'Introduction to Science - Demo Playlist',
      description: 'A sample educational playlist with quiz-ready videos',
      youtubePlaylistId: 'DEMO_SCIENCE_101',
      youtubePlaylistUrl: 'https://youtube.com/playlist?list=DEMO_SCIENCE_101',
      videoCount: 3,
      status: 'ready',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    console.log(`  ✓ Created playlist: ${playlistRef.id}`);

    // 4. Create videos with segments and questions
    console.log('\n🎬 Creating videos with quiz content...');
    
    const demoVideos = [
      {
        youtubeVideoId: 'C0DPdy98e4c', // Real educational video about water cycle
        title: 'The Water Cycle',
        description: 'Learn about evaporation, condensation, and precipitation',
        duration: 180, // 3 minutes
        segments: [
          {
            tStart: 0,
            tEnd: 60,
            text: 'Introduction to the water cycle and its importance in nature',
            questions: [
              {
                stem: 'What is the water cycle?',
                options: [
                  'The process of water moving through different states',
                  'A bicycle made of water',
                  'The amount of water in oceans',
                  'Water flowing in circles'
                ],
                correct: 0,
                rationale: 'The water cycle describes how water moves between liquid, gas, and solid states in the environment.'
              }
            ]
          },
          {
            tStart: 60,
            tEnd: 120,
            text: 'Evaporation and condensation processes explained',
            questions: [
              {
                stem: 'What happens during evaporation?',
                options: [
                  'Water freezes into ice',
                  'Water turns into vapor',
                  'Water falls as rain',
                  'Water stays the same'
                ],
                correct: 1,
                rationale: 'Evaporation is the process where liquid water turns into water vapor due to heat energy.'
              }
            ]
          },
          {
            tStart: 120,
            tEnd: 180,
            text: 'Precipitation and its role in the cycle',
            questions: [
              {
                stem: 'What is precipitation?',
                options: [
                  'Water stored in clouds',
                  'Water evaporating from lakes',
                  'Water falling from clouds as rain or snow',
                  'Water in the ocean'
                ],
                correct: 2,
                rationale: 'Precipitation occurs when water droplets in clouds become heavy enough to fall to Earth as rain, snow, sleet, or hail.'
              }
            ]
          }
        ]
      },
      {
        youtubeVideoId: 'VwVmNPvYFz0', // Real educational video about photosynthesis
        title: 'Photosynthesis Explained',
        description: 'Understanding how plants make their own food',
        duration: 150,
        segments: [
          {
            tStart: 0,
            tEnd: 50,
            text: 'Introduction to photosynthesis and plant cells',
            questions: [
              {
                stem: 'Where does photosynthesis take place?',
                options: [
                  'In the roots',
                  'In the chloroplasts',
                  'In the stem',
                  'In the flowers'
                ],
                correct: 1,
                rationale: 'Photosynthesis occurs in chloroplasts, which contain the green pigment chlorophyll.'
              }
            ]
          },
          {
            tStart: 50,
            tEnd: 100,
            text: 'The role of sunlight, water, and carbon dioxide',
            questions: [
              {
                stem: 'What do plants need for photosynthesis?',
                options: [
                  'Only water',
                  'Sunlight, water, and carbon dioxide',
                  'Soil and air',
                  'Darkness and heat'
                ],
                correct: 1,
                rationale: 'Plants use sunlight, water, and carbon dioxide to produce glucose and oxygen through photosynthesis.'
              }
            ]
          },
          {
            tStart: 100,
            tEnd: 150,
            text: 'Products of photosynthesis: glucose and oxygen',
            questions: [
              {
                stem: 'What does photosynthesis produce?',
                options: [
                  'Carbon dioxide and water',
                  'Glucose and oxygen',
                  'Nitrogen and hydrogen',
                  'Salt and minerals'
                ],
                correct: 1,
                rationale: 'Photosynthesis produces glucose (sugar) for plant energy and releases oxygen as a byproduct.'
              }
            ]
          }
        ]
      }
    ];

    const videoIds: string[] = [];

    for (const videoData of demoVideos) {
      // Create video document
      const videoRef = await db.collection('videos').add({
        playlistId: playlistRef.id,
        coachId,
        youtubeVideoId: videoData.youtubeVideoId,
        title: videoData.title,
        description: videoData.description,
        duration: videoData.duration,
        thumbnailUrl: `https://img.youtube.com/vi/${videoData.youtubeVideoId}/mqdefault.jpg`,
        hasCaptions: true,
        chaptersOnly: false,
        status: 'ready',
        segmentCount: videoData.segments.length,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      console.log(`  ✓ Created video: ${videoData.title}`);
      videoIds.push(videoRef.id);

      // Create segments and questions
      for (let i = 0; i < videoData.segments.length; i++) {
        const segment = videoData.segments[i];
        
        const segmentRef = await db.collection(`videos/${videoRef.id}/segments`).add({
          videoId: videoRef.id,
          tStartSec: segment.tStart,
          tEndSec: segment.tEnd,
          textChunk: segment.text,
          textChunkHash: `hash-${i}-${videoRef.id}`,
          summary: segment.text.substring(0, 100),
          difficulty: i === 0 ? 'easy' : i === 1 ? 'medium' : 'hard',
          questionCount: segment.questions.length,
          createdAt: Timestamp.now(),
        });

        console.log(`    ✓ Created segment ${i + 1}`);

        // Create questions
        for (const q of segment.questions) {
          await db.collection(`videos/${videoRef.id}/segments/${segmentRef.id}/questions`).add({
            segmentId: segmentRef.id,
            videoId: videoRef.id,
            stem: q.stem,
            options: q.options,
            correctIndex: q.correct,
            rationale: q.rationale,
            tags: ['comprehension', 'science'],
            difficulty: i === 0 ? 'easy' : i === 1 ? 'medium' : 'hard',
            createdAt: Timestamp.now(),
          });
        }

        console.log(`      ✓ Created ${segment.questions.length} questions`);
      }
    }

    // 5. Create assignment
    console.log('\n📝 Creating assignment...');
    const now = new Date();
    const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

    const assignmentRef = await db.collection('assignments').add({
      coachId,
      playlistId: playlistRef.id,
      studentIds,
      title: 'Science Basics - Week 1',
      startAt: Timestamp.fromDate(now),
      endAt: Timestamp.fromDate(endDate),
      rules: {
        watchPct: 80,
        minScore: 70,
        antiSkip: true,
        attemptLimit: 3,
      },
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    console.log(`  ✓ Created assignment: ${assignmentRef.id}`);
    console.log(`  ✓ Assigned to ${studentIds.length} students`);

    console.log('\n✅ Complete flow seeded successfully!\n');
    console.log('📧 Student logins:');
    studentData.forEach(s => console.log(`   ${s.email} / ${s.password}`));
    console.log('\n📋 Next steps:');
    console.log('   1. Login as a student');
    console.log('   2. Go to /dashboard');
    console.log('   3. Click on the assignment');
    console.log('   4. Start watching and answering quizzes!');
    console.log('   5. Progress will be tracked automatically\n');

  } catch (error) {
    console.error('❌ Error seeding complete flow:', error);
    throw error;
  }
}

// Run the seeder
seedCompleteFlow()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
