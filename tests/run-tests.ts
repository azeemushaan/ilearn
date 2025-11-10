import assert from 'node:assert/strict';
import Module from 'node:module';

const originalLoad = Module._load;
Module._load = function patchedLoad(request: string, parent: NodeModule | null, isMain: boolean) {
  if (request === 'firebase/firestore') {
    return {
      Timestamp: class MockTimestamp {
        static now() {
          return { toDate: () => new Date() };
        }
      },
    };
  }
  return originalLoad(request, parent, isMain);
};


async function testSchemas() {
  const { coachSchema, planSchema, paymentSchema, subscriptionSchema, invoiceSchema } = await import('@/lib/schemas');
  const coach = coachSchema.parse({
    displayName: 'Coach',
    email: 'coach@example.com',
    phone: null,
    brand: { name: 'Brand', logoUrl: null, color: '#ffffff' },
    plan: { tier: 'pro', seats: 5, expiresAt: null },
    settings: { locale: 'en', lowBandwidthDefault: false },
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  assert.equal(coach.plan?.tier, 'pro');

  const plan = planSchema.parse({
    name: 'pro',
    title: 'Pro',
    priceUSD: 4,
    maxStudents: 100,
    maxPlaylists: 10,
    enableQuizGeneration: true,
    enableProgressTracking: true,
    isActive: true,
    sort: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  assert(plan.enableQuizGeneration === true);

  assert.throws(() => paymentSchema.parse({
    coachId: 'coach',
    amount: 0,
    currency: 'PKR',
    method: 'manual_bank',
    status: 'bad',
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

  const subscription = subscriptionSchema.parse({
    coachId: 'coach',
    planId: 'plan',
    maxStudents: 100,
    status: 'active',
    currentPeriodEnd: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  assert.equal(subscription.status, 'active');

  const invoice = invoiceSchema.parse({
    coachId: 'coach',
    items: [{ label: 'Subscription', amount: 1000 }],
    total: 1000,
    currency: 'PKR',
    status: 'draft',
    dueAt: new Date(),
    createdAt: new Date(),
  });
  assert.equal(invoice.items[0].label, 'Subscription');
}

async function testApprovePayment() {
  const { approvePayment } = await import('@/lib/firestore/admin-ops');
  const updateMock = () => Promise.resolve();
  const getMock = () =>
    Promise.resolve({
      exists: true,
      data: () => ({ coachId: 'coach', amount: 100, currency: 'PKR', status: 'pending', method: 'manual_bank' }),
    });

  const firestoreMock = {
    collection: () => ({
      doc: () => ({ get: getMock, update: updateMock }),
      where: () => firestoreMock.collection('subscriptions'),
      orderBy: () => firestoreMock.collection('subscriptions'),
      limit: () => ({ get: async () => ({ docs: [], empty: true }) }),
      add: async () => undefined,
      get: async () => ({ docs: [], empty: true }),
    }),
  } as any;

  await approvePayment('payment', 'admin', undefined, firestoreMock, async () => undefined);
}

async function testSegmentationRules() {
  const { segmentTranscriptPhase5 } = await import('@/lib/phase5/segmentation');
  const cues = [
    { tStartSec: 0, tEndSec: 5, text: '[Music]' },
    { tStartSec: 5, tEndSec: 12, text: 'Welcome to my channel intro for today!' },
    {
      tStartSec: 12,
      tEndSec: 80,
      text: 'Artificial intelligence is the simulation of human intelligence in machines that are programmed to think like humans.',
    },
  ];

  const result = segmentTranscriptPhase5(cues, { language: 'en', videoTopic: 'Artificial Intelligence' });

  assert.equal(result.segments.length, 1, 'Should keep exactly one educational segment');
  assert(result.logs.some(log => log.includes('SEG:KEEP')), 'Should emit keep logs');
  assert(result.skipped.length >= 1, 'Should skip non-instructional cues');
  assert(!result.segments[0].text.toLowerCase().includes('welcome to my channel'), 'Intro text should be removed');
}

async function testMcqRules() {
  const { generateMcqForSegment } = await import('@/lib/phase5/mcq');
  const outcomeEmpty = generateMcqForSegment(
    {
      segmentId: 'seg-empty',
      title: 'Overview',
      text: 'Too short to assess.',
      tStartSec: 0,
      tEndSec: 5,
      language: 'en',
    },
    [],
    'en'
  );

  assert.equal(outcomeEmpty.mcqs.length, 0, 'Short segments must not produce MCQs');
  assert.equal(outcomeEmpty.reason, 'INSUFFICIENT_CONTEXT');

  const informativeText =
    'Artificial intelligence is the simulation of human intelligence in machines. These systems can learn from data.';
  const outcome = generateMcqForSegment(
    {
      segmentId: 'seg-ai',
      title: 'AI Basics',
      text: informativeText,
      tStartSec: 0,
      tEndSec: 60,
      language: 'en',
    },
    [],
    'en'
  );

  assert.equal(outcome.mcqs.length, 1, 'Assessable segments should yield one MCQ');
  assert(outcome.mcqs[0]?.support?.length, 'MCQ must include supporting lines');

  const duplicateOutcome = generateMcqForSegment(
    {
      segmentId: 'seg-ai-dup',
      title: 'AI Basics',
      text: 'Artificial intelligence is the simulation of human intelligence in machines with algorithms.',
      tStartSec: 70,
      tEndSec: 130,
      language: 'en',
    },
    outcome.mcqs.map(mcq => mcq.stem),
    'en'
  );

  assert.equal(duplicateOutcome.mcqs.length, 0, 'Duplicate stems should be dropped');
  assert.equal(duplicateOutcome.reason, 'DUPLICATE');
}

async function main() {
  await testSchemas();
  await testApprovePayment();
  await testSegmentationRules();
  await testMcqRules();
  Module._load = originalLoad;
  console.log('All tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
