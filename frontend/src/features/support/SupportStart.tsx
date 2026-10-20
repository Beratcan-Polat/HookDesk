import { useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { api, get } from '@/lib/api'
import type { Envelope, Page, SupportSession, User, Workspace } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Failure } from '@/components/common'
interface TargetDetail extends Envelope<User> {
  memberships: { workspace: Workspace }[]
}
export default function SupportStartButton({
  userId = '',
  workspaceId = '',
}: {
  userId?: string
  workspaceId?: string
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState(userId)
  const [selectedWorkspace, setSelectedWorkspace] = useState(workspaceId)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const users = useQuery({
    queryKey: ['supportUserOptions', search],
    queryFn: () =>
      get<Page<User>>('/api/admin/v1/users?per_page=100&search=' + encodeURIComponent(search)),
    enabled: open,
  })
  const target = useQuery({
    queryKey: ['supportTarget', selectedUser],
    queryFn: () => get<TargetDetail>('/api/admin/v1/users/' + selectedUser),
    enabled: open && !!selectedUser,
  })
  const valid = (user: User) =>
    user.platform_role === 'user' && user.status === 'active' && !!user.email_verified_at
  const choices = (users.data?.data ?? []).filter(valid)
  if (
    target.data &&
    valid(target.data.data) &&
    !choices.some((user) => user.id === target.data.data.id)
  )
    choices.push(target.data.data)
  const workspaces = target.data?.memberships.map((member) => member.workspace) ?? []
  const workspace =
    workspaces.find((w) => w.id === selectedWorkspace)?.id ?? workspaces[0]?.id ?? ''
  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const response = await api.post<Envelope<SupportSession>>('/api/admin/v1/support-sessions', {
        user_id: selectedUser,
        workspace_id: workspace,
        reason,
      })
      await qc.invalidateQueries()
      setOpen(false)
      navigate('/app?support=' + response.data.data.id + '&w=' + workspace)
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setOpen(true)
          setSelectedUser(userId)
          setSelectedWorkspace(workspaceId)
          setReason('')
          setError(null)
        }}
      >
        {t('startSupport')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="form-dialog">
          <DialogHeader>
            <DialogTitle>{t('startSupport')}</DialogTitle>
            <DialogDescription>{t('supportDescription')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => void submit(event)}>
            <label className="field">
              <span>{t('search')}</span>
              <Input value={search} onChange={(event) => setSearch(event.target.value)} />
            </label>
            <label className="field">
              <span>{t('user')}</span>
              <select
                required
                value={selectedUser}
                onChange={(event) => {
                  setSelectedUser(event.target.value)
                  setSelectedWorkspace('')
                }}
              >
                <option value="">{t('user')}</option>
                {choices.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} · {user.email}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t('workspace')}</span>
              <select
                required
                value={workspace}
                onChange={(event) => setSelectedWorkspace(event.target.value)}
                disabled={target.isFetching}
              >
                <option value="">{t('workspace')}</option>
                {workspaces.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t('reason')}</span>
              <textarea
                required
                minLength={5}
                maxLength={1000}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
              />
            </label>
            {users.isError ? (
              <Failure error={users.error} />
            ) : target.isError ? (
              <Failure error={target.error} />
            ) : error ? (
              <Failure error={error} />
            ) : null}
            <div className="dialog-actions">
              <Button variant="outline" type="button" onClick={() => setOpen(false)}>
                {t('cancel')}
              </Button>
              <Button
                type="submit"
                disabled={busy || !workspace || !selectedUser || target.isFetching}
              >
                {t('continue')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
