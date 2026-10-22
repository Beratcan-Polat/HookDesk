import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { expect, type Page } from '@playwright/test'

export interface OperationsFixture {
  workspace_id: string
  workspace_name: string
  owner_id: string
  target_id: string
  target_name: string
  unverified_name: string
  failed_ids: string[]
  succeeded_id: string
}
let lastUsedCode = ''
export function readAdminFixture() {
  return JSON.parse(readFileSync(process.env.E2E_ADMIN_FILE!, 'utf8').replace(/^\uFEFF/, '')) as {
    email: string
    password: string
    secret: string
    user_id: string
    workspace_id: string
    operations: Record<'en' | 'tr', OperationsFixture>
  }
}
export function totp(secret: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const bits = [...secret.toUpperCase()]
    .map((char) => alphabet.indexOf(char).toString(2).padStart(5, '0'))
    .join('')
  const bytes: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2))
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)))
  const hash = createHmac('sha1', Buffer.from(bytes)).update(counter).digest()
  return String((hash.readUInt32BE(hash[19] & 15) & 0x7fffffff) % 1000000).padStart(6, '0')
}
export async function signInAndStepUp(page: Page) {
  const account = readAdminFixture()
  await page.goto('/sign-in')
  await page.getByRole('button', { name: 'EN', exact: true }).click()
  await page.getByLabel('Email', { exact: true }).fill(account.email)
  await page.getByLabel('Password', { exact: true }).fill(account.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByLabel('Authentication code')).toBeVisible()
  await expect.poll(() => totp(account.secret), { timeout: 35000 }).not.toBe(lastUsedCode)
  const loginCode = totp(account.secret)
  await page.getByLabel('Authentication code').fill(loginCode)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page).toHaveURL(/\/app/)
  await page.goto('/app/admin')
  await page.getByRole('button', { name: 'Verify administrator access' }).click()
  await expect.poll(() => totp(account.secret), { timeout: 35000 }).not.toBe(loginCode)
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Password', { exact: true }).fill(account.password)
  await dialog.getByLabel('Authentication code').fill(totp(account.secret))
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  lastUsedCode = totp(account.secret)
  return account
}
