import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import BulkReplay from './BulkReplay'
import { api } from '@/lib/api'
import i18n from '@/lib/i18n'

vi.mock('@/components/Layout', () => ({
  AppLink: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}))
vi.mock('@/lib/api', async (original) => ({
  ...(await original<typeof import('@/lib/api')>()),
  api: { post: vi.fn() },
}))

beforeEach(() => {
  vi.clearAllMocks()
})
function show(ids = ['delivery-a', 'delivery-b'], onProcessed = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <BulkReplay ids={ids} onProcessed={onProcessed} />
    </QueryClientProvider>,
  )
  return onProcessed
}

describe.each(['en', 'tr'])('bulk replay in %s', (language) => {
  it('requires a reason and reports partial success without calling rejected records successful', async () => {
    await i18n.changeLanguage(language)
    vi.mocked(api.post).mockResolvedValue({
      data: {
        data: [
          { id: 'delivery-a', ok: true, replay_id: 'new-delivery' },
          { id: 'delivery-b', ok: false, error: 'target_blocked' },
        ],
      },
    })
    const processed = show()
    fireEvent.click(screen.getByRole('button', { name: /\(2\)/ }))
    const submit = screen.getByRole('button', { name: i18n.t('continue') })
    expect(submit).toBeDisabled()
    fireEvent.change(screen.getByRole('textbox', { name: i18n.t('reason') }), {
      target: { value: 'Investigate delivery failures' },
    })
    fireEvent.click(submit)
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/api/admin/v1/deliveries/replay', {
        delivery_ids: ['delivery-a', 'delivery-b'],
        reason: 'Investigate delivery failures',
      }),
    )
    expect(
      await screen.findByText(i18n.t('bulkReplaySummary', { succeeded: 1, failed: 1 })),
    ).toBeVisible()
    expect(screen.getByText(i18n.t('target_blocked'))).toBeVisible()
    expect(screen.getByRole('link', { name: i18n.t('view') })).toHaveAttribute(
      'href',
      '/app/admin/deliveries/new-delivery',
    )
    expect(processed).toHaveBeenCalledWith(['delivery-a'])
  })
})

it('keeps selections when administrator step-up has expired', async () => {
  await i18n.changeLanguage('en')
  vi.mocked(api.post).mockRejectedValue(new Error('admin_step_up_required'))
  const processed = show()
  fireEvent.click(screen.getByRole('button', { name: /\(2\)/ }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Reason' }), {
    target: { value: 'Retry after investigation' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t('admin_step_up_required'))
  expect(processed).not.toHaveBeenCalled()
})

it('does not start a group larger than 100 records', async () => {
  await i18n.changeLanguage('en')
  show(Array.from({ length: 101 }, (_, index) => 'delivery-' + index))
  expect(screen.getByRole('button', { name: /\(101\)/ })).toBeDisabled()
  expect(api.post).not.toHaveBeenCalled()
})
