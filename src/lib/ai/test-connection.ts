import {z} from 'genkit';

import {getAiEngine, type AiEngine} from '@/ai/genkit';

const TestConnectionOutputSchema = z.object({
  message: z.string().min(1),
});

type GenkitInstance = AiEngine['instance'];

const testPromptCache = new WeakMap<
  GenkitInstance,
  ReturnType<GenkitInstance['definePrompt']>
>();

const TEST_PROMPT = `You are verifying the AI configuration for the iLearn LMS admin console.\n\nRespond immediately with a single JSON object in the format {"message":"pong"}.\nDo not include Markdown, code fences, or any additional keys.`;

export type AiConnectionTestResult = {
  provider: string;
  model: string;
  latencyMs: number;
  reply: string;
};

function getTestPrompt(engine: AiEngine) {
  let prompt = testPromptCache.get(engine.instance);
  if (!prompt) {
    prompt = engine.instance.definePrompt({
      name: 'adminTestConnectionPrompt',
      input: {schema: z.object({})},
      output: {schema: TestConnectionOutputSchema},
      prompt: async () => [{text: TEST_PROMPT}],
      config: {
        model: engine.modelName,
        ...engine.runtimeConfig,
        maxOutputTokens: 64,
      },
    });
    testPromptCache.set(engine.instance, prompt);
  }
  return prompt;
}

export async function runAiConnectionTest(): Promise<AiConnectionTestResult> {
  const engine = await getAiEngine({bypassCache: true, refresh: true});
  const prompt = getTestPrompt(engine);
  const startedAt = Date.now();
  const {output} = await prompt({});
  const latencyMs = Date.now() - startedAt;
  const reply = (output?.message ?? '').trim();

  if (!reply) {
    throw new Error('The AI provider returned an empty response.');
  }

  if (!/pong/i.test(reply)) {
    throw new Error(`Unexpected response from the AI provider: ${reply}`);
  }

  return {
    provider: engine.settings.provider,
    model: engine.modelName,
    latencyMs,
    reply,
  } satisfies AiConnectionTestResult;
}
