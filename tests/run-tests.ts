import assert from 'node:assert/strict';
import { coachSchema, planSchema, paymentSchema, subscriptionSchema, invoiceSchema } from '@/lib/schemas';
import { approvePayment } from '@/lib/firestore/admin-ops';

async function testSchemas() {
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
  assert.equal(coach.plan.tier, 'pro');

  const plan = planSchema.parse({
    title: 'Pro',
    tier: 'pro',
    pricePKR: 1000,
    priceUSD: null,
    seatLimit: 10,
    features: ['feature'],
    isActive: true,
    sort: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  assert(plan.features.length === 1);

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
    tier: 'pro',
    seatLimit: 5,
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

async function main() {
  await testSchemas();
  await testApprovePayment();
  console.log('All tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
