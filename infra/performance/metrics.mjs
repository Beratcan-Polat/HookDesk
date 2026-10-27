export function distribution(values) {
  const sorted = values.filter((value) => Number.isFinite(value)).toSorted((a, b) => a - b)
  if (!sorted.length)
    return { count: 0, min: null, mean: null, p50: null, p95: null, p99: null, max: null }
  const round = (value) => Math.round(value * 100) / 100
  const percentile = (p) => round(sorted[Math.ceil(sorted.length * p) - 1])
  return {
    count: sorted.length,
    min: round(sorted[0]),
    mean: round(sorted.reduce((a, b) => a + b, 0) / sorted.length),
    p50: percentile(0.5),
    p95: percentile(0.95),
    p99: percentile(0.99),
    max: round(sorted.at(-1)),
  }
}
export function memoryBytes(value) {
  const match = value.trim().match(/^([\d.]+)\s*(B|KiB|MiB|GiB|kB|MB|GB)$/)
  if (!match) throw new Error('Unrecognized Docker memory unit.')
  return Math.round(
    Number(match[1]) *
      { B: 1, KiB: 1024, MiB: 1024 ** 2, GiB: 1024 ** 3, kB: 1000, MB: 1000 ** 2, GB: 1000 ** 3 }[
        match[2]
      ],
  )
}
export function verifyDelivery(metrics, count) {
  const checks = {
    events: metrics.events === count,
    usage: metrics.usage === count,
    deliveries: metrics.deliveries === count,
    succeeded: Number(metrics.statuses.succeeded || 0) === count,
    attempts: metrics.attempts === count,
    receiverRequests: metrics.receiver_requests === count,
    signedReceipts: metrics.processed_receipts === count && metrics.receipts === count,
  }
  return { passed: Object.values(checks).every(Boolean), checks }
}
