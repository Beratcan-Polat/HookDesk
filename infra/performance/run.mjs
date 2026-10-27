import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, open, readFile, writeFile, unlink } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { setTimeout as sleep } from 'node:timers/promises'
import { distribution, memoryBytes, verifyDelivery } from './metrics.mjs'
import { renderReport } from './report.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const execute = promisify(execFile)
const smoke = process.argv.includes('--smoke')
const keep = process.argv.includes('--keep')
for (const flag of process.argv.slice(2))
  assert(['--smoke', '--keep', '--no-build'].includes(flag), 'Unknown load-test option.')
const stop = new AbortController()
process.once('SIGINT', () => stop.abort())
process.once('SIGTERM', () => stop.abort())
const id = 'load-' + randomUUID()
const directory = join(root, '.runtime', 'performance', id)
const docker =
  process.env.DOCKER_BIN ||
  (process.platform === 'win32'
    ? [
        join(process.env.LOCALAPPDATA || '', 'Programs/DockerDesktop/resources/bin/docker.exe'),
        join(process.env.ProgramFiles || '', 'Docker/Docker/resources/bin/docker.exe'),
      ].find(existsSync) || 'docker'
    : 'docker')
const childEnvironment = {
  ...process.env,
  PATH: dirname(docker) + (process.platform === 'win32' ? ';' : ':') + process.env.PATH,
}
const composeArgs = ['compose', '-p', 'hookdesk-load', '-f', 'infra/performance/compose.yaml']
const base = 'http://127.0.0.1:8081'
const report = {
  schema: 1,
  run: id,
  started_at: new Date().toISOString(),
  profile: smoke ? 'smoke' : 'baseline',
  environment: {},
  policy: null,
  phases: [],
  resources: [],
  errors: [],
  measurement: {
    api_clock: 'client monotonic performance.now()',
    percentiles: 'nearest rank',
    database_time_resolution_ms: 1000,
    receiver: 'internal Caddy + PHP-FPM, actual HMAC verification and PostgreSQL receipt',
    payload_padding_bytes: 1024,
    resource_sampling_seconds: 5,
    acceptance_p95_budget_ms: 5000,
    drain_timeout_seconds: 180,
  },
}
let started = false
let sampling = false
let sampler
let containers = []
let lock

async function command(args, timeout = 60000) {
  try {
    return (
      await execute(docker, args, {
        cwd: root,
        env: childEnvironment,
        timeout,
        maxBuffer: 8 * 1024 * 1024,
      })
    ).stdout.trim()
  } catch (error) {
    // Child output can include fixture credentials. Never echo it or an exec error object.
    throw new Error(
      `Docker operation failed (${args[0]} ${args[1] || ''}); exit ${error.code || 'timeout'}.`,
    )
  }
}
const compose = (...args) => command([...composeArgs, ...args])
async function fixture(action, scope, mode = '') {
  return JSON.parse(
    await compose('exec', '-T', 'app', 'php', 'tests/Support/performance.php', action, scope, mode),
  )
}
async function refreshContainers() {
  containers = (await compose('ps', '-q')).split(/\r?\n/).filter(Boolean)
  assert(containers.length > 0, 'No load containers are running.')
}
async function sample() {
  try {
    const rows = (
      await command(['stats', '--no-stream', '--format', '{{json .}}', ...containers], 15000)
    )
      .split(/\r?\n/)
      .filter(Boolean)
      .map(JSON.parse)
    report.resources.push({
      at: new Date().toISOString(),
      containers: rows.map((row) => ({
        name: row.Name,
        cpu_percent: Number(row.CPUPerc.replace('%', '')),
        memory_bytes: memoryBytes(row.MemUsage.split('/')[0]),
      })),
    })
  } catch {
    report.errors.push('Resource sample unavailable.')
  }
}
async function request(account, raw, key) {
  assert(!stop.signal.aborted, 'Load test interrupted.')
  const begin = performance.now()
  try {
    const response = await fetch(base + '/api/v1/events', {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.any([AbortSignal.timeout(15000), stop.signal]),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + account.token,
        'Idempotency-Key': key,
      },
      body: raw,
    })
    const body = await response.json()
    return {
      status: response.status,
      ms: performance.now() - begin,
      event: body.data?.id,
      delivery_count: body.data?.delivery_count,
      retry_after: Number(response.headers.get('retry-after') || 0),
    }
  } catch {
    return { status: 0, ms: performance.now() - begin }
  }
}
async function burst(count, concurrency, callback) {
  let next = 0
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (next < count) {
        const sequence = next++
        await callback(sequence)
      }
    }),
  )
}
async function drain(account, count) {
  const begin = performance.now()
  let largestPending = 0
  while (performance.now() - begin < report.measurement.drain_timeout_seconds * 1000) {
    assert(!stop.signal.aborted, 'Load test interrupted.')
    const state = await fixture('snapshot', account.project_id)
    const pending = ['pending', 'processing', 'retrying'].reduce(
      (sum, key) => sum + Number(state.statuses[key] || 0),
      0,
    )
    largestPending = Math.max(largestPending, pending)
    if (!pending && state.deliveries === count) {
      const metrics = await fixture('metrics', account.project_id)
      return {
        metrics,
        drain_after_requests_ms: performance.now() - begin,
        sampled_pending_max_after_requests: largestPending,
      }
    }
    await sleep(1000)
  }
  throw new Error('Delivery drain exceeded the configured deadline.')
}
async function phase(name, count, concurrency, { rate = 0, workers = 1, duplicate = false } = {}) {
  assert(!stop.signal.aborted, 'Load test interrupted.')
  const account = await fixture('seed', id + '-' + name, 'capacity')
  const results = []
  let dropped = 0
  const beginning = performance.now()
  let lastResponseAt = beginning
  const issue = async (sequence) => {
    const raw = JSON.stringify({
      type: 'load.accepted',
      data: { run: id, sequence: duplicate ? 0 : sequence, padding: 'x'.repeat(1024) },
    })
    results.push(await request(account, raw, id + '-' + name + '-' + (duplicate ? 0 : sequence)))
    lastResponseAt = performance.now()
  }
  if (rate) {
    const running = new Set()
    for (let sequence = 0; sequence < count; sequence++) {
      await sleep(Math.max(0, beginning + (sequence * 1000) / rate - performance.now()))
      if (running.size >= concurrency) {
        dropped++
        continue
      }
      const pending = issue(sequence).finally(() => running.delete(pending))
      running.add(pending)
    }
    await Promise.all(running)
  } else await burst(count, concurrency, issue)
  const acceptanceElapsed = performance.now() - beginning
  const accepted = results.filter(
    (result) => result.status === 202 && result.event && result.delivery_count === 1,
  )
  const expected = duplicate ? 1 : accepted.length
  const drained = await drain(account, expected)
  const verified = verifyDelivery(drained.metrics, duplicate ? 1 : count)
  const statusCounts = {}
  for (const result of results) statusCounts[result.status] = (statusCounts[result.status] || 0) + 1
  const api = distribution(results.map((result) => result.ms))
  const outcome = {
    name,
    workers,
    model: rate ? 'bounded constant arrival' : 'closed-loop burst',
    concurrency,
    offered_rate_per_second: rate || null,
    offered: count,
    started: results.length,
    dropped,
    accepted: accepted.length,
    unexpected_response_count: results.length - accepted.length,
    unexpected_response_rate: results.length
      ? (results.length - accepted.length) / results.length
      : 0,
    unique_response_ids: new Set(accepted.map((result) => result.event)).size,
    status_counts: statusCounts,
    acceptance_ms: api,
    acceptance_elapsed_ms: Math.round(acceptanceElapsed),
    observed_request_rate_per_second: Number(
      ((results.length * 1000) / acceptanceElapsed).toFixed(2),
    ),
    ...drained,
    metrics: {
      ...drained.metrics,
      http_ms: distribution(drained.metrics.http_ms.map(Number)),
      queue_ms: distribution(drained.metrics.queue_ms.map(Number)),
      delivery_ms: distribution(drained.metrics.delivery_ms.map(Number)),
    },
    delivery_rate_from_first_request_per_second: Number(
      ((expected * 1000) / (performance.now() - beginning)).toFixed(2),
    ),
    last_response_offset_ms: Math.round(lastResponseAt - beginning),
    limits: account.limits,
    passed:
      verified.passed &&
      accepted.length === count &&
      new Set(accepted.map((result) => result.event)).size === expected &&
      dropped === 0 &&
      api.p95 <= report.measurement.acceptance_p95_budget_ms,
    checks: verified.checks,
  }
  report.phases.push(outcome)
  console.log(
    `${outcome.passed ? 'PASS' : 'FAIL'} ${name}: ${accepted.length}/${count}, API p95 ${api.p95}ms, observed ${outcome.observed_request_rate_per_second} requests/s, delivery p95 ${outcome.metrics.delivery_ms.p95}ms`,
  )
  assert(outcome.passed, `Phase ${name} did not meet correctness or latency budgets.`)
}
async function policy() {
  const account = await fixture('seed', id + '-policy', 'default')
  const results = []
  const issue = async (sequence) => {
    results.push(
      await request(
        account,
        JSON.stringify({ type: 'load.unmatched', data: { sequence } }),
        id + '-policy-' + sequence,
      ),
    )
  }
  for (let sequence = 0; sequence < 25; sequence++) await issue(sequence)
  await burst(10, 10, (sequence) => issue(sequence + 25))
  const accepted = results.filter((r) => r.status === 202)
  const limited = results.filter((r) => r.status === 429 && r.retry_after > 0)
  const response = await fetch(`${base}/api/v1/events/${accepted[0]?.event}`, {
    headers: { Accept: 'application/json', Authorization: 'Bearer ' + account.token },
    signal: AbortSignal.timeout(15000),
  })
  await response.arrayBuffer()
  const metrics = await fixture('snapshot', account.project_id)
  report.policy = {
    requests: 35,
    boundary_concurrency: 10,
    accepted: accepted.length,
    rate_limited: limited.length,
    read_after_limit_status: response.status,
    metrics,
    limits: account.limits,
    passed:
      accepted.length === 30 &&
      limited.length === 5 &&
      response.status === 200 &&
      metrics.events === 30 &&
      metrics.usage === 30 &&
      metrics.deliveries === 0,
  }
  assert(report.policy.passed, 'Default acceptance policy did not match the expected limit.')
  console.log('PASS policy: 30 accepted, 5 rate-limited; event reads remain available.')
}

await mkdir(join(root, '.runtime'), { recursive: true })
try {
  lock = await open(join(root, '.runtime', 'performance.lock'), 'wx')
  assert.equal(
    await compose('ps', '-q'),
    '',
    'An isolated load stack already exists; inspect it before starting a fresh run.',
  )
  await mkdir(directory, { recursive: true })
  const info = JSON.parse(await command(['info', '--format', '{{json .}}']))
  report.environment = {
    docker: info.ServerVersion,
    docker_cpu_count: info.NCPU,
    docker_memory_bytes: info.MemTotal,
    platform: process.platform,
    node: process.version,
    development_stack_running: !!(await command([
      'ps',
      '-q',
      '--filter',
      'label=com.docker.compose.project=hookdesk',
    ])),
    app_debug: false,
    code_mount: 'image (no application source bind)',
    php_fpm_max_children: 5,
    receiver_fpm_max_children: 5,
  }
  report.environment.revision = (
    await execute('git', ['rev-parse', 'HEAD'], { cwd: root })
  ).stdout.trim()
  const harness = createHash('sha256')
  for (const path of [
    'infra/performance/run.mjs',
    'infra/performance/metrics.mjs',
    'infra/performance/compose.yaml',
    'infra/performance/Caddyfile',
    'backend/tests/Support/performance.php',
  ])
    harness.update(path + '\0').update(await readFile(join(root, path)))
  report.environment.harness_sha256 = harness.digest('hex')
  if (!process.argv.includes('--no-build')) {
    console.log('Building the isolated load-test image...')
    await command([...composeArgs, 'build', 'app'], 600000)
  }
  started = true
  await compose('up', '-d', '--wait', 'postgres', 'redis')
  await compose('run', '--rm', '--no-deps', 'app', 'php', 'artisan', 'migrate', '--force')
  await command(
    [...composeArgs, 'up', '-d', '--no-build', '--wait', '--wait-timeout', '120'],
    180000,
  )
  const ready = await fetch(base + '/api/ready', { signal: AbortSignal.timeout(10000) })
  assert.equal(ready.status, 200)
  await ready.arrayBuffer()
  report.environment.php = (
    await compose('exec', '-T', 'app', 'php', '-r', 'echo PHP_VERSION;')
  ).trim()
  const fixtureHash = createHash('sha256')
    .update(await readFile(join(root, 'backend/tests/Support/performance.php')))
    .digest('hex')
  const imageFixtureHash = await compose(
    'exec',
    '-T',
    'app',
    'php',
    '-r',
    "echo hash_file('sha256', 'tests/Support/performance.php');",
  )
  assert.equal(
    imageFixtureHash,
    fixtureHash,
    'The fixture image is stale; rebuild without --no-build.',
  )
  await refreshContainers()
  sampling = true
  sampler = (async () => {
    while (sampling) {
      const begin = performance.now()
      await sample()
      if (sampling) await sleep(Math.max(0, 5000 - (performance.now() - begin)))
    }
  })()
  await policy()
  await phase('warmup', smoke ? 5 : 20, 2)
  await phase('idempotency', 16, 8, { duplicate: true })
  await phase('burst-1', smoke ? 10 : 40, 1)
  await phase('burst-5', smoke ? 20 : 100, 5)
  if (!smoke) {
    await phase('burst-10', 100, 10)
    await phase('sustained-60s', 300, 10, { rate: 5 })
    await compose('up', '-d', '--no-build', '--no-deps', '--scale', 'worker=3', 'worker')
    await refreshContainers()
    await phase('burst-10-workers-3', 100, 10, { workers: 3 })
  }
  report.passed = true
} catch (error) {
  report.passed = false
  report.errors.push(error.message)
  console.error('FAIL:', error.message)
  process.exitCode = 1
} finally {
  sampling = false
  if (sampler) await sampler
  report.finished_at = new Date().toISOString()
  if (started) {
    report.environment.image_id = await command([
      'image',
      'inspect',
      'hookdesk-load:local',
      '--format',
      '{{.Id}}',
    ]).catch(() => 'unavailable')
    await writeFile(join(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n')
    await writeFile(join(directory, 'report.html'), renderReport(report))
    console.log('Report:', join(directory, 'report.json'))
    if (!keep)
      await command([...composeArgs, 'down', '--volumes', '--remove-orphans'], 120000).catch(() => {
        console.error('Load stack cleanup failed; inspect hookdesk-load.')
        process.exitCode = 1
      })
  }
  if (lock) {
    await lock.close()
    await unlink(join(root, '.runtime', 'performance.lock'))
  }
}
