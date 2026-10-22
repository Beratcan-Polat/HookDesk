import type { ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { AdminList } from './Admin'
import { get } from '@/lib/api'
import i18n from '@/lib/i18n'

vi.mock('@/components/Layout', () => ({
  AdminStepUp: () => null,
  SupportStart: () => null,
  AppLink: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}))
vi.mock('@/lib/api', async (original) => ({
  ...(await original<typeof import('@/lib/api')>()),
  get: vi.fn(),
}))
beforeEach(async () => {
  vi.clearAllMocks()
  await i18n.changeLanguage('en')
})

it('keeps selections across pages, caps them at 100 and clears them when filters change', async () => {
  vi.mocked(get).mockImplementation(async (url) => {
    const page = Number(new URL(url, 'http://localhost').searchParams.get('page') || 1)
    return {
      data: Array.from({ length: 20 }, (_, offset) => ({
        id: `delivery-${(page - 1) * 20 + offset}`,
        status: 'failed',
        endpoint: { name: 'Receiver' },
        event: { type: 'test.created' },
        attempt_count: 6,
      })),
      current_page: page,
      last_page: 6,
      total: 120,
    }
  })
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>
        <AdminList kind="deliveries" />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  for (let page = 1; page <= 5; page++) {
    await screen.findByRole('checkbox', { name: `Select delivery delivery-${(page - 1) * 20}` })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select failed deliveries on this page' }))
    expect(screen.getByText(`Selected deliveries: ${page * 20} / 100`)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: i18n.t('next') }))
  }
  const excess = await screen.findByRole('checkbox', { name: 'Select delivery delivery-100' })
  expect(excess).toBeDisabled()
  fireEvent.change(screen.getByRole('combobox', { name: 'Status' }), {
    target: { value: 'failed' },
  })
  await waitFor(() => expect(screen.getByText('Selected deliveries: 0 / 100')).toBeVisible())
})
