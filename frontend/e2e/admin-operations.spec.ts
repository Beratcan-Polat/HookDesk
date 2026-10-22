import { test, expect } from '@playwright/test'
import { signInAndStepUp } from './helpers/admin'

for (const locale of ['en', 'tr'] as const) {
  test(`bulk replay, limit inheritance and ownership transfer in ${locale}`, async ({ page }) => {
    test.setTimeout(150000)
    test.skip(!process.env.E2E_ADMIN_FILE, 'Provide isolated administrator fixtures.')
    const account = await signInAndStepUp(page)
    const fixture = account.operations[locale]
    const labels =
      locale === 'en'
        ? {
            selectPage: 'Select failed deliveries on this page',
            select: 'Select delivery ',
            replay: 'Replay selected deliveries',
            reason: 'Reason',
            proceed: 'Continue',
            close: 'Close',
            view: 'Inspect',
            edit: 'Edit',
            limit: 'Acceptance requests per minute',
            value: 'Value',
            custom: 'Workspace override',
            inherited: 'Platform default',
            reset: 'Use platform default',
            transfer: 'Transfer ownership',
            newOwner: 'New owner',
            summary: '2 replays created · 0 records rejected',
          }
        : {
            selectPage: 'Bu sayfadaki başarısız teslimatları seç',
            select: '',
            replay: 'Seçilen teslimatları yeniden gönder',
            reason: 'Gerekçe',
            proceed: 'Devam et',
            close: 'Kapat',
            view: 'İncele',
            edit: 'Düzenle',
            limit: 'Dakikalık kabul isteği',
            value: 'Değer',
            custom: 'Özel limit',
            inherited: 'Varsayılan',
            reset: 'Varsayılana dön',
            transfer: 'Sahipliği aktar',
            newOwner: 'Yeni sahip',
            summary: '2 yeni teslimat oluşturuldu · 0 kayıt reddedildi',
          }
    await page.getByRole('button', { name: locale.toUpperCase(), exact: true }).click()
    await page.goto(`/app/admin/deliveries?workspace_id=${fixture.workspace_id}`)
    const succeededLabel =
      locale === 'en'
        ? labels.select + fixture.succeeded_id
        : fixture.succeeded_id + ' teslimatını seç'
    await expect(page.getByRole('checkbox', { name: succeededLabel })).toBeDisabled()
    await page.getByRole('checkbox', { name: labels.selectPage, exact: true }).check()
    await page.getByRole('button', { name: labels.replay + ' (2)', exact: true }).click()
    let dialog = page.getByRole('dialog').last()
    await dialog.getByLabel(labels.reason, { exact: true }).fill('Browser bulk replay verification')
    await dialog.getByRole('button', { name: labels.proceed, exact: true }).click()
    await expect(dialog.getByRole('status')).toHaveText(labels.summary)
    await expect(dialog.getByRole('link')).toHaveCount(2)
    await dialog.getByRole('button', { name: labels.close, exact: true }).last().click()

    await page.goto('/app/admin/workspaces?search=' + encodeURIComponent(fixture.workspace_name))
    await page
      .getByRole('row')
      .filter({ hasText: fixture.workspace_name })
      .getByRole('button', { name: labels.view, exact: true })
      .click()
    const detail = page.getByRole('dialog').first()
    const limit = detail.getByRole('group', { name: labels.limit, exact: true })
    await limit.getByRole('button', { name: labels.edit, exact: true }).click()
    dialog = page.getByRole('dialog').last()
    await dialog.getByLabel(labels.value, { exact: true }).fill('123')
    await dialog
      .getByLabel(labels.reason, { exact: true })
      .fill('Browser limit override verification')
    await dialog.getByRole('button', { name: labels.proceed, exact: true }).click()
    await expect(page.getByRole('dialog', { includeHidden: true })).toHaveCount(1)
    await expect(limit.getByText(labels.custom, { exact: true })).toBeVisible()
    await expect(limit.getByText('123', { exact: true })).toBeVisible()
    await limit.getByRole('button', { name: labels.reset, exact: true }).click()
    dialog = page.getByRole('dialog').last()
    await dialog
      .getByLabel(labels.reason, { exact: true })
      .fill('Browser restore inheritance verification')
    await dialog.getByRole('button', { name: labels.proceed, exact: true }).click()
    await expect(page.getByRole('dialog', { includeHidden: true })).toHaveCount(1)
    await expect(limit.getByText(labels.inherited, { exact: true })).toBeVisible()
    await expect(limit.getByRole('button', { name: labels.reset, exact: true })).toHaveCount(0)

    await detail.getByRole('button', { name: labels.transfer, exact: true }).click()
    dialog = page.getByRole('dialog').last()
    await expect(
      dialog.getByRole('option').filter({ hasText: fixture.unverified_name }),
    ).toHaveCount(0)
    await dialog
      .getByRole('combobox', { name: labels.newOwner, exact: true })
      .selectOption(fixture.target_id)
    await dialog
      .getByLabel(labels.reason, { exact: true })
      .fill('Browser ownership transfer verification')
    await dialog.getByRole('button', { name: labels.transfer, exact: true }).click()
    await expect(page.getByRole('dialog', { includeHidden: true })).toHaveCount(1)
    const response = await page.request.get('/api/admin/v1/workspaces/' + fixture.workspace_id, {
      headers: { Accept: 'application/json', Referer: page.url() },
    })
    expect(response.status()).toBe(200)
    const result = await response.json()
    expect(result.data.owner_user_id).toBe(fixture.target_id)
    expect(
      result.data.members.filter((member: { role: string }) => member.role === 'owner'),
    ).toHaveLength(1)
    expect(
      result.data.members.find((member: { user_id: string }) => member.user_id === fixture.owner_id)
        .role,
    ).toBe('admin')
    await page.setViewportSize({ width: 390, height: 844 })
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBeTruthy()
    await page.screenshot({ path: `test-results/admin-operations-${locale}.png`, fullPage: true })
  })
}
