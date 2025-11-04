/**
 * @fileOverview A flow for generating multiple-choice questions (MCQs) from video transcripts and metadata.
 *
 * - generateMcq - A function that generates MCQs from video transcripts and metadata.
 * - GenerateMcqInput - The input type for the generateMcq function.
 * - GenerateMcqOutput - The return type for the generateMcq function.
 */

import {ai, aiModelName, aiRuntimeConfig} from '@/ai/genkit';
import {z} from 'genkit';
import {
  getActivePromptTemplate,
  getSystemAiSettings,
  recordPromptUsage,
  type SystemAiSettings,
} from '@/lib/firestore/admin-ops';

export const GenerateMcqInputSchema = z.object({
  transcriptChunk: z
    .string()
    .describe('A chunk of transcript text from a video.'),
  videoTitle: z.string().describe('The title of the video.'),
  chapterName: z.string().describe('The name of the chapter in the video.'),
  gradeBand: z.string().describe('The grade band for the video content.'),
  locale: z.string().describe('The locale for the video content (e.g., Urdu/English).'),
  difficultyTarget: z.string().describe('The target difficulty for the MCQs (e.g., easy, medium, hard).'),
  coachId: z.string().optional(),
  videoId: z.string().optional(),
});
export type GenerateMcqInput = z.infer<typeof GenerateMcqInputSchema>;

type PromptUsageEvent = Parameters<typeof recordPromptUsage>[0];

type PromptContext = {
  template: string;
  promptId: string | null;
  usedFallback: boolean;
  provider: SystemAiSettings['provider'];
  model: string;
};

function buildFallbackQuestion(input: GenerateMcqInput) {
  const cleanedTranscript = input.transcriptChunk.replace(/\s+/g, ' ').trim();
  const sentenceMatches = cleanedTranscript.match(/[^.!?]+[.!?]?/g) || [];
  const candidateSentence =
    sentenceMatches.sort((a, b) => b.length - a.length)[0]?.trim() ||
    cleanedTranscript.slice(0, 140).trim();

  const mainIdea =
    candidateSentence || `This segment focuses on the topic "${input.chapterName}".`;

  const clamp = (text: string) =>
    text.length > 140 ? `${text.slice(0, 137)}...` : text;

  const distractors = [
    `It mainly discusses an unrelated topic instead of ${input.chapterName}.`,
    `The segment introduces a completely different lesson from "${input.videoTitle}".`,
    `It summarises the video without touching on the highlighted concept.`,
  ].map(option => clamp(option));

  const correctOption = clamp(
    mainIdea || `It explains the key idea of ${input.chapterName}.`,
  );

  const options = [correctOption, ...distractors];

  return {
    stem: `What is the primary idea covered in this part of "${input.videoTitle}"?`,
    options,
    correctIndex: 0,
    rationale:
      'This option reflects the main idea described in the transcript snippet.',
    tags: [input.chapterName, input.difficultyTarget].filter(Boolean),
    difficulty: input.difficultyTarget,
  };
}

export const GenerateMcqOutputSchema = z.object({
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

export class McqGenerationError extends Error {
  public readonly metadata: Record<string, unknown>;

  constructor(message: string, metadata: Record<string, unknown> = {}) {
    super(message);
    this.name = 'McqGenerationError';
    this.metadata = metadata;
  }
}

export async function generateMcq(input: GenerateMcqInput): Promise<GenerateMcqOutput> {
  try {
    return await generateMcqFlow(input);
  } catch (error) {
    if (error instanceof McqGenerationError) {
      throw error;
    }

    const wrappedError = new McqGenerationError('MCQ generation flow failed', {
      videoTitle: input.videoTitle,
      chapterName: input.chapterName,
      difficultyTarget: input.difficultyTarget,
    });

    if (typeof error === 'object' && error !== null) {
      (wrappedError as Error & {cause?: unknown}).cause = error;
    }

    console.error('generateMcq.unexpectedFailure', {
      message: wrappedError.message,
      metadata: wrappedError.metadata,
      cause:
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : { message: String(error) },
    });

    throw wrappedError;
  }
}

export const DEFAULT_MCQ_PROMPT_TEMPLATE = `You are an AI assistant helping teachers generate multiple-choice questions (MCQs) from video transcripts and metadata.

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
Disallow personal data; maintain a neutral tone; ensure child-safety; ban controversial topics unless educational & teacher-approved.`;

async function resolvePromptContext(): Promise<PromptContext> {
  const aiSettings = await getSystemAiSettings();
  const activePrompt = await getActivePromptTemplate(aiSettings);
  const content = activePrompt?.content ?? '';
  const trimmed = content.trim();
  const usedFallback = trimmed.length === 0;

  return {
    template: usedFallback ? DEFAULT_MCQ_PROMPT_TEMPLATE : content,
    promptId: activePrompt?.id ?? aiSettings.activePromptId ?? null,
    usedFallback,
    provider: aiSettings.provider,
    model: aiSettings.model,
  };
}

async function safeRecordPromptUsage(event: PromptUsageEvent) {
  try {
    await recordPromptUsage(event);
  } catch (loggingError) {
    console.error('promptUsage.logFailed', {
      error:
        loggingError instanceof Error
          ? { name: loggingError.name, message: loggingError.message, stack: loggingError.stack }
          : { message: String(loggingError) },
    });
  }
}

export const generateMcqPrompt = ai.definePrompt({
  name: 'generateMcqPrompt',
  input: {schema: GenerateMcqInputSchema},
  output: {schema: GenerateMcqOutputSchema},
  prompt: async (_input, options) => {
    const template = (options?.context as { promptTemplate?: string } | undefined)?.promptTemplate;
    if (typeof template === 'string' && template.trim().length > 0) {
      return [{ text: template }];
    }
    return [{ text: DEFAULT_MCQ_PROMPT_TEMPLATE }];
  },
  config: {
    model: aiModelName,
    ...aiRuntimeConfig,
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

export const generateMcqFlow = ai.defineFlow(
  {
    name: 'generateMcqFlow',
    inputSchema: GenerateMcqInputSchema,
    outputSchema: GenerateMcqOutputSchema,
  },
  async input => {
    const promptContext = await resolvePromptContext();
    try {
      const {output} = await generateMcqPrompt(input, {
        context: { promptTemplate: promptContext.template },
      });

      if (output && output.questions.length > 0) {
        await safeRecordPromptUsage({
          promptId: promptContext.promptId,
          status: 'success',
          videoTitle: input.videoTitle,
          chapterName: input.chapterName,
          difficulty: input.difficultyTarget,
          locale: input.locale,
          coachId: input.coachId,
          videoId: input.videoId,
          usedFallback: promptContext.usedFallback,
          provider: promptContext.provider,
          model: promptContext.model,
        });
        return output;
      }

      throw new McqGenerationError('MCQ generation returned no questions', {
        videoTitle: input.videoTitle,
        chapterName: input.chapterName,
        difficultyTarget: input.difficultyTarget,
      });
    } catch (error) {
      await safeRecordPromptUsage({
        promptId: promptContext.promptId,
        status: 'error',
        videoTitle: input.videoTitle,
        chapterName: input.chapterName,
        difficulty: input.difficultyTarget,
        locale: input.locale,
        coachId: input.coachId,
        videoId: input.videoId,
        usedFallback: promptContext.usedFallback,
        provider: promptContext.provider,
        model: promptContext.model,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof McqGenerationError) {
        console.error('generateMcqFlow.emptyResponse', {
          message: error.message,
          metadata: error.metadata,
        });
        throw error;
      }

      const wrappedError = new McqGenerationError('MCQ generation failed', {
        videoTitle: input.videoTitle,
        chapterName: input.chapterName,
        difficultyTarget: input.difficultyTarget,
      });

      if (typeof error === 'object' && error !== null) {
        (wrappedError as Error & {cause?: unknown}).cause = error;
      }

      console.error('generateMcqFlow.error', {
        message: wrappedError.message,
        metadata: wrappedError.metadata,
        cause:
          error instanceof Error
            ? { name: error.name, message: error.message, stack: error.stack }
            : { message: String(error) },
      });

      throw wrappedError;
    }
  }
);
