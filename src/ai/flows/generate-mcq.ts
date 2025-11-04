'use server';

import {
  generateMcq as internalGenerateMcq,
  type GenerateMcqInput,
  type GenerateMcqOutput,
} from './internal/generate-mcq-flow';

export type {GenerateMcqInput, GenerateMcqOutput} from './internal/generate-mcq-flow';

export async function generateMcq(
  input: GenerateMcqInput,
): Promise<GenerateMcqOutput> {
  return internalGenerateMcq(input);
}
