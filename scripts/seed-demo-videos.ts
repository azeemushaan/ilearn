import { adminFirestore } from '../src/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

async function seedDemoVideos() {
  const db = adminFirestore();
  
  console.log('🎬 Seeding demo videos and content...\n');

  try {
    // Find a playlist to add videos to (or create one)
    const playlistsSnap = await db.collection('playlists').limit(1).get();
    
    let playlistId: string;
    let coachId: string;
    
    if (playlistsSnap.empty) {
      // Find a coach
      const coachesSnap = await db.collection('coaches').limit(1).get();
      if (coachesSnap.empty) {
        console.error('❌ No coaches found. Please create a coach first.');
        return;
      }
      coachId = coachesSnap.docs[0].id;
      
      // Create demo playlist
      const playlistRef = await db.collection('playlists').add({
        coachId,
        title: 'Introduction to Physics - Demo',
        description: 'Sample educational playlist',
        youtubePlaylistId: 'DEMO123',
        youtubePlaylistUrl: 'https://youtube.com/playlist?list=DEMO123',
        videoCount: 2,
        status: 'ready',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      playlistId = playlistRef.id;
      console.log(`✓ Created demo playlist: ${playlistId}`);
    } else {
      const playlist = playlistsSnap.docs[0];
      playlistId = playlist.id;
      coachId = playlist.data().coachId;
      console.log(`✓ Using existing playlist: ${playlistId}`);
    }

    // Demo videos (using real educational YouTube videos)
    const demoVideos = [
      {
        youtubeVideoId: 'dQw4w9WgXcQ', // Replace with real educational video
        title: 'Introduction to Motion',
        description: 'Learn about basic physics concepts of motion',
        duration: 212, // seconds
        thumbnailUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
      },
      {
        youtubeVideoId: 'jNQXAC9IVRw', // Replace with real educational video  
        title: 'Understanding Forces',
        description: 'Explore the fundamental forces in physics',
        duration: 180,
        thumbnailUrl: 'https://img.youtube.com/vi/jNQXAC9IVRw/mqdefault.jpg',
      },
    ];

    for (const videoData of demoVideos) {
      // Check if video already exists
      const existingVideo = await db.collection('videos')
        .where('youtubeVideoId', '==', videoData.youtubeVideoId)
        .where('playlistId', '==', playlistId)
        .limit(1)
        .get();

      if (!existingVideo.empty) {
        console.log(`  ⊘ Video already exists: ${videoData.title}`);
        continue;
      }

      // Create video document
      const videoRef = await db.collection('videos').add({
        playlistId,
        coachId,
        youtubeVideoId: videoData.youtubeVideoId,
        title: videoData.title,
        description: videoData.description,
        duration: videoData.duration,
        thumbnailUrl: videoData.thumbnailUrl,
        hasCaptions: true,
        chaptersOnly: false,
        status: 'ready',
        segmentCount: 3,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      console.log(`  ✓ Created video: ${videoData.title} (${videoRef.id})`);

      // Create segments for each video
      const segments = [
        {
          tStartSec: 0,
          tEndSec: 60,
          textChunk: 'Introduction to the topic and overview of key concepts.',
          summary: 'Introduction and overview',
          difficulty: 'easy' as const,
        },
        {
          tStartSec: 60,
          tEndSec: 120,
          textChunk: 'Detailed explanation of the main concepts with examples.',
          summary: 'Main concepts and examples',
          difficulty: 'medium' as const,
        },
        {
          tStartSec: 120,
          tEndSec: videoData.duration,
          textChunk: 'Advanced topics and practical applications.',
          summary: 'Advanced topics and applications',
          difficulty: 'hard' as const,
        },
      ];

      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const segmentRef = await db.collection(`videos/${videoRef.id}/segments`).add({
          coachId,
          ...segment,
          textChunkHash: `hash-${i}`,
          questionCount: 2,
          createdAt: Timestamp.now(),
        });

        console.log(`    ✓ Created segment ${i + 1}`);

        // Create sample questions for each segment
        const questions = [
          {
            stem: `What is the main concept covered in this section?`,
            options: [
              'Option A: Basic principles',
              'Option B: Advanced theories',
              'Option C: Practical applications',
              'Option D: Historical context',
            ],
            correctIndex: 0,
            rationale: 'The section focuses on basic principles as an introduction.',
            tags: ['concept', 'fundamentals'],
            difficulty: segment.difficulty,
          },
          {
            stem: `Which of the following best describes the key takeaway?`,
            options: [
              'Option A: Memorize formulas',
              'Option B: Understand underlying concepts',
              'Option C: Skip to next section',
              'Option D: Review later',
            ],
            correctIndex: 1,
            rationale: 'Understanding concepts is more important than memorization.',
            tags: ['comprehension', 'learning'],
            difficulty: segment.difficulty,
          },
        ];

        for (const question of questions) {
          await db.collection(`videos/${videoRef.id}/segments/${segmentRef.id}/questions`).add({
            coachId,
            segmentId: segmentRef.id,
            videoId: videoRef.id,
            ...question,
            createdAt: Timestamp.now(),
          });
        }

        console.log(`      ✓ Created 2 questions for segment ${i + 1}`);
      }
    }

    console.log('\n✅ Demo videos and content seeded successfully!');
    console.log(`\n📋 Next steps:`);
    console.log(`   1. Go to /dashboard/playlists`);
    console.log(`   2. Find the demo playlist`);
    console.log(`   3. Click "Assign to Students"`);
    console.log(`   4. Select students and create assignment`);
    console.log(`   5. Students can now watch and answer quizzes!\n`);

  } catch (error) {
    console.error('❌ Error seeding demo videos:', error);
    throw error;
  }
}

// Run the seeder
seedDemoVideos()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
