import {cache} from 'react';
import {genkit, z} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

import {adminFirestore} from '@/lib/firebase/admin';
import {defaultAiSettings, type AiRuntimeOptions} from '@/lib/schemas';
import {getServerSecret} from '@/lib/secrets';

type SystemAiConfig = {
  provider: string;
  model: string;
  baseUrl?: string;
  apiKeySecret?: string;
  runtime: AiRuntimeOptions;
  requestHeaders: Record<string, string>;
  activePromptId: string | null;
};

type AiEngine = {
  instance: ReturnType<typeof genkit>;
  settings: SystemAiConfig;
  modelName: string;
  runtimeConfig: Record<string, unknown>;
};

const OPENAI_COMPATIBLE_PROVIDERS = new Set(['openrouter', 'openai']);
const OPENROUTER_DEFAULT_HEADERS = Object.freeze({
  'HTTP-Referer': 'https://ilearn.app',
  'X-Title': 'iLearn LMS',
});
const MAX_TRANSPORT_RETRIES = 2;

function isOpenAiCompatible(provider: string) {
  return OPENAI_COMPATIBLE_PROVIDERS.has(provider.toLowerCase());
}

function sanitizeHeadersRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>(
    (acc, [key, headerValue]) => {
      if (typeof key !== 'string') {
        return acc;
      }
      if (typeof headerValue !== 'string') {
        return acc;
      }
      const trimmed = headerValue.trim();
      if (!trimmed) {
        return acc;
      }
      acc[key] = trimmed;
      return acc;
    },
    {},
  );
}

function sanitizeRuntime(value: unknown): AiRuntimeOptions {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const runtime = value as Record<string, unknown>;
  const sanitized: AiRuntimeOptions = {};

  if (typeof runtime.temperature === 'number') sanitized.temperature = runtime.temperature;
  if (typeof runtime.maxOutputTokens === 'number') sanitized.maxOutputTokens = runtime.maxOutputTokens;
  if (typeof runtime.topP === 'number') sanitized.topP = runtime.topP;
  if (typeof runtime.topK === 'number') sanitized.topK = runtime.topK;
  if (typeof runtime.presencePenalty === 'number') sanitized.presencePenalty = runtime.presencePenalty;
  if (typeof runtime.frequencyPenalty === 'number') sanitized.frequencyPenalty = runtime.frequencyPenalty;
  if (Array.isArray(runtime.stopSequences)) {
    const stops = runtime.stopSequences.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
    if (stops.length > 0) {
      sanitized.stopSequences = stops;
    }
  }

  return sanitized;
}

function sanitizeBaseUrl(url?: unknown): string | undefined {
  if (typeof url !== 'string') {
    return undefined;
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    // Validate URL shape without mutating the provided value.
    const parsed = new URL(trimmed);
    return parsed.toString();
  } catch {
    console.warn('[AI] Ignoring invalid baseUrl from system.ai settings');
    return undefined;
  }
}

function sanitizeSystemAiConfig(raw: Record<string, unknown>): SystemAiConfig {
  const provider = typeof raw.provider === 'string' && raw.provider.trim().length > 0
    ? raw.provider.trim()
    : defaultAiSettings.provider;
  const model = typeof raw.model === 'string' && raw.model.trim().length > 0
    ? raw.model.trim()
    : defaultAiSettings.model;

  const apiKeySecret = typeof raw.apiKeySecret === 'string' && raw.apiKeySecret.trim().length > 0
    ? raw.apiKeySecret.trim()
    : undefined;

  const activePromptId = typeof raw.activePromptId === 'string' && raw.activePromptId.trim().length > 0
    ? raw.activePromptId.trim()
    : null;

  return {
    provider,
    model,
    baseUrl: sanitizeBaseUrl(raw.baseUrl),
    apiKeySecret,
    runtime: sanitizeRuntime(raw.runtime),
    requestHeaders: sanitizeHeadersRecord(raw.requestHeaders),
    activePromptId,
  } satisfies SystemAiConfig;
}

function buildPromptRuntimeConfig(runtime?: AiRuntimeOptions | null) {
  if (!runtime) {
    return {};
  }

  const {temperature, maxOutputTokens, topP, topK, stopSequences, presencePenalty, frequencyPenalty} = runtime;
  const config: Record<string, unknown> = {};
  if (typeof temperature === 'number') config.temperature = temperature;
  if (typeof maxOutputTokens === 'number') config.maxOutputTokens = maxOutputTokens;
  if (typeof topP === 'number') config.topP = topP;
  if (typeof topK === 'number') config.topK = topK;
  if (typeof presencePenalty === 'number') config.presencePenalty = presencePenalty;
  if (typeof frequencyPenalty === 'number') config.frequencyPenalty = frequencyPenalty;
  if (Array.isArray(stopSequences) && stopSequences.length > 0) {
    config.stopSequences = stopSequences;
  }
  return config;
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

async function requestWithRetries(url: string, init: RequestInit, provider: string): Promise<Response> {
  let attempt = 0;
  let lastError: unknown;
  while (attempt <= MAX_TRANSPORT_RETRIES) {
    try {
      const response = await fetch(url, init);
      if (response.ok) {
        return response;
      }

      const shouldRetry = response.status >= 500 || response.status === 429;
      const errorText = await response.text().catch(() => response.statusText);
      lastError = new Error(
        `[AI] Provider ${provider} request failed (${response.status}): ${errorText}`,
      );

      if (!shouldRetry || attempt === MAX_TRANSPORT_RETRIES) {
        throw lastError;
      }
    } catch (error) {
      lastError = error;
      if (attempt === MAX_TRANSPORT_RETRIES) {
        break;
      }
    }

    const delayMs = 200 * 2 ** attempt;
    await new Promise(resolve => setTimeout(resolve, delayMs));
    attempt += 1;
  }

  throw lastError ?? new Error(`[AI] Provider ${provider} request failed`);
}

function coalesceBaseUrl(config: SystemAiConfig) {
  if (config.baseUrl) {
    return config.baseUrl;
  }
  const provider = config.provider.toLowerCase();
  if (provider === 'openrouter') {
    return 'https://openrouter.ai/api/v1';
  }
  if (provider === 'openai') {
    return 'https://api.openai.com/v1';
  }
  return undefined;
}

function resolveOpenAiHeaders(config: SystemAiConfig, apiKey: string) {
  const provider = config.provider.toLowerCase();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    ...config.requestHeaders,
  };

  if (provider === 'openrouter') {
    Object.assign(headers, OPENROUTER_DEFAULT_HEADERS);
  }

  return headers;
}

async function registerOpenAiCompatibleModel(
  instance: ReturnType<typeof genkit>,
  config: SystemAiConfig,
  apiKey: string,
) {
  const modelName = config.model;
  const runtimeDefaults = config.runtime ?? {};
  const baseUrl = coalesceBaseUrl(config) ?? 'https://api.openai.com/v1';
  const headers = resolveOpenAiHeaders(config, apiKey);

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

      const response = await requestWithRetries(
        `${baseUrl.replace(/\/$/, '')}/chat/completions`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        },
        config.provider,
      );

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
    },
  );
}

async function fetchSystemAiConfig(): Promise<SystemAiConfig> {
  try {
    const doc = await adminFirestore().collection('settings').doc('system.ai').get();
    if (!doc.exists) {
      return {
        provider: defaultAiSettings.provider,
        model: defaultAiSettings.model,
        runtime: defaultAiSettings.runtime,
        requestHeaders: defaultAiSettings.requestHeaders,
        baseUrl: undefined,
        apiKeySecret: undefined,
        activePromptId: null,
      } satisfies SystemAiConfig;
    }

    const raw = doc.data() ?? {};
    return sanitizeSystemAiConfig(raw);
  } catch (error) {
    console.warn('[AI] Falling back to default settings due to Firestore read error:', error);
    return {
      provider: defaultAiSettings.provider,
      model: defaultAiSettings.model,
      runtime: defaultAiSettings.runtime,
      requestHeaders: defaultAiSettings.requestHeaders,
      baseUrl: undefined,
      apiKeySecret: undefined,
      activePromptId: null,
    } satisfies SystemAiConfig;
  }
}

const getCachedSystemAiConfig = cache(fetchSystemAiConfig);

async function createAiEngine(): Promise<AiEngine> {
  const settings = await getCachedSystemAiConfig();
  const normalizedProvider = settings.provider.toLowerCase();
  const runtimeConfig = Object.freeze(buildPromptRuntimeConfig(settings.runtime));

  console.info('ai.engine.configuration', {
    provider: normalizedProvider,
    model: settings.model,
    promptId: settings.activePromptId,
  });

  if (normalizedProvider === 'googleai' || normalizedProvider === 'google' || normalizedProvider === 'gemini') {
    const apiKey = settings.apiKeySecret ? getServerSecret(settings.apiKeySecret) : undefined;
    const plugins = [
      googleAI({
        apiKey,
        baseUrl: settings.baseUrl,
      }),
    ];

    const instance = genkit({
      plugins,
      model: settings.model,
    });

    return {instance, settings, modelName: settings.model, runtimeConfig};
  }

  if (isOpenAiCompatible(normalizedProvider)) {
    const secretName = settings.apiKeySecret ?? 'openrouter/apiKey';
    const apiKey = getServerSecret(secretName);
    const instance = genkit({
      model: settings.model,
    });
    await registerOpenAiCompatibleModel(instance, settings, apiKey);
    return {instance, settings, modelName: settings.model, runtimeConfig};
  }

  console.warn(
    `[AI] Unknown provider "${settings.provider}". Falling back to Google Gemini with default settings.`,
  );

  const fallbackInstance = genkit({
    plugins: [googleAI()],
    model: defaultAiSettings.model,
  });

  return {
    instance: fallbackInstance,
    settings: {
      provider: defaultAiSettings.provider,
      model: defaultAiSettings.model,
      runtime: defaultAiSettings.runtime,
      requestHeaders: defaultAiSettings.requestHeaders,
      baseUrl: undefined,
      apiKeySecret: undefined,
      activePromptId: null,
    },
    modelName: defaultAiSettings.model,
    runtimeConfig: Object.freeze(buildPromptRuntimeConfig(defaultAiSettings.runtime)),
  } satisfies AiEngine;
}

const getCachedAiEngine = cache(createAiEngine);

export async function getAiEngine(): Promise<AiEngine> {
  return getCachedAiEngine();
}

export type {AiEngine, SystemAiConfig};
