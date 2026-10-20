import { test, expect } from '@playwright/test'
test('landing, documentation, localization and responsive layout', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'EN', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Every event. Delivered.' })).toBeVisible()
  await page.getByRole('link', { name: 'Read the docs' }).click()
  await expect(page.getByRole('heading', { name: 'From event to delivery.' })).toBeVisible()
  await page.getByRole('button', { name: 'TR', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Olaydan teslimata.' })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy()
})
test('sign-in shows real errors and password recovery survives refresh', async ({ page }) => {
  await page.goto('/sign-in')
  await page.getByRole('button', { name: 'EN', exact: true }).click()
  await page.getByLabel('Email', { exact: true }).fill('missing@example.test')
  await page.getByLabel('Password', { exact: true }).fill('InvalidPassword123')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await page.getByRole('link', { name: 'Forgot password?' }).click()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Send reset link' })).toBeVisible()
})
test('authenticated operational screens and test publishing', async ({ page }) => {
  test.skip(
    !process.env.E2E_EMAIL || !process.env.E2E_PASSWORD,
    'Set credentials for an isolated verified test account.',
  )
  await page.goto('/sign-in')
  await page.getByRole('button', { name: 'EN', exact: true }).click()
  await page.getByLabel('Email', { exact: true }).fill(process.env.E2E_EMAIL!)
  await page.getByLabel('Password', { exact: true }).fill(process.env.E2E_PASSWORD!)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible()
  for (const route of [
    'projects',
    'events',
    'endpoints',
    'sources',
    'keys',
    'team',
    'audit',
    'settings',
  ]) {
    await page.goto('/app/' + route)
    await expect(page.locator('main h1')).toBeVisible()
    await expect(page.locator('main .error-panel')).toHaveCount(0)
  }
  await page.goto('/app/events')
  await page.getByRole('button', { name: 'Send test event' }).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('tbody').getByText('order.created').first()).toBeVisible()
  await page.locator('tbody a.table-primary').first().click()
  await page.getByRole('button', { name: 'View payload' }).click()
  await expect(page.locator('pre')).toContainText('ORD-1042')
  await page.screenshot({ path: 'test-results/event-detail.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/app')
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await expect(page.locator('aside nav')).toBeVisible()
})
