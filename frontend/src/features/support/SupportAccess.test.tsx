import { act, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import SupportAccess from './SupportAccess'
import i18n from '@/lib/i18n'
import type { SupportSession } from '@/lib/types'

afterEach(() => vi.useRealTimers())
const session: SupportSession = {
  id: 'support',
  actor_id: 'admin',
  user_id: 'user',
  workspace_id: 'workspace',
  reason: 'Help with delivery',
  expires_at: '2026-10-23T10:30:00Z',
  revoked_at: null,
  user: { id: 'user', name: 'Member', email: 'member@example.test' },
  workspace: { id: 'workspace', name: 'Workspace' },
}
function show(props: Partial<Parameters<typeof SupportAccess>[0]> = {}) {
  return render(
    <MemoryRouter>
      <SupportAccess enabled session={session} pending={false} error={null} {...props}>
        <button>Write project</button>
      </SupportAccess>
    </MemoryRouter>,
  )
}
for (const locale of ['en', 'tr'] as const) {
  it(`removes writable content at expiry without falling back to the administrator in ${locale}`, async () => {
    await i18n.changeLanguage(locale)
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-23T10:29:59Z'))
    show()
    expect(screen.getByRole('button', { name: 'Write project' })).toBeVisible()
    act(() => vi.advanceTimersByTime(1000))
    expect(screen.queryByRole('button', { name: 'Write project' })).toBeNull()
    expect(screen.getByRole('alert')).toHaveTextContent(
      locale === 'en' ? 'This support session has ended.' : 'Bu destek oturumu sona ermiş.',
    )
    expect(screen.getByRole('link')).toHaveAttribute('href', '/app/admin/support')
  })
}
it('blocks revoked sessions before their original expiry', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-23T10:00:00Z'))
  show({ session: { ...session, revoked_at: '2026-10-23T10:00:00Z' } })
  expect(screen.queryByRole('button')).toBeNull()
})
it('keeps content hidden during initial checks and reports errors even without session metadata', () => {
  const view = show({ pending: true, session: undefined })
  expect(screen.queryByRole('button')).toBeNull()
  view.unmount()
  show({ pending: true, session: undefined, error: new Error('Access denied') })
  expect(screen.getByRole('alert')).toHaveTextContent('Access denied')
  expect(screen.queryByRole('button')).toBeNull()
})
