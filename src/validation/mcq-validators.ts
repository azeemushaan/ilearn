// src/validation/mcq-validators.ts

import { MCQVersioned, Segment } from "../types/video";

export function supportWithinSegment(mcq: MCQVersioned, seg: Segment): boolean {
  return mcq.support.every(s =>
    s.tStartSec >= seg.tStartSec &&
    s.tEndSec <= seg.tEndSec &&
    s.tEndSec > s.tStartSec
  );
}

// Inject a cosine similarity function of your embedding service
export async function isDuplicateMCQ(
  mcq: MCQVersioned,
  existing: MCQVersioned[],
  cosine: (a:number[], b:number[])=>number,
  embed: (text:string)=>Promise<number[]>,
  threshold = 0.90
): Promise<boolean> {
  const text = `${mcq.stem} :: ${mcq.options.map(o=>o.text).join(" | ")}`;
  const vec = mcq.dedupVector ?? await embed(text);

  for (const e of existing) {
    const v2 = e.dedupVector ?? await embed(`${e.stem} :: ${e.options.map(o=>o.text).join(" | ")}`);
    if (cosine(vec, v2) > threshold) return true;
  }

  return false;
}
