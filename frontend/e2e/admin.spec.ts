import { test, expect } from '@playwright/test'
import { signInAndStepUp } from './helpers/admin'
test('administrator TOTP, step-up, audit and scoped writable support', async ({ page }) => {
  test.setTimeout(150000)
  test.skip(!process.env.E2E_ADMIN_FILE, 'Provide generated browser administrator credentials.')
  const account = await signInAndStepUp(page)
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
