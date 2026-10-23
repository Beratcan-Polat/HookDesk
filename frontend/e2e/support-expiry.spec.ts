import { test, expect } from '@playwright/test'
import { signInAndStepUp } from './helpers/admin'
import { browserControl, browserRequest, labels, readLifecycle } from './helpers/lifecycle'

for (const locale of ['en', 'tr'] as const) {
  test(`support countdown expires, blocks stale requests and preserves administrator login in ${locale}`, async ({
    page,
  }) => {
    test.setTimeout(150000)
    test.skip(
      !process.env.E2E_ADMIN_FILE || !process.env.E2E_LIFECYCLE_FILE,
      'Provide isolated administrator and lifecycle fixtures.',
    )
    const fixture = readLifecycle(locale)
    const account = await signInAndStepUp(page)
    const l = labels[locale]
    await page.getByRole('button', { name: locale.toUpperCase(), exact: true }).click()
    await page.goto('/app/admin/support')
    await page.getByRole('button', { name: l.startSupport, exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('combobox', { name: l.user, exact: true }).selectOption(fixture.owner.id)
    await dialog
      .getByRole('combobox', { name: l.workspace, exact: true })
      .selectOption(fixture.workspace_id)
    await dialog.getByLabel(l.reason, { exact: true }).fill('Browser lifecycle expiry verification')
    const started = page.waitForResponse(
      (r) => r.url().endsWith('/support-sessions') && r.request().method() === 'POST',
    )
    await dialog.getByRole('button', { name: l.proceed, exact: true }).click()
    const session = (await (await started).json()).data as {
      id: string
      actor_id: string
      expires_at: string
      created_at: string
    }
    expect(session.actor_id).not.toBe(fixture.owner.id)
    expect(
      Math.abs(
        new Date(session.expires_at).getTime() -
          new Date(session.created_at).getTime() -
          30 * 60000,
      ),
    ).toBeLessThan(1000)
    await expect(page.locator('.support-banner')).toContainText('Browser ' + locale + ' owner')
    const supportUrl = `/app/projects?support=${session.id}&w=${fixture.workspace_id}&p=${fixture.project_id}`
    await page.clock.install()
    await page.goto(supportUrl)
    await expect(page.locator('main h1')).toBeVisible()
    const prefix = '/api/support/v1/sessions/' + session.id
    const before = await browserRequest(page, 'PATCH', prefix + '/projects/' + fixture.project_id, {
      name: 'Allowed support edit ' + locale,
    })
    expect(before.status()).toBe(200)

    // Advance the UI clock and expire only this fixture's database record; no test HTTP backdoor.
    await page.clock.setFixedTime(new Date(new Date(session.expires_at).getTime() - 1000))
    await page.clock.runFor(1000)
    await expect(page.locator('.support-banner')).toContainText('0:01')
    browserControl('expire-support', locale, session.id)
    await page.clock.setFixedTime(new Date(new Date(session.expires_at).getTime() + 1000))
    await page.clock.runFor(1000)
    await expect(page.getByRole('alert')).toHaveText(l.expired)
    await expect(page.locator('main')).toHaveCount(0)
    await expect(page.locator('.support-banner')).toHaveCount(0)
    const staleWrite = await browserRequest(
      page,
      'PATCH',
      prefix + '/projects/' + fixture.project_id,
      { name: 'Forbidden stale edit' },
    )
    expect(staleWrite.status()).toBe(403)
    const staleRead = await browserRequest(page, 'GET', prefix + '/workspaces')
    expect(staleRead.status()).toBe(403)
    await page.reload()
    await expect(page.getByRole('alert')).toHaveText(l.expired)
    await page.getByRole('link', { name: l.returnToAdmin, exact: true }).click()
    await expect(page).toHaveURL(/\/app\/admin\/support$/)
    const me = await browserRequest(page, 'GET', '/api/me')
    expect(me.status()).toBe(200)
    expect((await me.json()).data.email).toBe(account.email)
    const project = await browserRequest(
      page,
      'GET',
      '/api/admin/v1/projects/' + fixture.project_id,
    )
    expect(project.status()).toBe(200)
    expect((await project.json()).data.name).toBe('Allowed support edit ' + locale)
  })
}
