'use server';

/**
 * @fileOverview A flow for generating multiple-choice questions (MCQs) from video transcripts and metadata.
 *
 * - generateMcq - A function that generates MCQs from video transcripts and metadata.
 * - GenerateMcqInput - The input type for the generateMcq function.
 * - GenerateMcqOutput - The return type for the generateMcq function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateMcqInputSchema = z.object({
  transcriptChunk: z
    .string()
    .describe('A chunk of transcript text from a video.'),
  videoTitle: z.string().describe('The title of the video.'),
  chapterName: z.string().describe('The name of the chapter in the video.'),
  gradeBand: z.string().describe('The grade band for the video content.'),
  locale: z.string().describe('The locale for the video content (e.g., Urdu/English).'),
  difficultyTarget: z.string().describe('The target difficulty for the MCQs (e.g., easy, medium, hard).'),
});
export type GenerateMcqInput = z.infer<typeof GenerateMcqInputSchema>;

const GenerateMcqOutputSchema = z.object({
  questions: z.array(
    z.object({
      stem: z.string().describe('The question stem.'),
      options: z.array(z.string()).length(4).describe('Four options for the question.'),
      correctIndex: z.number().int().min(0).max(3).describe('The index of the correct option (0-3).'),
      rationale: z.string().describe('The rationale for why the correct option is correct.'),
      tags: z.array(z.string()).describe('Tags associated with the question (topic, difficulty).'),
      difficulty: z.string().describe('The difficulty level of the question.'),
    })
  ).describe('An array of multiple-choice questions.'),
  progress: z.string().describe('A short, one-sentence summary of the question generation process.'),
});
export type GenerateMcqOutput = z.infer<typeof GenerateMcqOutputSchema>;

export async function generateMcq(input: GenerateMcqInput): Promise<GenerateMcqOutput> {
  return generateMcqFlow(input);
}

const generateMcqPrompt = ai.definePrompt({
  name: 'generateMcqPrompt',
  input: {schema: GenerateMcqInputSchema},
  output: {schema: GenerateMcqOutputSchema},
  prompt: `You are an AI assistant helping teachers generate multiple-choice questions (MCQs) from video transcripts and metadata.

  Given a transcript chunk, video title, chapter name, grade band, locale, and target difficulty, your task is to generate 1-3 MCQs.
  Each MCQ should have a stem, four options, a correct index (0-3), a rationale, tags, and a difficulty level.

  Here are the details:
  - Video Title: {{{videoTitle}}}
  - Chapter Name: {{{chapterName}}}
  - Grade Band: {{{gradeBand}}}
  - Locale: {{{locale}}}
  - Difficulty Target: {{{difficultyTarget}}}
  - Transcript Chunk: {{{transcriptChunk}}}

  Please generate the MCQs in the following JSON format:
  {
    "questions": [
      {
        "stem": "...",
        "options": ["...", "...", "...", "..."],
        "correctIndex": 0,
        "rationale": "...",
        "tags": ["...", "..."],
        "difficulty": "..."
      }
    ],
    "progress": "Generated MCQs from the provided video transcript chunk."
  }

  Make sure the correct answer is grounded in the transcript chunk.
  Disallow personal data; maintain a neutral tone; ensure child-safety; ban controversial topics unless educational & teacher-approved.
`,
  config: {
    safetySettings: [
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_ONLY_HIGH',
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_LOW_AND_ABOVE',
      },
      {
        category: 'HARM_CATEGORY_CIVIC_INTEGRITY',
        threshold: 'BLOCK_ONLY_HIGH',
      },
    ],
  },
});

const generateMcqFlow = ai.defineFlow(
  {
    name: 'generateMcqFlow',
    inputSchema: GenerateMcqInputSchema,
    outputSchema: GenerateMcqOutputSchema,
  },
  async input => {
    const {output} = await generateMcqPrompt(input);
    return output!;
  }
);
