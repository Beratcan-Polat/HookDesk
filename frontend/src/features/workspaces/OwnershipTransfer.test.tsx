import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import OwnershipTransfer from './OwnershipTransfer'
import type { WorkspaceMember } from '@/lib/types'
import { api, get } from '@/lib/api'
import i18n from '@/lib/i18n'

vi.mock('@/lib/api', async (original) => ({
  ...(await original<typeof import('@/lib/api')>()),
  api: { post: vi.fn() },
  get: vi.fn(),
}))
const members: WorkspaceMember[] = [
  {
    id: 'm1',
    role: 'owner',
    user: {
      id: 'owner',
      name: 'Owner',
      email: 'owner@example.test',
      status: 'active',
      email_verified_at: '2026-10-01',
    },
  },
  {
    id: 'm2',
    role: 'viewer',
    user: {
      id: 'eligible',
      name: 'Eligible member',
      email: 'eligible@example.test',
      status: 'active',
      email_verified_at: '2026-10-01',
    },
  },
  {
    id: 'm3',
    role: 'developer',
    user: {
      id: 'unverified',
      name: 'Unverified member',
      email: 'unverified@example.test',
      status: 'active',
      email_verified_at: null,
    },
  },
  {
    id: 'm4',
    role: 'admin',
    user: {
      id: 'suspended',
      name: 'Suspended member',
      email: 'suspended@example.test',
      status: 'suspended',
      email_verified_at: '2026-10-01',
    },
  },
]
beforeEach(() => vi.clearAllMocks())
function show(admin = false, suppliedMembers?: WorkspaceMember[]) {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <OwnershipTransfer
        workspaceId="workspace"
        ownerId="owner"
        admin={admin}
        members={suppliedMembers}
      />
    </QueryClientProvider>,
  )
}

describe.each(['en', 'tr'])('ownership transfer in %s', (language) => {
  it('fetches members on demand and excludes the current owner, suspended and unverified users', async () => {
    await i18n.changeLanguage(language)
    vi.mocked(get).mockResolvedValue({ data: { members } })
    vi.mocked(api.post).mockResolvedValue({ data: {} })
    show()
    expect(get).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: i18n.t('transfer') }))
    const select = await screen.findByRole('combobox', { name: i18n.t('newOwner') })
    expect(screen.getAllByRole('option')).toHaveLength(2)
    expect(
      screen.queryByRole('option', { name: /Suspended member|Unverified member|Owner ·/ }),
    ).not.toBeInTheDocument()
    fireEvent.change(select, { target: { value: 'eligible' } })
    fireEvent.submit(select.closest('form')!)
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/api/dashboard/v1/workspaces/workspace/transfer', {
        user_id: 'eligible',
      }),
    )
  })
})

it('requires a reason for administrator ownership transfers and retains the selection on rejection', async () => {
  await i18n.changeLanguage('en')
  vi.mocked(api.post).mockRejectedValue(new Error('owner_must_be_verified'))
  show(true, members)
  fireEvent.click(screen.getByRole('button', { name: 'Transfer ownership' }))
  const select = screen.getByRole('combobox', { name: 'New owner' })
  fireEvent.change(select, { target: { value: 'eligible' } })
  const form = select.closest('form')!
  expect(form.querySelector('button[type="submit"]')).toBeDisabled()
  fireEvent.change(screen.getByRole('textbox', { name: 'Reason' }), {
    target: { value: 'Transfer after approval' },
  })
  fireEvent.submit(form)
  expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t('owner_must_be_verified'))
  expect(api.post).toHaveBeenCalledWith('/api/admin/v1/workspaces/workspace/actions', {
    action: 'transfer',
    user_id: 'eligible',
    reason: 'Transfer after approval',
  })
  expect(select).toHaveValue('eligible')
})
