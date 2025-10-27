# **App Name**: iLearn

## Core Features:

- YouTube Playlist Assignment: Teachers can assign YouTube playlists to students, making educational content readily accessible. Functionality for the teacher to paste a playlist URL and for the backend to fetch video IDs + metadata using the YouTube Data API.
- Intelligent Video Pauses: The player automatically pauses at concept boundaries, as determined by YouTube chapters or semantic segmentation. Segments transcript (or chapters) into ~60–120s chunks.
- AI-Generated Quizzes: Leverage Gemini to automatically generate multiple-choice questions (MCQs) based on video transcripts and video metadata, complete with distractors and rationales. Generate MCQs in JSON with deterministic temperature:
- Progress Tracking: Monitor student progress through assigned videos, tracking watch percentage, quiz scores, and completion status.
- Teacher Dashboard: A dashboard for teachers to manage classes, playlists, assignments, and student progress.
- Anti-Skip Controls: Implement measures to prevent students from skipping content, ensuring they engage with the material. Enforce watch-time thresholds and optional device binding for enhanced integrity. tool
- Content Preparation Pipeline: The AI tool will be used to preprocess video content, fetching captions and trigger Gemini to store questions.

## Style Guidelines:

- Primary color: Dark blue (#24305E), lending a professional and trustworthy feel, aligning with educational platforms.
- Background color: Light blue (#F0F4FF), a desaturated version of the primary, providing a clean and modern backdrop.
- Accent color: A vibrant shade of purple (#9370DB), to add emphasis to CTAs and highlight key information.
- Body and headline font: 'Inter', a grotesque-style sans-serif, to create a modern, machined, objective, neutral look.
- Use clear and concise icons to represent different features and actions.
- Modern UI/UX design similar to platforms like Loom, Notion, or Linear with soft shadows, rounded corners, and a focus on whitespace.
- Subtle animations on scroll, and transitions on key interactions