import { test, expect } from '@playwright/test'
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
function totp(secret: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const char of secret.toUpperCase())
    bits += alphabet.indexOf(char).toString(2).padStart(5, '0')
  const bytes: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2))
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)))
  const hash = createHmac('sha1', Buffer.from(bytes)).update(counter).digest()
  const offset = hash[19] & 15
  return String((hash.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, '0')
}
test('administrator TOTP, step-up, audit and scoped writable support', async ({ page }) => {
  test.setTimeout(120000)
  test.skip(!process.env.E2E_ADMIN_FILE, 'Provide generated browser administrator credentials.')
  const account = JSON.parse(readFileSync(process.env.E2E_ADMIN_FILE!, 'utf8')) as {
    email: string
    password: string
    secret: string
    user_id: string
    workspace_id: string
  }
  await page.goto('/sign-in')
  await page.getByRole('button', { name: 'EN', exact: true }).click()
  await page.getByLabel('Email', { exact: true }).fill(account.email)
  await page.getByLabel('Password', { exact: true }).fill(account.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByLabel('Authentication code')).toBeVisible()
  const loginCode = totp(account.secret)
  await page.getByLabel('Authentication code').fill(loginCode)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page).toHaveURL(/\/app/)
  await page.goto('/app/admin')
  await expect(page.getByRole('heading', { name: 'Administration', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Verify administrator access' }).click()
  const dialog = page.getByRole('dialog')
  await expect.poll(() => totp(account.secret), { timeout: 35000 }).not.toBe(loginCode)
  await dialog.getByLabel('Password', { exact: true }).fill(account.password)
  await dialog.getByLabel('Authentication code').fill(totp(account.secret))
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  for (const route of [
    'users',
    'workspaces',
    'projects',
    'events',
    'deliveries',
    'health',
    'settings',
    'audit',
    'support',
  ]) {
    await page.goto('/app/admin/' + route)
    await expect(page.locator('main h1')).toBeVisible()
    await expect(page.locator('main .error-panel')).toHaveCount(0)
  }
  await page.getByRole('button', { name: 'Start support session' }).click()
  await page
    .getByRole('dialog')
    .getByRole('combobox', { name: 'User', exact: true })
    .selectOption(account.user_id)
  await page
    .getByRole('dialog')
    .getByRole('combobox', { name: 'Workspace', exact: true })
    .selectOption(account.workspace_id)
  await page
    .getByRole('dialog')
    .getByLabel('Reason', { exact: true })
    .fill('Browser support workflow verification')
  await page.getByRole('dialog').getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.locator('.support-banner')).toContainText('acting on behalf of')
  const query = new URL(page.url()).search
  await page.goto('/app/endpoints' + query)
  await page.getByRole('button', { name: 'Edit', exact: true }).first().click()
  const edit = page.getByRole('dialog')
  await edit.getByLabel('Name', { exact: true }).fill('Demo receiver')
  await edit.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(edit).toHaveCount(0)
  await page.screenshot({ path: 'test-results/support-session.png', fullPage: true })
  await page.getByRole('button', { name: 'End support', exact: true }).click()
  await expect(page.locator('.support-banner')).toHaveCount(0)
})
