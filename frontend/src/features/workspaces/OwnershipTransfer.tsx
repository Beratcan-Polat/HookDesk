import { useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api, get, errorMessage } from '@/lib/api'
import type { Envelope, WorkspaceMember } from '@/lib/types'
import { Empty, Failure, Loading } from '@/components/common'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export default function OwnershipTransfer({
  workspaceId,
  ownerId,
  admin = false,
  members,
}: {
  workspaceId: string
  ownerId: string
  admin?: boolean
  members?: WorkspaceMember[]
}) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [userId, setUserId] = useState('')
  const [reason, setReason] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const team = useQuery({
    queryKey: ['ownershipTeam', workspaceId],
    queryFn: () =>
      get<Envelope<{ members: WorkspaceMember[] }>>(
        '/api/dashboard/v1/workspaces/' + workspaceId + '/team',
      ),
    enabled: open && members === undefined && !admin,
  })
  const candidates = (members || team.data?.data.members || []).filter(
    (member) =>
      member.user.id !== ownerId &&
      member.user.status === 'active' &&
      !!member.user.email_verified_at,
  )
  const selected = candidates.find((member) => member.user.id === userId)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected || pending || (admin && reason.trim().length < 5)) return
    setPending(true)
    setError('')
    try {
      const base = '/api/' + (admin ? 'admin' : 'dashboard') + '/v1/workspaces/' + workspaceId
      await api.post(base + (admin ? '/actions' : '/transfer'), {
        user_id: selected.user.id,
        ...(admin ? { action: 'transfer', reason: reason.trim() } : {}),
      })
      await qc.invalidateQueries()
      setOpen(false)
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setPending(false)
    }
  }
  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setUserId('')
          setReason('')
          setError('')
          setOpen(true)
        }}
      >
        {t('transfer')}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!pending) setOpen(value)
        }}
      >
        <DialogContent className="form-dialog">
          <DialogHeader>
            <DialogTitle>{t('transfer')}</DialogTitle>
            <DialogDescription>{t('ownershipTransferDescription')}</DialogDescription>
          </DialogHeader>
          {members === undefined && team.isPending ? (
            <Loading />
          ) : team.isError && members === undefined ? (
            <Failure error={team.error} retry={() => void team.refetch()} />
          ) : !candidates.length ? (
            <Empty title="noEligibleOwners" body="noEligibleOwnersDescription" />
          ) : (
            <form onSubmit={(event) => void submit(event)}>
              <label className="field">
                <span>{t('newOwner')}</span>
                <select required value={userId} onChange={(event) => setUserId(event.target.value)}>
                  <option value="">{t('selectMember')}</option>
                  {candidates.map((member) => (
                    <option key={member.user.id} value={member.user.id}>
                      {member.user.name} · {member.user.email}
                    </option>
                  ))}
                </select>
              </label>
              {selected ? (
                <p>{t('ownershipTransferConfirm', { name: selected.user.name })}</p>
              ) : null}
              {admin ? (
                <label className="field">
                  <span>{t('reason')}</span>
                  <textarea
                    required
                    minLength={5}
                    maxLength={1000}
                    rows={3}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                </label>
              ) : null}
              {error ? (
                <p role="alert" className="form-error">
                  {t(error, { defaultValue: error })}
                </p>
              ) : null}
              <div className="dialog-actions">
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => setOpen(false)}
                >
                  {t('cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={!selected || pending || (admin && reason.trim().length < 5)}
                >
                  {t(pending ? 'loading' : 'transfer')}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
