// src/schemas/mcq.ts

import { z } from "zod";

export const zID = () => z.string().min(1);

export const zTimeRange = z.object({
  tStartSec: z.number().nonnegative(),
  tEndSec: z.number().positive()
}).refine(v => v.tEndSec > v.tStartSec, "tEndSec must be > tStartSec");

export const zSupportLine = z.object({
  tStartSec: z.number().nonnegative(),
  tEndSec: z.number().positive(),
  text: z.string().trim().min(1)
}).refine(v => v.tEndSec > v.tStartSec, { message: "support line ends before it starts" });

export const zISO639_1 = z.string().min(2).max(10);

export const zMCQOption = z.object({
  id: zID(),
  text: z.string().trim().min(1).max(120)
});

export const zMCQState = z.enum(["draft","published","locked"]);

export const zMCQVersioned = z.object({
  mcqId: zID(),
  version: z.number().int().positive(),
  state: zMCQState,
  segmentId: zID(),
  videoId: zID(),
  language: zISO639_1,
  stem: z.string().trim().min(10).max(220),
  options: z.array(zMCQOption).min(2).max(4),
  correctIndex: z.number().int().min(0),
  rationale: z.string().trim().max(240).optional(),
  support: z.array(zSupportLine).min(1),
  difficulty: z.enum(["Easy","Medium","Hard"]).optional(),
  createdBy: zID(),
  updatedBy: zID(),
  createdAt: z.string(),
  updatedAt: z.string(),
  publishedAt: z.string().optional(),
  dedupVector: z.array(z.number()).optional()
})
.superRefine((v, ctx) => {
  // exactly one correct index within options
  if (v.correctIndex < 0 || v.correctIndex >= v.options.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "correctIndex out of range", path: ["correctIndex"] });
  }

  // unique, non-empty options (case/trim-insensitive)
  const norm = (s:string)=>s.trim().toLowerCase();
  const seen = new Set<string>();
  v.options.forEach((o, i) => {
    const k = norm(o.text);
    if (seen.has(k)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "duplicate option", path: ["options", i, "text"] });
    }
    seen.add(k);
  });

  // support lines should be inside a plausible segment window (caller must pass segment bounds)
  // You can enforce here by passing bounds via context; otherwise validate later on server.

  // minimum total support chars ~40 (robust grounding)
  const totalChars = v.support.reduce((s, l) => s + l.text.trim().length, 0);
  if (totalChars < 40) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "insufficient support text (<40 chars)", path: ["support"] });
  }
});

export const zSegment = z.object({
  segmentId: zID(),
  videoId: zID(),
  title: z.string().trim().min(1).max(60), // 1–5 words typically
  language: zISO639_1,
  tStartSec: z.number().nonnegative(),
  tEndSec: z.number().positive(),
  text: z.string().trim().min(40) // your hard rule
}).refine(v => v.tEndSec > v.tStartSec, "tEndSec must be > tEndSec");

export const zManifestV2 = z.object({
  videoId: zID(),
  version: z.number().int().positive(),
  segments: z.array(z.object({
    segmentId: zID(),
    title: z.string().trim().min(1),
    tStartSec: z.number().nonnegative(),
    tEndSec: z.number().positive(),
    questions: z.array(z.object({
      mcqId: zID(),
      version: z.number().int().positive(),
      language: zISO639_1,
      stem: z.string(),
      options: z.array(z.string()).min(2).max(4),
      correctIndex: z.number().int().min(0),
      rationale: z.string().optional()
    })).max(1) // 0 or 1
  }))
});
