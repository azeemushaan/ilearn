'use server';

/**
 * @fileOverview This file implements measures to discourage students from skipping video content.
 *
 * - generateAttentionCheck - A function that generates a short attention check prompt.
 * - GenerateAttentionCheckInput - The input type for the generateAttentionCheck function.
 * - GenerateAttentionCheckOutput - The return type for the generateAttentionCheck function.
 */

import {getAiEngine, type AiEngine} from '@/ai/genkit';
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

type GenkitInstance = AiEngine['instance'];

const attentionPromptCache = new WeakMap<
  GenkitInstance,
  ReturnType<GenkitInstance['definePrompt']>
>();
const attentionFlowCache = new WeakMap<
  GenkitInstance,
  ReturnType<GenkitInstance['defineFlow']>
>();

function getAttentionPrompt(engine: AiEngine) {
  let prompt = attentionPromptCache.get(engine.instance);
  if (!prompt) {
    prompt = engine.instance.definePrompt({
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
        model: engine.modelName,
        ...engine.runtimeConfig,
      },
    });
    attentionPromptCache.set(engine.instance, prompt);
  }
  return prompt;
}

function getAttentionFlow(engine: AiEngine) {
  let flow = attentionFlowCache.get(engine.instance);
  if (!flow) {
    const prompt = getAttentionPrompt(engine);
    flow = engine.instance.defineFlow(
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
    attentionFlowCache.set(engine.instance, flow);
  }

  return flow;
}

export async function generateAttentionCheck(input: GenerateAttentionCheckInput): Promise<GenerateAttentionCheckOutput> {
  const engine = await getAiEngine();
  const flow = getAttentionFlow(engine);
  return flow(input);
}
