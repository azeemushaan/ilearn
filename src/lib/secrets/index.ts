const SERVER_ONLY_ERROR = 'Secrets can only be accessed from the server runtime.';

function assertServerRuntime() {
  if (typeof window !== 'undefined') {
    throw new Error(SERVER_ONLY_ERROR);
  }
}

function possibleKeys(secretName: string): string[] {
  const keys = new Set<string>();
  const trimmed = secretName.trim();
  if (trimmed.length === 0) {
    return [];
  }

  keys.add(trimmed);

  if (trimmed.includes('/')) {
    const segments = trimmed.split('/').filter(Boolean);
    const last = segments.at(-1);
    if (last) {
      keys.add(last);
    }
  }

  const normalized = trimmed
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/__+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();

  if (normalized) {
    keys.add(normalized);
  }

  return Array.from(keys);
}

export function getServerSecret(secretName: string): string {
  assertServerRuntime();
  if (!secretName) {
    throw new Error('A secret name must be provided.');
  }

  for (const key of possibleKeys(secretName)) {
    const value = process.env[key];
    if (value && value.length > 0) {
      return value;
    }
  }

  throw new Error(
    `Secret "${secretName}" is not available in the server environment. ` +
      'Configure it using Cloud Functions config, Firebase Secrets Manager, or environment variables.'
  );
}
