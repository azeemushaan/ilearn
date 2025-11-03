'use server';

/**
 * @fileOverview This file implements measures to discourage students from skipping video content.
 *
 * - generateAttentionCheck - A function that generates a short attention check prompt.
 * - GenerateAttentionCheckInput - The input type for the generateAttentionCheck function.
 * - GenerateAttentionCheckOutput - The return type for the generateAttentionCheck function.
 */

import {ai, aiModelName, aiRuntimeConfig} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateAttentionCheckInputSchema = z.object({
  videoTitle: z.string().describe('The title of the video.'),
  segmentSummary: z.string().describe('A short summary of the current video segment.'),
});
export type GenerateAttentionCheckInput = z.infer<typeof GenerateAttentionCheckInputSchema>;

const GenerateAttentionCheckOutputSchema = z.object({
  attentionCheckPrompt: z.string().describe('A short, one-tap attention check prompt.'),
});
export type GenerateAttentionCheckOutput = z.infer<typeof GenerateAttentionCheckOutputSchema>;

export async function generateAttentionCheck(input: GenerateAttentionCheckInput): Promise<GenerateAttentionCheckOutput> {
  return generateAttentionCheckFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateAttentionCheckPrompt',
  input: {schema: GenerateAttentionCheckInputSchema},
  output: {schema: GenerateAttentionCheckOutputSchema},
  prompt: `You are an AI assistant helping teachers to create engaging educational content.

  Given the video title and a summary of the current segment, generate a short, one-tap attention check prompt to ensure the student is paying attention.
  The prompt should be easy to answer and require minimal effort from the student.
  The prompt should be related to the content of the video or segment.

  Video Title: {{{videoTitle}}}
  Segment Summary: {{{segmentSummary}}}

  Attention Check Prompt:`,
  config: {
    model: aiModelName,
    ...aiRuntimeConfig,
  },
});

const generateAttentionCheckFlow = ai.defineFlow(
  {
    name: 'generateAttentionCheckFlow',
    inputSchema: GenerateAttentionCheckInputSchema,
    outputSchema: GenerateAttentionCheckOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return {
      attentionCheckPrompt: output?.attentionCheckPrompt || 'Are you still watching?',
    };
  }
);
