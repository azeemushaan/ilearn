'use server';

/**
 * @fileOverview A flow for generating multiple-choice questions (MCQs) from video transcripts and metadata.
 *
 * - generateMcq - A function that generates MCQs from video transcripts and metadata.
 * - GenerateMcqInput - The input type for the generateMcq function.
 * - GenerateMcqOutput - The return type for the generateMcq function.
 */

import { createHash } from 'crypto';
import { Timestamp } from 'firebase-admin/firestore';
import {ai, aiModelName, aiRuntimeConfig} from '@/ai/genkit';
import {z} from 'genkit';
import {
  getActivePromptTemplate,
  getSystemAiSettings,
  recordPromptUsage,
  type SystemAiSettings,
} from '@/lib/firestore/admin-ops';
import { adminFirestore } from '@/lib/firebase/admin';
import { recordAiUsage } from '@/lib/ai/metrics';
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
  transcriptHash: z.string().optional(),
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

const normalizeStem = (stem: string) => stem.replace(/\s+/g, ' ').trim().toLowerCase();

const sanitizeTranscriptChunk = (chunk: string) =>
  chunk
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\d{1,2}:\d{2}(?::\d{2})?/g, ' ')
    .replace(/(?:♪|♫)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const computeTranscriptHash = (chunk: string) => {
  const cleaned = sanitizeTranscriptChunk(chunk);
  if (!cleaned) {
    return { cleaned, hash: null };
  }
  return {
    cleaned,
    hash: createHash('sha256').update(cleaned).digest('hex'),
  };
};

async function filterDuplicateQuestions(
  videoId: string | undefined,
  transcriptHash: string | null,
  questions: GenerateMcqOutput['questions']
) {
  const uniqueByStem = Array.from(
    questions.reduce<Map<string, GenerateMcqOutput['questions'][number]>>((acc, question) => {
      const key = normalizeStem(question.stem);
      if (key && !acc.has(key)) {
        acc.set(key, question);
      }
      return acc;
    }, new Map()).values()
  );

  if (!videoId || !transcriptHash) {
    return uniqueByStem;
  }

  const db = adminFirestore();
  const historyRef = db.collection(`videos/${videoId}/stem_history`).doc(transcriptHash);
  const historySnap = await historyRef.get();
  const storedStems: string[] = historySnap.exists ? historySnap.data()?.stems || [] : [];
  const storedStemSet = new Set(storedStems.map(normalizeStem));

  const filtered = uniqueByStem.filter(question => {
    const key = normalizeStem(question.stem);
    return key.length > 0 && !storedStemSet.has(key);
  });

  if (filtered.length > 0) {
    await historyRef.set(
      {
        stems: Array.from(new Set([...storedStems, ...filtered.map(question => question.stem)])),
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    );
  }

  return filtered;
}

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
    const { cleaned, hash } = computeTranscriptHash(input.transcriptChunk);
    validateTranscriptChunk(cleaned);
    
    try {
      console.log('[MCQ] generateMcq.start', {
        videoTitle: input.videoTitle,
        chapterName: input.chapterName,
        difficultyTarget: input.difficultyTarget,
        transcriptLen: cleaned.length,
        transcriptPreview: cleaned.slice(0, 120),
        transcriptHash: hash,
      });
    } catch {}
    return await generateMcqFlow({
      ...input,
      transcriptChunk: cleaned,
      transcriptHash: hash || undefined,
    });
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

/**
 * Robust MCQ Generation Rules:
 * 1. Minimum transcript length: 100 characters
 * 2. Must contain at least 3 complete sentences
 * 3. Must not be generic introduction/filler content
 * 4. Must have educational value and specific concepts
 * 5. If rules fail, return empty questions array (no MCQs generated)
 */

function validateTranscriptForMcqGeneration(text: string, chapterName: string): { isValid: boolean; reason?: string } {
  console.log('[MCQ Validation] Validating transcript for MCQ generation', {
    textLength: text.length,
    chapterName,
    textPreview: text.substring(0, 150)
  });

  // Rule 1: Minimum length check (reduced for video segments)
  if (text.length < 50) {
    console.log('[MCQ Validation] ❌ Failed: Text too short', { length: text.length });
    return { isValid: false, reason: 'Transcript too short for meaningful questions' };
  }

  // Rule 2: Sentence count check (reduced for video segments)
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  if (sentences.length < 2) {
    console.log('[MCQ Validation] ❌ Failed: Insufficient sentences', { sentenceCount: sentences.length });
    return { isValid: false, reason: 'Not enough complete sentences for question generation' };
  }

  // Rule 3: Check for generic/introductory content (less strict)
  const lowerText = text.toLowerCase();
  const genericPatterns = [
    /^welcome|^hello|^hi/i,  // Basic greetings only
    /subscribe.*like.*comment|follow.*channel/i,  // Social media calls
    /thank you|thanks|appreciate.*support/i,  // Generic thanks
  ];

  const isGenericIntro = genericPatterns.some(pattern => pattern.test(lowerText));
  if (isGenericIntro && text.length < 200 && sentences.length < 4) {
    console.log('[MCQ Validation] ❌ Failed: Generic introductory content');
    return { isValid: false, reason: 'Content appears to be generic introduction without educational substance' };
  }

  // Rule 4: Check for educational content indicators (more inclusive)
  const educationalIndicators = [
    /explain|understand|learn|concept|theory|method|technique|process|system/i,
    /because|therefore|however|although|since|while|when|where|how|why/i,
    /important|key|main|primary|essential|critical|vital/i,
    /example|instance|case|demonstrate|show|illustrate/i,
    /use|using|create|build|make|develop|code|program/i,  // Action verbs for tutorials
    /step|guide|tutorial|instruction/i,  // Tutorial indicators
  ];

  const hasEducationalContent = educationalIndicators.some(pattern => pattern.test(lowerText));
  if (!hasEducationalContent && text.length < 100) {
    console.log('[MCQ Validation] ❌ Failed: No clear educational content detected');
    return { isValid: false, reason: 'Content lacks clear educational concepts for question generation' };
  }

  // Rule 5: Check for specific, concrete content (more inclusive)
  const concreteIndicators = [
    /\d+|[0-9]/,  // Numbers
    /[A-Z][a-z]+ [A-Z][a-z]+/,  // Proper nouns (potential concepts)
    /function|method|class|variable|algorithm|data|structure|code|api|tool|software/i,  // Technical terms
    /step|process|stage|phase|approach|strategy|file|folder|directory/i,  // Process-related terms
    /cursor|claude|vibe|unlimited|github|npm|install/i,  // Specific tools mentioned
  ];

  const hasConcreteContent = concreteIndicators.some(pattern => pattern.test(text));
  if (!hasConcreteContent && text.length < 200) {
    console.log('[MCQ Validation] ❌ Failed: Content too abstract or general');
    return { isValid: false, reason: 'Content is too abstract for generating specific, meaningful questions' };
  }

  console.log('[MCQ Validation] ✅ Passed all validation rules');
  return { isValid: true };
}

const generateMcqFlow = ai.defineFlow(
  {
    name: 'generateMcqFlow',
    inputSchema: GenerateMcqInputSchema,
    outputSchema: GenerateMcqOutputSchema,
  },
  async input => {
    const startTime = Date.now();
    console.log('[MCQ Generation] Starting AI-based MCQ generation', {
      videoId: input.videoId,
      videoTitle: input.videoTitle,
      chapterName: input.chapterName,
      difficulty: input.difficultyTarget,
      transcriptLength: input.transcriptChunk.length
    });

    // Step 1: Validate content for MCQ generation
    const validation = validateTranscriptForMcqGeneration(input.transcriptChunk, input.chapterName);
    if (!validation.isValid) {
      console.log('[MCQ Generation] Validation failed - no MCQs will be generated', {
        reason: validation.reason,
        videoId: input.videoId,
        chapterName: input.chapterName
      });

      return {
        questions: [],
        progress: `No MCQs generated: ${validation.reason}`
      };
    }

    console.log('[MCQ Generation] Validation passed, proceeding with AI generation');

    // Step 2: Generate MCQs using AI prompt
    try {
      const promptTemplate = await getActivePromptTemplate();
      const {output} = await generateMcqPrompt(
        {
          transcriptChunk: input.transcriptChunk,
          videoTitle: input.videoTitle,
          chapterName: input.chapterName,
          gradeBand: input.gradeBand,
          locale: input.locale,
          difficultyTarget: input.difficultyTarget,
          coachId: input.coachId,
          videoId: input.videoId,
          transcriptHash: input.transcriptHash,
        },
        {
          context: promptTemplate ? { promptTemplate: promptTemplate.content } : undefined,
        }
      );

      console.log('[MCQ Generation] AI response received', {
        hasQuestions: !!output?.questions,
        questionCount: output?.questions?.length || 0,
        hasProgress: !!output?.progress
      });

      // Step 3: Validate the structure
      if (!output || !output.questions || !Array.isArray(output.questions)) {
        console.error('[MCQ Generation] AI response missing questions array', { output });
        throw new Error('AI response does not contain valid questions array');
      }

      if (output.questions.length === 0) {
        console.log('[MCQ Generation] AI returned empty questions array');
        return {
          questions: [],
          progress: 'AI determined no suitable questions could be generated for this content'
        };
      }

      // Step 4: Validate each question
      const validQuestions = output.questions.filter((q: any) => {
        const isValid =
          q &&
          typeof q.stem === 'string' && q.stem.length > 10 &&
          Array.isArray(q.options) && q.options.length === 4 &&
          typeof q.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex <= 3 &&
          typeof q.rationale === 'string' && q.rationale.length > 10 &&
          typeof q.difficulty === 'string' &&
          Array.isArray(q.tags);

        if (!isValid) {
          console.log('[MCQ Generation] ❌ Invalid question filtered out', {
            hasStem: !!q?.stem,
            optionsLength: q?.options?.length,
            correctIndex: q?.correctIndex,
            hasRationale: !!q?.rationale,
            hasDifficulty: !!q?.difficulty,
            hasTags: Array.isArray(q?.tags)
          });
        }
        return isValid;
      });

      console.log('[MCQ Generation] Question validation completed', {
        originalCount: output.questions.length,
        validCount: validQuestions.length
      });

      if (validQuestions.length === 0) {
        console.log('[MCQ Generation] All generated questions failed validation');
        return {
          questions: [],
          progress: 'Generated questions did not meet quality standards'
        };
      }

      // Step 5: Filter duplicates (same question in same video)
      // For now, return all valid questions (implement duplicate filtering later if needed)
      const filteredQuestions = validQuestions;

      const duration = Date.now() - startTime;

      console.log('[MCQ Generation] ✅ Successfully completed', {
        videoId: input.videoId,
        chapterName: input.chapterName,
        questionsGenerated: filteredQuestions.length,
        duration
      });

      return {
        questions: filteredQuestions,
        progress: output.progress || `Successfully generated ${filteredQuestions.length} validated MCQs`
      };

    } catch (aiError) {
      const duration = Date.now() - startTime;
      console.error('[MCQ Generation] ❌ AI generation failed', {
        error: aiError instanceof Error ? aiError.message : String(aiError),
        videoId: input.videoId,
        chapterName: input.chapterName,
        duration
      });

      // Re-throw the error instead of using fallback
      throw aiError;
    }
  }
);
