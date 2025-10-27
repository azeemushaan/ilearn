import { config } from 'dotenv';
config();

import '@/ai/flows/anti-skip-measures.ts';
import '@/ai/flows/generate-mcq.ts';
import '@/ai/flows/prepare-video-content.ts';
import '@/ai/flows/set-user-claims.ts';
