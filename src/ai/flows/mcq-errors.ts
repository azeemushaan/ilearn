/**
 * @fileOverview Error classes for MCQ generation flows.
 */

export class McqGenerationError extends Error {
  public readonly metadata: Record<string, unknown>;

  constructor(message: string, metadata: Record<string, unknown> = {}) {
    super(message);
    this.name = 'McqGenerationError';
    this.metadata = metadata;
  }
}
