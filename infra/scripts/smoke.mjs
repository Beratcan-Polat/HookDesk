import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const base = new URL(process.env.SMOKE_URL || 'http://localhost:8080')
const mailpit = new URL(process.env.MAILPIT_URL || 'http://localhost:8025')
for (const url of [base, mailpit]) {
  assert(
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname),
    'Use a local development stack.',
  )
}
const cookies = new Map()
const recovery = process.argv.includes('--recovery')
const run = promisify(execFile)
const docker =
  process.env.DOCKER_BIN ||
  (process.platform === 'win32'
    ? [
        join(process.env.LOCALAPPDATA || '', 'Programs/DockerDesktop/resources/bin/docker.exe'),
        join(process.env.ProgramFiles || '', 'Docker/Docker/resources/bin/docker.exe'),
      ].find(existsSync) || 'docker'
    : 'docker')
async function compose(...args) {
  return run(docker, ['compose', ...args], {
    cwd: fileURLToPath(new URL('../../', import.meta.url)),
    timeout: 45000,
  })
}
const email = `smoke-${randomUUID()}@hookdesk.test`
const password = `Smoke9!${randomBytes(24).toString('hex')}`
let workspace
let key
let keyId
let project
let verified = false

async function request(path, { method = 'GET', body, token, headers = {}, status = 200 } = {}) {
  const url = new URL(path, base)
  assert.equal(url.origin, base.origin, 'Requests must stay on the configured application origin.')
  const response = await fetch(url, {
    method,
    redirect: 'manual',
    signal: AbortSignal.timeout(15000),
    headers: {
      Accept: 'application/json',
      ...(token
        ? { Authorization: `Bearer ${token}` }
        : {
            Origin: base.origin,
            Referer: base.href,
            Cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join('; '),
            'X-XSRF-TOKEN': decodeURIComponent(cookies.get('XSRF-TOKEN') || ''),
          }),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!token) {
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';', 1)[0]
      const separator = pair.indexOf('=')
      cookies.set(pair.slice(0, separator), pair.slice(separator + 1))
    }
  }
  // Do not include response bodies: credential creation responses contain one-time secrets.
  const safePath = url.pathname.replace(/^\/ingest\/[^/]+$/, '/ingest/[redacted]')
  assert.equal(
    response.status,
    status,
    `${method} ${safePath}: expected ${status}, got ${response.status}`,
  )
  const text = await response.text()
  return {
    body:
      text && response.headers.get('content-type')?.includes('application/json')
        ? JSON.parse(text)
        : null,
    headers: response.headers,
  }
}

async function waitFor(label, probe, seconds = 30, interval = 1000) {
  const deadline = Date.now() + seconds * 1000
  while (Date.now() < deadline) {
    const result = await probe()
    if (result) return result
    await sleep(interval)
  }
  throw new Error(`Timed out waiting for ${label}.`)
}

async function delivered(eventId) {
  return waitFor(
    'a signed webhook delivery',
    async () => {
      const { body } = await request(`/api/v1/events/${eventId}/deliveries`, { token: key })
      assert.equal(body.data.length, 1)
      const delivery = body.data[0]
      assert(
        !['failed', 'cancelled'].includes(delivery.status),
        `Delivery ended with ${delivery.status}: ${delivery.last_error}`,
      )
      return delivery.status === 'succeeded' && delivery
    },
    150,
    5000,
  )
}

try {
  await request('/up')
  await request('/api/ready')
  await request('/receive/not-a-public-route', { method: 'POST', status: 404 })
  console.log('PASS: application readiness and private receiver boundary')

  await request('/sanctum/csrf-cookie', { status: 204 })
  await request('/register', {
    method: 'POST',
    status: 201,
    body: {
      name: 'Docker smoke test',
      email,
      password,
      password_confirmation: password,
      locale: 'en',
    },
  })
  await request('/api/dashboard/v1/workspaces', {
    method: 'POST',
    body: { name: 'Unverified' },
    status: 403,
  })
  const message = await waitFor('the verification email in Mailpit', async () => {
    const response = await fetch(new URL('/api/v1/messages', mailpit), {
      signal: AbortSignal.timeout(10000),
    })
    assert(response.ok, 'Mailpit message API is unavailable.')
    return (await response.json()).messages.find((item) =>
      item.To?.some((recipient) => recipient.Address === email),
    )
  })
  const emailResponse = await fetch(new URL(`/api/v1/message/${message.ID}`, mailpit), {
    signal: AbortSignal.timeout(10000),
  })
  assert(emailResponse.ok, 'Mailpit could not return the verification email.')
  const emailBody = await emailResponse.json()
  const verification = emailBody.Text.match(/https?:\/\/[^\s<>]*\/email\/verify\/[^\s<>]+/)?.[0]
  assert(verification, 'Verification link was not found in the email.')
  await request(verification, { status: 302, headers: { Accept: 'text/html' } })
  assert(
    (await request('/api/me')).body.data.email_verified_at,
    'Email verification was not persisted.',
  )
  verified = true
  console.log('PASS: registration, CSRF session, SMTP and signed email verification')

  workspace = (
    await request('/api/dashboard/v1/workspaces', {
      method: 'POST',
      status: 201,
      body: { name: 'Docker smoke test' },
    })
  ).body.data.id
  project = (
    await request(`/api/dashboard/v1/workspaces/${workspace}/projects`, {
      method: 'POST',
      status: 201,
      body: { name: 'Delivery smoke test' },
    })
  ).body.data.id
  const endpoint = (
    await request(`/api/dashboard/v1/projects/${project}/endpoints`, {
      method: 'POST',
      status: 201,
      body: {
        name: 'Signed receiver',
        kind: 'sandbox',
        sandbox_behavior: 'fail_twice',
        subscriptions: ['*'],
      },
    })
  ).body.data.id
  const credential = (
    await request(`/api/dashboard/v1/projects/${project}/keys`, {
      method: 'POST',
      status: 201,
      body: { name: 'Smoke test', abilities: ['events:write', 'events:read'] },
    })
  ).body
  key = credential.token
  keyId = credential.data.id

  const payload = { type: 'smoke.created', data: { run_id: randomUUID() } }
  const headers = { 'Idempotency-Key': randomUUID() }
  const accepted = await request('/api/v1/events', {
    method: 'POST',
    status: 202,
    token: key,
    headers,
    body: payload,
  })
  assert.equal(accepted.body.data.delivery_count, 1)
  const duplicate = await request('/api/v1/events', {
    method: 'POST',
    status: 202,
    token: key,
    headers,
    body: payload,
  })
  assert.equal(duplicate.body.data.id, accepted.body.data.id)
  assert.equal(duplicate.headers.get('idempotency-replayed'), 'true')
  await request('/api/v1/events', {
    method: 'POST',
    status: 409,
    token: key,
    headers,
    body: { ...payload, data: { changed: true } },
  })
  assert.equal(
    (await request(`/api/dashboard/v1/workspaces/${workspace}/summary`)).body.data.events,
    1,
  )
  console.log('PASS: API key authentication, durable acceptance and idempotency')

  const delivery = await delivered(accepted.body.data.id)
  const detail = (await request(`/api/dashboard/v1/deliveries/${delivery.id}`)).body.data
  assert.deepEqual(
    detail.attempts.sort((a, b) => a.number - b.number).map((attempt) => attempt.http_status),
    [500, 500, 200],
  )
  console.log('PASS: Redis worker, scheduler, HMAC receiver and timed 500 → 500 → 200 retries')

  await request(`/api/dashboard/v1/endpoints/${endpoint}`, {
    method: 'PATCH',
    body: { sandbox_behavior: 'success' },
  })
  const replay = (
    await request(`/api/dashboard/v1/deliveries/${delivery.id}/replay`, {
      method: 'POST',
      status: 202,
    })
  ).body.data
  assert.notEqual(replay.id, delivery.id)
  const replayDetail = await waitFor('the replay', async () => {
    const data = (await request(`/api/dashboard/v1/deliveries/${replay.id}`)).body.data
    assert(!['failed', 'cancelled'].includes(data.status), 'Replay failed.')
    return data.status === 'succeeded' && data
  })
  const receipt = (
    await request(`/api/dashboard/v1/attempts/${replayDetail.attempts[0].id}/response`)
  ).body
  assert.equal(JSON.parse(receipt.body).duplicate, true)
  console.log('PASS: manual replay keeps the event identity and receiver deduplication')

  const source = (
    await request(`/api/dashboard/v1/projects/${project}/sources`, {
      method: 'POST',
      status: 201,
      body: { name: 'Smoke source', event_type: 'source.received', mode: 'capture_only' },
    })
  ).body
  const capture = (
    await request(source.url, { method: 'POST', status: 202, body: { captured: true } })
  ).body.data
  assert.equal(capture.delivery_count, 0)
  await request(`/api/dashboard/v1/sources/${source.data.id}`, {
    method: 'PATCH',
    body: { mode: 'capture_and_forward' },
  })
  const forwarded = (
    await request(source.url, { method: 'POST', status: 202, body: { forwarded: true } })
  ).body.data
  assert.equal(forwarded.delivery_count, 1)
  await delivered(forwarded.id)
  console.log('PASS: incoming webhook capture and forwarding')

  if (recovery) {
    const { stdout } = await compose('port', 'gateway', '80')
    assert(
      stdout.trim().endsWith(`:${base.port}`),
      'Recovery must target this Compose stack gateway.',
    )
    let queued
    try {
      await compose('stop', 'worker')
      queued = (
        await request('/api/v1/events', {
          method: 'POST',
          status: 202,
          token: key,
          body: { type: 'smoke.recovery', data: { run_id: randomUUID() } },
        })
      ).body.data.id
      const pending = (await request(`/api/v1/events/${queued}/deliveries`, { token: key })).body
        .data[0]
      assert.equal(pending.status, 'pending')
      assert.equal(pending.attempt_count, 0)
      await compose('restart', 'redis')
      await waitFor('Redis readiness after restart', async () => {
        try {
          return (await request('/api/ready')).body.status === 'ok'
        } catch {
          return false
        }
      })
    } finally {
      await compose('start', 'worker')
    }
    await delivered(queued)
    console.log('PASS: an accepted event survives worker downtime and a Redis restart')
  }
} catch (error) {
  console.error(`FAIL: ${error.message}`)
  process.exitCode = 1
} finally {
  // Leave history for inspection, but disable credentials and archive this run's workspace.
  try {
    if (keyId) await request(`/api/dashboard/v1/keys/${keyId}`, { method: 'DELETE', status: 204 })
    if (workspace)
      await request(`/api/dashboard/v1/workspaces/${workspace}/archive`, {
        method: 'POST',
        status: 204,
      })
    if (verified)
      await request('/api/dashboard/v1/account', {
        method: 'DELETE',
        status: 204,
        body: { password },
      })
  } catch (error) {
    console.error(`Cleanup failed: ${error.message}`)
    process.exitCode = 1
  }
}
