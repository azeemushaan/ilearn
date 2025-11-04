import { config } from 'dotenv';
config();

import '@/ai/flows/anti-skip-measures.ts';
import '@/ai/flows/internal/generate-mcq-flow';
import '@/ai/flows/prepare-video-content.ts';
import '@/ai/flows/set-user-claims.ts';
