import { test, expect } from '@playwright/test'

for (const hostname of ['localhost', '127.0.0.1']) {
  test(`keeps the signed-in session on ${hostname}`, async ({ page, baseURL }) => {
    test.skip(
      !process.env.E2E_EMAIL || !process.env.E2E_PASSWORD,
      'Set credentials for an isolated verified test account.',
    )
    const origin = new URL(baseURL!)
    test.skip(
      !['localhost', '127.0.0.1'].includes(origin.hostname),
      'Local host aliases are only tested against a local application.',
    )
    origin.hostname = hostname
    await page.goto(new URL('/sign-in', origin).href)
    await page.getByRole('button', { name: 'EN', exact: true }).click()
    await page.getByLabel('Email', { exact: true }).fill(process.env.E2E_EMAIL!)
    await page.getByLabel('Password', { exact: true }).fill(process.env.E2E_PASSWORD!)
    const signedIn = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/login' && response.request().method() === 'POST',
    )
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    expect((await signedIn).status()).toBe(200)
    await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible()
    expect(new URL(page.url()).origin).toBe(origin.origin)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await expect(page).toHaveURL(new URL('/sign-in', origin).href)
  })
}
