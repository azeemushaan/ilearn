import {genkit, z} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';
import {adminFirestore} from '@/lib/firebase/admin';
import {
  defaultAiSettings,
  systemSettingsSchema,
  type AiRuntimeOptions,
  type AiSettings,
} from '@/lib/schemas';
import {getServerSecret} from '@/lib/secrets';

type AiInitialization = {
  instance: ReturnType<typeof genkit>;
  config: AiSettings;
  modelName: string;
  runtimeConfig: Record<string, unknown>;
};

const OPENAI_COMPATIBLE_PROVIDERS = new Set(['openrouter', 'openai']);
const GOOGLE_PROVIDER_ALIASES = new Set(['google', 'googleai']);
const OPENROUTER_DEFAULT_HEADERS = Object.freeze({
  'HTTP-Referer': 'https://ilearn.app',
  'X-Title': 'iLearn LMS',
});

function normalizeProvider(provider: string) {
  const normalized = (provider || '').trim().toLowerCase();
  if (GOOGLE_PROVIDER_ALIASES.has(normalized)) {
    return 'googleai';
  }
  return normalized;
}

function isOpenAiCompatible(provider: string) {
  return OPENAI_COMPATIBLE_PROVIDERS.has(provider.toLowerCase());
}

async function fetchAiSettings(): Promise<AiSettings & { apiKey?: string | null }> {
  try {
    // Prefer granular AI settings document written by the Admin Settings page
    const aiDoc = await adminFirestore().collection('settings').doc('system.ai').get();
    let ai: any = { ...defaultAiSettings };
    if (aiDoc.exists) {
      const data = aiDoc.data() ?? {};
      ai = {
        ...defaultAiSettings,
        provider: (data.provider as string) ?? defaultAiSettings.provider,
        model: (data.model as string) ?? defaultAiSettings.model,
        // Optional runtime overrides
        runtime: (data.runtime as any) ?? defaultAiSettings.runtime,
        requestHeaders: (data.requestHeaders as any) ?? defaultAiSettings.requestHeaders,
        baseUrl: (data.baseUrl as string | undefined),
        apiKey: (data.apiKey as string | undefined) ?? null,
      };
    } else {
      // Back-compat: fallback to legacy system doc
      const legacy = await adminFirestore().collection('settings').doc('system').get();
      const settings = legacy.exists ? systemSettingsSchema.parse(legacy.data() ?? {}) : { ai: defaultAiSettings } as any;
      ai = settings.ai ?? defaultAiSettings;
    }
    try {
      console.log('[AI] Loaded settings:', {
        provider: ai.provider,
        model: ai.model,
        apiKeyConfigured: Boolean(ai.apiKey),
      });
    } catch {}
    return ai as AiSettings & { apiKey?: string | null };
  } catch (error) {
    console.warn('[AI] Falling back to default settings due to Firestore read error:', error);
    return { ...defaultAiSettings, apiKey: null } as any;
  }
}

function buildPromptRuntimeConfig(runtime?: AiRuntimeOptions | null) {
  if (!runtime) {
    return {};
  }

  const {temperature, maxOutputTokens, topP, topK, stopSequences} = runtime;
  const config: Record<string, unknown> = {};
  if (typeof temperature === 'number') config.temperature = temperature;
  if (typeof maxOutputTokens === 'number') config.maxOutputTokens = maxOutputTokens;
  if (typeof topP === 'number') config.topP = topP;
  if (typeof topK === 'number') config.topK = topK;
  if (Array.isArray(stopSequences) && stopSequences.length > 0) {
    config.stopSequences = stopSequences;
  }
  return config;
}

function coalesceBaseUrl(config: AiSettings) {
  if (config.baseUrl) {
    return config.baseUrl;
  }
  const provider = (config.provider || '').toLowerCase();
  if (provider === 'openrouter') {
    return 'https://openrouter.ai/api/v1';
  }
  if (provider === 'openai') {
    return 'https://api.openai.com/v1';
  }
  return undefined;
}

function sanitizeHeaders(base: Record<string, string> = {}) {
  return Object.entries(base).reduce<Record<string, string>>((acc, [key, value]) => {
    if (value) {
      acc[key] = value;
    }
    return acc;
  }, {});
}

function mapFinishReason(reason?: string) {
  switch ((reason ?? '').toLowerCase()) {
    case 'stop':
      return 'stop';
    case 'length':
    case 'max_tokens':
      return 'length';
    case 'content_filter':
      return 'blocked';
    case 'tool_calls':
      return 'other';
    case 'null':
    case '':
      return 'unknown';
    default:
      return 'other';
  }
}

function normalizeMessageContent(parts: any) {
  const safeParts = Array.isArray(parts) ? parts : [parts];
  const text = safeParts
    .map(part => {
      if (!part) {
        return '';
      }
      if (typeof part === 'string') {
        return part;
      }
      if (typeof part?.text === 'string') {
        return part.text;
      }
      return '';
    })
    .filter(Boolean)
    .join('\n\n')
    .trim();

  return text.length > 0 ? text : ' ';
}

function convertMessages(messages: any[]) {
  return messages.map((message: any) => {
    const role = message.role === 'model' ? 'assistant' : message.role;
    const content = normalizeMessageContent(message.content ?? []);
    return {role: role ?? 'user', content};
  });
}

async function registerOpenAiCompatibleModel(
  instance: ReturnType<typeof genkit>,
  config: AiSettings,
  apiKey: string
) {
  const modelName = config.model;
  const runtimeDefaults = config.runtime ?? {};
  const baseUrl = coalesceBaseUrl(config);
  const headers = sanitizeHeaders({
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    ...(config.provider.toLowerCase() === 'openrouter' ? OPENROUTER_DEFAULT_HEADERS : {}),
    ...config.requestHeaders,
  });

  instance.defineModel(
    {
      name: modelName,
      configSchema: z
        .object({
          temperature: z.number().optional(),
          maxOutputTokens: z.number().optional(),
          topP: z.number().optional(),
          stopSequences: z.array(z.string()).optional(),
          presencePenalty: z.number().optional(),
          frequencyPenalty: z.number().optional(),
        })
        .passthrough(),
    },
    async request => {
      const mergedRuntime = {...runtimeDefaults, ...(request.config ?? {})} as AiRuntimeOptions;
      const payload: Record<string, unknown> = {
        model: config.model,
        messages: convertMessages(request.messages ?? []),
      };

      if (typeof mergedRuntime.temperature === 'number') {
        payload.temperature = mergedRuntime.temperature;
      }
      if (typeof mergedRuntime.maxOutputTokens === 'number') {
        payload.max_tokens = mergedRuntime.maxOutputTokens;
      }
      if (typeof mergedRuntime.topP === 'number') {
        payload.top_p = mergedRuntime.topP;
      }
      if (Array.isArray(mergedRuntime.stopSequences) && mergedRuntime.stopSequences.length > 0) {
        payload.stop = mergedRuntime.stopSequences;
      }
      if (typeof mergedRuntime.presencePenalty === 'number') {
        payload.presence_penalty = mergedRuntime.presencePenalty;
      }
      if (typeof mergedRuntime.frequencyPenalty === 'number') {
        payload.frequency_penalty = mergedRuntime.frequencyPenalty;
      }

      const response = await fetch(`${baseUrl ?? 'https://api.openai.com/v1'}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `[AI] Provider ${config.provider} request failed (${response.status}): ${errorText}`
        );
      }

      const data: any = await response.json();
      const choice = data.choices?.[0];
      const contentText = normalizeMessageContent(choice?.message?.content ?? '');

      return {
        candidates: [
          {
            index: choice?.index ?? 0,
            message: {
              role: 'model',
              content: [
                {
                  text: contentText,
                },
              ],
            },
            finishReason: mapFinishReason(choice?.finish_reason),
            custom: choice,
          },
        ],
        custom: data,
        usage: {
          inputTokens: data.usage?.prompt_tokens,
          outputTokens: data.usage?.completion_tokens,
          totalTokens: data.usage?.total_tokens,
        },
      };
    }
  );

  return modelName;
}

async function initializeAi(): Promise<AiInitialization> {
  const config = await fetchAiSettings();
  const runtimeConfig = Object.freeze(buildPromptRuntimeConfig(config.runtime));

  const requestedProvider = config.provider ?? '';
  const provider = normalizeProvider(requestedProvider);

  if (provider === 'googleai') {
    // Prefer explicit API key from settings; else allow secret indirection
    const explicitKeyRaw = (config as any).apiKey as unknown;
    const explicitKey = typeof explicitKeyRaw === 'string' && explicitKeyRaw.trim().length > 0
      ? explicitKeyRaw.trim()
      : undefined;
    const secretNameRaw = (config as any).apiKeySecret as unknown;
    const secretName = typeof secretNameRaw === 'string' && secretNameRaw.trim().length > 0
      ? secretNameRaw.trim()
      : undefined;
    const apiKey = explicitKey ?? (secretName ? getServerSecret(secretName) : undefined);
    // Normalize model id for Google provider, preserving explicit choices
    const rawModel = (config.model || '').trim();
    const finalModel = rawModel.startsWith('googleai/') ? rawModel : `googleai/${rawModel}`;
    try {
      console.log('[AI] Initializing GoogleAI provider', {
        provider: requestedProvider,
        model: finalModel,
        hasApiKey: Boolean(apiKey),
        keySource: explicitKey ? 'settings.apiKey' : (secretName ? `secret:${secretName}` : 'none'),
        baseUrl: config.baseUrl ?? null,
        apiKeyMask: apiKey ? `${apiKey.slice(0, 6)}…${apiKey.slice(-4)} (len=${apiKey.length})` : null,
      });
    } catch {}
    const plugins = [
      googleAI({
        apiKey,
        baseUrl: config.baseUrl,
      }),
    ];

    const instance = genkit({
      plugins,
      model: finalModel,
    });

    return {instance, config, modelName: finalModel, runtimeConfig};
  }

  if (isOpenAiCompatible(provider)) {
    if (!config.apiKeySecret) {
      throw new Error('AI provider configuration requires an apiKeySecret value.');
    }
    const apiKey = getServerSecret(config.apiKeySecret);
    try {
      console.log('[AI] Initializing OpenAI-compatible provider', {
        provider: requestedProvider,
        model: config.model,
        hasApiKey: Boolean(apiKey),
        baseUrl: coalesceBaseUrl(config) ?? null,
      });
    } catch {}
    const instance = genkit({
      model: config.model,
    });
    await registerOpenAiCompatibleModel(instance, config, apiKey);
    return {instance, config, modelName: config.model, runtimeConfig};
  }

  console.warn(
    `[AI] Unknown provider "${requestedProvider}". Falling back to Google Gemini with default settings.`
  );

  const fallbackInstance = genkit({
    plugins: [googleAI()],
    model: defaultAiSettings.model,
  });

  return {
    instance: fallbackInstance,
    config: defaultAiSettings,
    modelName: defaultAiSettings.model,
    runtimeConfig: Object.freeze(buildPromptRuntimeConfig(defaultAiSettings.runtime)),
  };
}

const initialization = initializeAi();
const {instance: ai, config: aiSettings, modelName: aiModelName, runtimeConfig: aiRuntimeConfig} =
  await initialization;

export {ai, aiModelName, aiRuntimeConfig, aiSettings};
