import { test, expect } from '@playwright/test'
import { totp } from './helpers/admin'
import { browserControl, labels, readLifecycle, signIn, signOut } from './helpers/lifecycle'

// Do not record screenshots or traces of enrollment credentials.
test.use({ trace: 'off', screenshot: 'off', video: 'off' })
for (const locale of ['en', 'tr'] as const) {
  test(`2FA enrollment, authenticator login and single-use recovery code in ${locale}`, async ({
    page,
  }) => {
    test.setTimeout(120000)
    test.skip(!process.env.E2E_LIFECYCLE_FILE, 'Provide isolated lifecycle fixtures.')
    const fixture = readLifecycle(locale)
    const l = labels[locale]
    await signIn(page, fixture.security, locale)
    await expect(page).toHaveURL(/\/app/)
    await page.goto('/app/settings')
    await page.getByLabel(l.password, { exact: true }).fill(fixture.security.password)
    await page.getByRole('button', { name: l.setup, exact: true }).click()
    await expect(page.locator('.qr-setup img')).toHaveAttribute('src', /^data:image\/svg\+xml/)
    const { secret } = JSON.parse(browserControl('security-secret', locale)) as { secret: string }
    await page.getByLabel(l.code, { exact: true }).fill('invalid-authenticator-code')
    await page.getByRole('button', { name: l.confirm, exact: true }).click()
    await expect(page.locator('.security-panel').getByRole('alert')).toBeVisible()
    await page.getByLabel(l.code, { exact: true }).fill(totp(secret))
    await page.getByRole('button', { name: l.confirm, exact: true }).click()
    await expect(page.getByText(l.ready, { exact: true })).toBeVisible()
    await expect(page.locator('.security-panel').getByRole('alert')).toHaveCount(0)
    const codes = await page.locator('.security-panel .copy-line code').allTextContents()
    expect(codes.length === 8 && new Set(codes).size === 8).toBe(true)
    await page.reload()
    await expect(page.getByText(l.ready, { exact: true })).toBeVisible()
    await expect(page.locator('.security-panel .copy-line')).toHaveCount(0)
    await signOut(page, locale)

    await signIn(page, fixture.security, locale)
    await expect(page).toHaveURL(/\/two-factor$/)
    const previous = totp(secret)
    await expect.poll(() => totp(secret), { timeout: 35000 }).not.toBe(previous)
    await page.getByLabel(l.code, { exact: true }).fill(totp(secret))
    await page.getByRole('button', { name: l.proceed, exact: true }).click()
    await expect(page).toHaveURL(/\/app$/)
    await signOut(page, locale)

    await signIn(page, fixture.security, locale)
    await expect(page).toHaveURL(/\/two-factor$/)
    await page.getByRole('button', { name: l.useRecovery, exact: true }).click()
    await page.getByLabel(l.recovery, { exact: true }).fill(codes[0])
    await page.getByRole('button', { name: l.proceed, exact: true }).click()
    await expect(page).toHaveURL(/\/app$/)
    await signOut(page, locale)
    await signIn(page, fixture.security, locale)
    await expect(page).toHaveURL(/\/two-factor$/)
    await page.getByRole('button', { name: l.useRecovery, exact: true }).click()
    await page.getByLabel(l.recovery, { exact: true }).fill(codes[0])
    const reused = page.waitForResponse(
      (r) => r.url().endsWith('/two-factor-challenge') && r.request().method() === 'POST',
    )
    await page.getByRole('button', { name: l.proceed, exact: true }).click()
    expect((await reused).status()).toBe(422)
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page).toHaveURL(/\/two-factor$/)
    await page.getByLabel(l.recovery, { exact: true }).fill(codes[1])
    await page.getByRole('button', { name: l.proceed, exact: true }).click()
    await expect(page).toHaveURL(/\/app$/)
  })
}
