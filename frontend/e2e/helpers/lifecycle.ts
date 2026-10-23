import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, type Page } from '@playwright/test'

export type Locale = 'en' | 'tr'
interface Account {
  id: string
  email: string
  password: string
}
interface LifecycleFixture {
  owner: Account
  invitee: Account
  security: Account
  workspace_id: string
  workspace_name: string
  project_id: string
  expired_token: string
}
export function readLifecycle(locale: Locale): LifecycleFixture {
  return JSON.parse(readFileSync(process.env.E2E_LIFECYCLE_FILE!, 'utf8').replace(/^\uFEFF/, ''))[
    locale
  ]
}
export const labels = {
  en: {
    email: 'Email',
    password: 'Password',
    login: 'Sign in',
    logout: 'Sign out',
    invite: 'Invite member',
    role: 'Role',
    viewer: 'Viewer',
    proceed: 'Continue',
    accept: 'Accept workspace invitation',
    revoke: 'Revoke',
    setup: 'Set up two-factor authentication',
    confirm: 'Confirm authentication code',
    code: 'Authentication code',
    recovery: 'Recovery code',
    useRecovery: 'Use a recovery code',
    ready: 'Two-factor authentication is enabled.',
    scan: 'Scan with an authenticator app.',
    startSupport: 'Start support session',
    user: 'User',
    workspace: 'Workspace',
    reason: 'Reason',
    expired: 'This support session has ended.',
    returnToAdmin: 'Return to administration',
  },
  tr: {
    email: 'E-posta',
    password: 'Parola',
    login: 'Giriş yap',
    logout: 'Çıkış yap',
    invite: 'Üye davet et',
    role: 'Rol',
    viewer: 'Görüntüleyici',
    proceed: 'Devam et',
    accept: 'Çalışma alanı davetini kabul et',
    revoke: 'İptal et',
    setup: 'İki aşamalı doğrulamayı kur',
    confirm: 'Doğrulama kodunu onayla',
    code: 'Doğrulama kodu',
    recovery: 'Kurtarma kodu',
    useRecovery: 'Kurtarma kodu kullan',
    ready: 'İki aşamalı doğrulama etkin.',
    scan: '',
    startSupport: 'Destek oturumu başlat',
    user: 'Kullanıcı',
    workspace: 'Çalışma alanı',
    reason: 'Gerekçe',
    expired: 'Bu destek oturumu sona ermiş.',
    returnToAdmin: 'Yönetim paneline dön',
  },
} as const

export async function signIn(page: Page, account: Account, locale: Locale) {
  const l = labels[locale]
  await page.goto('/sign-in')
  await page.getByRole('button', { name: locale.toUpperCase(), exact: true }).click()
  await page.getByLabel(l.email, { exact: true }).fill(account.email)
  await page.getByLabel(l.password, { exact: true }).fill(account.password)
  await page.getByRole('button', { name: l.login, exact: true }).click()
}
export async function signOut(page: Page, locale: Locale) {
  await page.getByRole('button', { name: labels[locale].logout, exact: true }).click()
  await expect(page).toHaveURL(/\/sign-in$/)
}
export function browserControl(
  action: 'security-secret' | 'expire-support',
  locale: Locale,
  session = '',
) {
  return execFileSync(
    process.env.E2E_PHP || 'php',
    ['tests/Support/control-browser.php', action, locale, session],
    {
      cwd: fileURLToPath(new URL('../../../backend/', import.meta.url)),
      encoding: 'utf8',
      timeout: 15000,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
}
export async function browserRequest(page: Page, method: string, path: string, data?: object) {
  const csrf = (await page.context().cookies()).find((cookie) => cookie.name === 'XSRF-TOKEN')
  return page.request.fetch(path, {
    method,
    data,
    headers: {
      Accept: 'application/json',
      Referer: page.url(),
      'X-XSRF-TOKEN': csrf ? decodeURIComponent(csrf.value) : '',
    },
  })
}
export async function invitationLink(page: Page, email: string, locale: Locale) {
  const base = process.env.E2E_MAILPIT_URL || 'http://localhost:8025'
  let messageId = ''
  await expect
    .poll(
      async () => {
        const response = await page.request.get(base + '/api/v1/messages')
        expect(response.status()).toBe(200)
        const body = (await response.json()) as {
          messages: { ID: string; Subject: string; To: { Address: string }[] }[]
        }
        const message = body.messages.find((item) => item.To.some((to) => to.Address === email))
        messageId = message?.ID || ''
        return message?.Subject
      },
      { timeout: 30000 },
    )
    .toBe(locale === 'en' ? 'Your HookDesk workspace invitation' : 'HookDesk çalışma alanı daveti')
  const response = await page.request.get(base + '/api/v1/message/' + messageId)
  expect(response.status()).toBe(200)
  const body = (await response.json()) as { Text: string }
  const link = body.Text.match(/https?:\/\/[^\s<>]*\/invitations\/[A-Za-z0-9]+/)?.[0]
  expect(link).toBeTruthy()
  return new URL(link!).pathname
}
