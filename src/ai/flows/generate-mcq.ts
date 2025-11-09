'use server';

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
import { McqGenerationError } from './mcq-errors';

const GenerateMcqInputSchema = z.object({
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
  hasApiKey: boolean;
  apiKeyMask: string | null;
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
  try {
    // Validate transcript chunk before processing
    validateTranscriptChunk(input.transcriptChunk);
    
    try {
      console.log('[MCQ] generateMcq.start', {
        videoTitle: input.videoTitle,
        chapterName: input.chapterName,
        difficultyTarget: input.difficultyTarget,
        transcriptLen: input.transcriptChunk?.length ?? 0,
        transcriptPreview: (input.transcriptChunk || '').slice(0, 120),
      });
    } catch {}
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

const DEFAULT_MCQ_PROMPT_TEMPLATE = `You are an AI assistant generating quiz questions for educational videos. The student watches videos divided into clear segments (60–120 seconds each). 

**CRITICAL RULES:**
1. **ONLY use information from the provided transcript chunk below** — DO NOT reference other segments, general knowledge, or unrelated topics
2. If the transcript is too short, vague, or unrelated to the video title, return { "questions": [], "progress": "Insufficient context in segment" }
3. Each question MUST cite a specific phrase from the transcript in the rationale
4. Generate 1–3 unique MCQs that test understanding of THIS segment only

**CONTEXT:**
- Video Title: {{{videoTitle}}}
- Segment: {{{chapterName}}}
- Grade Band: {{{gradeBand}}}
- Language: {{{locale}}}
- Difficulty: {{{difficultyTarget}}}

**TRANSCRIPT (THIS SEGMENT ONLY):**
"""
{{{transcriptChunk}}}
"""

**REQUIRED OUTPUT FORMAT:**
{
  "questions": [
    {
      "stem": "Clear, specific question about the transcript above",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "rationale": "Quote the exact phrase from transcript that supports this answer: '...'",
      "tags": ["topic keyword"],
      "difficulty": "easy" | "medium" | "hard"
    }
  ],
  "progress": "Generated N questions from segment transcript."
}

**QUALITY CHECKS:**
- ✅ Every answer is supported by a direct quote from the transcript
- ✅ Question is about the SPECIFIC content in this segment
- ✅ Avoids generic/recycled questions from other videos
- ❌ Do NOT generate questions if transcript is empty or irrelevant
- ❌ Do NOT use external knowledge or other video segments

**SAFETY:** Maintain neutral tone, child-safe content, no personal data, avoid controversial topics unless educational.`;

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
    hasApiKey: aiSettings.hasApiKey,
    apiKeyMask: aiSettings.apiKeyMask,
  };
}

/**
 * Validate transcript chunk before MCQ generation
 * Rejects placeholder text and insufficient content
 */
function validateTranscriptChunk(transcriptChunk: string): void {
  // Check for minimum content length
  if (transcriptChunk.length < 50) {
    throw new Error('Invalid transcript: insufficient content (minimum 50 characters required)');
  }

  // Check for placeholder text pattern (e.g., "Segment at 3:45 - 4:30")
  const placeholderPattern = /^Segment at \d+:\d+ - \d+:\d+$/i;
  if (placeholderPattern.test(transcriptChunk.trim())) {
    throw new Error('Invalid transcript: placeholder text detected. Please provide actual caption content.');
  }

  // Check if content is just timestamps or minimal text
  const meaningfulWords = transcriptChunk
    .replace(/\d+:\d+/g, '') // Remove timestamps
    .split(/\s+/)
    .filter(word => word.length > 2);
  
  if (meaningfulWords.length < 10) {
    throw new Error('Invalid transcript: insufficient meaningful content');
  }
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

const generateMcqPromptConfig: Record<string, unknown> = {
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
};

if (!aiModelName.startsWith('googleai/')) {
  generateMcqPromptConfig.model = aiModelName;
}

const generateMcqPrompt = ai.definePrompt({
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
  config: generateMcqPromptConfig,
});

const generateMcqFlow = ai.defineFlow(
  {
    name: 'generateMcqFlow',
    inputSchema: GenerateMcqInputSchema,
    outputSchema: GenerateMcqOutputSchema,
  },
  async input => {
    const promptContext = await resolvePromptContext();
    try {
      try {
        console.log('[MCQ] promptContext', {
          provider: promptContext.provider,
          model: promptContext.model,
          usedFallbackTemplate: promptContext.usedFallback,
          runtimeConfig: generateMcqPromptConfig,
          effectiveModel: generateMcqPromptConfig.model ?? aiModelName,
          hasApiKeyConfigured: promptContext.hasApiKey,
          apiKeyMask: promptContext.apiKeyMask,
          promptTemplateSource: promptContext.promptId ?? (promptContext.usedFallback ? 'fallback' : 'unknown'),
        });
      } catch {}
      const {output} = await generateMcqPrompt(input, {
        context: { promptTemplate: promptContext.template },
      });

      if (output && output.questions.length > 0) {
        try {
          console.log('[MCQ] generation.success', {
            count: output.questions.length,
            firstStemPreview: output.questions[0]?.stem?.slice(0, 120),
          });
        } catch {}
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
      // Fallback: synthesize a basic question when the model returns none (e.g., no captions)
      const fallback = buildFallbackQuestion(input);
      console.warn('[MCQ] generation.empty_output_using_fallback');
      await safeRecordPromptUsage({
        promptId: promptContext.promptId,
        status: 'success',
        videoTitle: input.videoTitle,
        chapterName: input.chapterName,
        difficulty: input.difficultyTarget,
        locale: input.locale,
        coachId: input.coachId,
        videoId: input.videoId,
        usedFallback: true,
        provider: promptContext.provider,
        model: promptContext.model,
      });
      return { questions: [fallback], progress: 'Used fallback due to empty model output.' };
    } catch (error) {
      try {
        console.error('generateMcqFlow.stepError', {
          message: error instanceof Error ? error.message : String(error),
          videoTitle: input.videoTitle,
          chapterName: input.chapterName,
          difficultyTarget: input.difficultyTarget,
        });
      } catch {}
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
        // Final fallback path in case of provider error
        const fallback = buildFallbackQuestion(input);
        console.warn('[MCQ] generation.provider_error_using_fallback', {
          error: error.message,
        });
        return { questions: [fallback], progress: 'Used fallback due to provider error.' };
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
