import { beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import WorkspaceLimits from './WorkspaceLimits'
import { api } from '@/lib/api'
import i18n from '@/lib/i18n'

vi.mock('@/lib/api', async (original) => ({
  ...(await original<typeof import('@/lib/api')>()),
  api: { request: vi.fn() },
}))
beforeEach(async () => {
  vi.clearAllMocks()
  await i18n.changeLanguage('en')
})
function show() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <WorkspaceLimits
        workspaceId="workspace"
        snapshot={{
          limits: [{ key: 'events_daily', value: 800 }],
          default_limits: { events_daily: 500, ingest_per_minute: 30 },
          effective_limits: { events_daily: 800, ingest_per_minute: 30 },
        }}
      />
    </QueryClientProvider>,
  )
}
it('distinguishes effective overrides from inherited values and resets only the selected key', async () => {
  vi.mocked(api.request).mockResolvedValue({ data: {} })
  show()
  const group = screen.getByRole('group', { name: 'New events per day' })
  expect(within(group).getByText('800')).toBeVisible()
  expect(within(group).getByText('Platform default: 500')).toBeVisible()
  expect(within(group).getByText('Workspace override')).toBeVisible()
  expect(
    within(screen.getByRole('group', { name: 'Acceptance requests per minute' })).queryByRole(
      'button',
      { name: 'Use platform default' },
    ),
  ).toBeNull()
  fireEvent.click(within(group).getByRole('button', { name: 'Use platform default' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Reason' }), {
    target: { value: 'Restore default allowance' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  await waitFor(() =>
    expect(api.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'delete',
        url: '/api/admin/v1/workspaces/workspace/limits/events_daily',
        data: { reason: 'Restore default allowance' },
      }),
    ),
  )
})
it('rejects zero and fractional limit values before sending a request', async () => {
  show()
  fireEvent.click(
    within(screen.getByRole('group', { name: 'New events per day' })).getByRole('button', {
      name: 'Edit',
    }),
  )
  const input = screen.getByRole('spinbutton', { name: 'Value' })
  fireEvent.change(screen.getByRole('textbox', { name: 'Reason' }), {
    target: { value: 'Update workspace allowance' },
  })
  for (const value of ['0', '2.5']) {
    fireEvent.change(input, { target: { value } })
    fireEvent.submit(input.closest('form')!)
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a whole number')
    expect(api.request).not.toHaveBeenCalled()
  }
})
