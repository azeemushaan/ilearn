/**
 * @fileOverview A flow for generating multiple-choice questions (MCQs) from video transcripts and metadata.
 *
 * - generateMcq - A function that generates MCQs from video transcripts and metadata.
 * - GenerateMcqInput - The input type for the generateMcq function.
 * - GenerateMcqOutput - The return type for the generateMcq function.
 */

import {getAiEngine, type AiEngine} from '@/ai/genkit';
import {z} from 'genkit';
import {
  getActivePromptTemplate,
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

type GenkitInstance = AiEngine['instance'];

const generateMcqPromptCache = new WeakMap<
  GenkitInstance,
  ReturnType<GenkitInstance['definePrompt']>
>();
const generateMcqFlowCache = new WeakMap<
  GenkitInstance,
  ReturnType<GenkitInstance['defineFlow']>
>();

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
    const engine = await getAiEngine();
    const flow = getGenerateMcqFlow(engine);
    return await flow(input);
  } catch (error) {
    const segmentId =
      input.videoId ??
      [input.videoTitle, input.chapterName].filter(Boolean).join('#') ||
      'unknown-segment';
    if (error instanceof McqGenerationError) {
      throw error;
    }

    const wrappedError = new McqGenerationError('MCQ generation flow failed', {
      videoTitle: input.videoTitle,
      chapterName: input.chapterName,
      difficultyTarget: input.difficultyTarget,
      segmentId,
      videoId: input.videoId,
      coachId: input.coachId,
    });

    if (typeof error === 'object' && error !== null) {
      (wrappedError as Error & {cause?: unknown}).cause = error;
    }

    console.error('generateMcq.unexpectedFailure', {
      segmentId,
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

function mapProviderForTelemetry(provider: string): SystemAiSettings['provider'] {
  const normalized = provider.toLowerCase();
  if (normalized === 'openai' || normalized === 'openrouter') {
    return 'openai';
  }
  if (normalized === 'anthropic') {
    return 'anthropic';
  }
  return 'google';
}

async function resolvePromptContext(engine: AiEngine): Promise<PromptContext> {
  const syntheticSettings: SystemAiSettings = {
    provider: mapProviderForTelemetry(engine.settings.provider),
    model: engine.settings.model,
    activePromptId: engine.settings.activePromptId,
    apiKeyMask: null,
    hasApiKey: Boolean(engine.settings.apiKeySecret),
  };

  const activePrompt = await getActivePromptTemplate(syntheticSettings);
  const content = activePrompt?.content ?? '';
  const trimmed = content.trim();
  const usedFallback = trimmed.length === 0;
  const promptId = activePrompt?.id ?? engine.settings.activePromptId ?? null;
  const template = usedFallback ? DEFAULT_MCQ_PROMPT_TEMPLATE : content;

  console.info('ai.prompt.context', {
    provider: engine.settings.provider,
    model: engine.settings.model,
    promptId,
    usedFallback,
  });

  return {
    template,
    promptId,
    usedFallback,
    provider: syntheticSettings.provider,
    model: engine.settings.model,
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

function getGenerateMcqPrompt(engine: AiEngine) {
  let prompt = generateMcqPromptCache.get(engine.instance);
  if (!prompt) {
    prompt = engine.instance.definePrompt({
      name: 'generateMcqPrompt',
      input: {schema: GenerateMcqInputSchema},
      output: {schema: GenerateMcqOutputSchema},
      prompt: async (_input, options) => {
        const template = (options?.context as { promptTemplate?: string } | undefined)?.promptTemplate;
        if (typeof template === 'string' && template.trim().length > 0) {
          return [{text: template}];
        }
        return [{text: DEFAULT_MCQ_PROMPT_TEMPLATE}];
      },
      config: {
        model: engine.modelName,
        ...engine.runtimeConfig,
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
    generateMcqPromptCache.set(engine.instance, prompt);
  }
  return prompt;
}

function getGenerateMcqFlow(engine: AiEngine) {
  let flow = generateMcqFlowCache.get(engine.instance);
  if (!flow) {
    const prompt = getGenerateMcqPrompt(engine);
    flow = engine.instance.defineFlow(
      {
        name: 'generateMcqFlow',
        inputSchema: GenerateMcqInputSchema,
        outputSchema: GenerateMcqOutputSchema,
      },
      async input => {
        const promptContext = await resolvePromptContext(engine);
        const segmentId =
          input.videoId ??
          [input.videoTitle, input.chapterName].filter(Boolean).join('#') ||
          'unknown-segment';
        try {
          const {output} = await prompt(input, {
            context: {promptTemplate: promptContext.template},
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

          const noQuestionsError = new McqGenerationError(
            'Genkit returned no MCQs for the provided video segment.',
            {
              videoTitle: input.videoTitle,
              chapterName: input.chapterName,
              difficultyTarget: input.difficultyTarget,
              segmentId,
              videoId: input.videoId,
              coachId: input.coachId,
            },
          );

          console.error('generateMcqFlow.noQuestions', {
            segmentId,
            message: noQuestionsError.message,
            metadata: noQuestionsError.metadata,
          });

          throw noQuestionsError;
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
              segmentId,
              message: error.message,
              metadata: error.metadata,
            });
            throw error;
          }

          const wrappedError = new McqGenerationError('MCQ generation failed', {
            videoTitle: input.videoTitle,
            chapterName: input.chapterName,
            difficultyTarget: input.difficultyTarget,
            segmentId,
            videoId: input.videoId,
            coachId: input.coachId,
          });

          if (typeof error === 'object' && error !== null) {
            (wrappedError as Error & {cause?: unknown}).cause = error;
          }

          console.error('generateMcqFlow.error', {
            segmentId,
            message: wrappedError.message,
            metadata: wrappedError.metadata,
            cause:
              error instanceof Error
                ? {name: error.name, message: error.message, stack: error.stack}
                : {message: String(error)},
          });

          throw wrappedError;
        }
      },
    );
    generateMcqFlowCache.set(engine.instance, flow);
  }

  return flow;
}
