import { test } from 'node:test'
import assert from 'node:assert/strict'
import { distribution, memoryBytes, verifyDelivery } from './metrics.mjs'

test('nearest-rank percentiles preserve input, distinguish missing data and include the tail', () => {
  const input = Array.from({ length: 20 }, (_, i) => 20 - i)
  assert.deepEqual(distribution(input), {
    count: 20,
    min: 1,
    mean: 10.5,
    p50: 10,
    p95: 19,
    p99: 20,
    max: 20,
  })
  assert.equal(input[0], 20)
  assert.equal(distribution([]).p95, null)
  assert.equal(distribution([0, NaN, Infinity]).p95, 0)
})
test('Docker memory units distinguish binary and decimal quantities', () => {
  assert.equal(memoryBytes('1.5GiB'), 1610612736)
  assert.equal(memoryBytes('128MiB'), 134217728)
  assert.equal(memoryBytes('2MB'), 2000000)
  assert.throws(() => memoryBytes('unknown'))
})
test('delivery validation detects loss, duplicates, retries and inflated quota counters', () => {
  const good = {
    events: 2,
    usage: 2,
    deliveries: 2,
    statuses: { succeeded: 2 },
    attempts: 2,
    receiver_requests: 2,
    receipts: 2,
    processed_receipts: 2,
  }
  assert.equal(verifyDelivery(good, 2).passed, true)
  for (const key of [
    'events',
    'usage',
    'deliveries',
    'attempts',
    'receiver_requests',
    'receipts',
    'processed_receipts',
  ]) {
    assert.equal(verifyDelivery({ ...good, [key]: 3 }, 2).passed, false)
  }
  assert.equal(verifyDelivery({ ...good, statuses: { pending: 2 } }, 2).passed, false)
})
