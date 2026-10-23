import { test, expect } from '@playwright/test'
import {
  browserRequest,
  invitationLink,
  labels,
  readLifecycle,
  signIn,
  signOut,
} from './helpers/lifecycle'

for (const locale of ['en', 'tr'] as const) {
  test(`queued team invitation, email matching, expiry and viewer permissions in ${locale}`, async ({
    page,
  }) => {
    test.setTimeout(90000)
    test.skip(!process.env.E2E_LIFECYCLE_FILE, 'Provide isolated lifecycle fixtures and Mailpit.')
    const fixture = readLifecycle(locale)
    const l = labels[locale]
    await signIn(page, fixture.owner, locale)
    await expect(page).toHaveURL(/\/app/)
    await page.goto('/app/team?w=' + fixture.workspace_id)
    await page.getByRole('button', { name: l.invite, exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel(l.email, { exact: true }).fill(fixture.invitee.email)
    await dialog.getByLabel(l.role, { exact: true }).selectOption('viewer')
    await dialog.getByRole('button', { name: l.proceed, exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(page.getByRole('row').filter({ hasText: fixture.invitee.email })).toBeVisible()
    const path = await invitationLink(page, fixture.invitee.email, locale)

    // The sender is verified, but cannot accept a different email address's invitation.
    await page.goto(path)
    await page.getByRole('button', { name: l.accept, exact: true }).click()
    const wrongEmail = page.waitForResponse(
      (r) => r.url().endsWith('/invitations/accept') && r.request().method() === 'POST',
    )
    await dialog.getByRole('button', { name: l.proceed, exact: true }).click()
    expect((await wrongEmail).status()).toBe(403)
    await expect(dialog.getByRole('alert')).toBeVisible()
    await page.goto('/app/team?w=' + fixture.workspace_id)
    await signOut(page, locale)

    await signIn(page, fixture.invitee, locale)
    await expect(page).toHaveURL(/\/app/)
    const before = await browserRequest(page, 'GET', '/api/dashboard/v1/workspaces')
    expect(
      (await before.json()).data.some((w: { id: string }) => w.id === fixture.workspace_id),
    ).toBe(false)
    await page.goto('/invitations/' + fixture.expired_token)
    await page.getByRole('button', { name: l.accept, exact: true }).click()
    const expired = page.waitForResponse(
      (r) => r.url().endsWith('/invitations/accept') && r.request().method() === 'POST',
    )
    await dialog.getByRole('button', { name: l.proceed, exact: true }).click()
    expect((await expired).status()).toBe(410)
    await expect(dialog.getByRole('alert')).toBeVisible()

    await page.goto(path)
    await page.getByRole('button', { name: l.accept, exact: true }).click()
    await dialog.getByRole('button', { name: l.proceed, exact: true }).click()
    await expect(page).toHaveURL(/\/app$/)
    await page.goto('/app/team?w=' + fixture.workspace_id)
    await expect(page.getByRole('row').filter({ hasText: fixture.invitee.email })).toContainText(
      l.viewer,
    )
    await expect(page.getByRole('button', { name: l.invite, exact: true })).toHaveCount(0)
    const forbidden = await browserRequest(
      page,
      'POST',
      `/api/dashboard/v1/workspaces/${fixture.workspace_id}/projects`,
      { name: 'Forbidden viewer project' },
    )
    expect(forbidden.status()).toBe(403)
    const reused = await browserRequest(page, 'POST', '/api/dashboard/v1/invitations/accept', {
      token: path.split('/').pop(),
    })
    expect(reused.status()).toBe(410)
    await page.reload()
    await expect(page.getByRole('row').filter({ hasText: fixture.invitee.email })).toHaveCount(1)
  })
}
