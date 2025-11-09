'use server';

/**
 * @fileOverview Flow to preprocess video content by fetching captions and generating question prompts using AI.
 *
 * - prepareVideoContent - A function that handles the video content preparation process.
 * - PrepareVideoContentInput - The input type for the prepareVideoContent function.
 * - PrepareVideoContentOutput - The return type for the prepareVideoContent function.
 */

import {ai, aiModelName, aiRuntimeConfig} from '@/ai/genkit';
import {z} from 'genkit';

const PrepareVideoContentInputSchema = z.object({
  videoId: z.string().describe('The ID of the video to prepare.'),
  orgId: z.string().describe('The ID of the organization.'),
  youtubeVideoId: z.string().describe('The YouTube video ID.'),
  title: z.string().describe('The title of the video.'),
  hasCaptions: z.boolean().describe('Whether the video has captions.'),
  chaptersOnly: z.boolean().describe('Whether to use chapters only for segmentation.'),
  transcriptChunk: z.string().describe('The transcript chunk to process.'),
  gradeBand: z.string().describe('The grade band of the video.'),
  locale: z.string().describe('The locale of the video (e.g., Urdu/English).'),
});
export type PrepareVideoContentInput = z.infer<typeof PrepareVideoContentInputSchema>;

const PrepareVideoContentOutputSchema = z.object({
  stem: z.string().describe('The stem of the question.'),
  options: z.string().array().length(4).describe('The four options for the question.'),
  correctIndex: z.number().min(0).max(3).describe('The index of the correct option.'),
  rationale: z.string().describe('The rationale for the correct answer.'),
  tags: z.string().array().describe('The tags for the question.'),
  difficulty: z.string().describe('The difficulty of the question.'),
  progress: z.string().describe('Status of video content preparation.')
});
export type PrepareVideoContentOutput = z.infer<typeof PrepareVideoContentOutputSchema>;

export async function prepareVideoContent(input: PrepareVideoContentInput): Promise<PrepareVideoContentOutput> {
  return prepareVideoContentFlow(input);
}

const generateMcqsPromptConfig: Record<string, unknown> = {
  ...aiRuntimeConfig,
  safetySettings: [
    {category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH'},
    {category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_LOW_AND_ABOVE'},
    {category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE'},
    {category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH'},
  ],
};

if (!aiModelName.startsWith('googleai/')) {
  generateMcqsPromptConfig.model = aiModelName;
}

const generateMcqsPrompt = ai.definePrompt({
  name: 'generateMcqsPrompt',
  input: {schema: PrepareVideoContentInputSchema},
  output: {schema: PrepareVideoContentOutputSchema},
  prompt: `You are an AI assistant that generates multiple-choice questions (MCQs) based on video transcripts.

  Given a transcript chunk, video title, chapter name, grade band, and locale, generate 1-3 MCQs in JSON format.

  Output JSON schema: { stem, options[4], correctIndex, rationale, tags[], difficulty }

  - Ground the correct answer by quoting the sentence/lines from the transcript chunk that justify it.
  - Disallow personal data.
  - Maintain a neutral tone.
  - Ensure the content is child-safe.
  - Avoid controversial topics unless educationally relevant and coach-approved.

  Here's the transcript chunk:
  {{transcriptChunk}}

  Video Title: {{title}}
  Grade Band: {{gradeBand}}
  Locale: {{locale}}

  Generate one MCQ based on the above information.
  `,
  config: generateMcqsPromptConfig,
});

const prepareVideoContentFlow = ai.defineFlow(
  {
    name: 'prepareVideoContentFlow',
    inputSchema: PrepareVideoContentInputSchema,
    outputSchema: PrepareVideoContentOutputSchema,
  },
  async input => {
    const {output} = await generateMcqsPrompt(input);
    // Add one short, one-sentence summary of what you have generated to the 'progress' field in the output.
    output!.progress = 'Generated MCQ from transcript chunk.';

    return output!;
  }
);
