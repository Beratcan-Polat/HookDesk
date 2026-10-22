import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api, errorMessage } from '@/lib/api'
import { AppLink } from '@/components/Layout'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export interface ReplayResult {
  id: string
  ok: boolean
  replay_id?: string
  error?: string
}

export default function BulkReplay({
  ids,
  onProcessed,
}: {
  ids: string[]
  onProcessed: (successfulIds: string[]) => void
}) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState<ReplayResult[] | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || !ids.length || ids.length > 100 || reason.trim().length < 5) return
    setPending(true)
    setError('')
    try {
      const response = await api.post<{ data: ReplayResult[] }>('/api/admin/v1/deliveries/replay', {
        delivery_ids: ids,
        reason: reason.trim(),
      })
      setResults(response.data.data)
      onProcessed(response.data.data.filter((result) => result.ok).map((result) => result.id))
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['adminList', 'deliveries'] }),
        qc.invalidateQueries({ queryKey: ['adminOverview'] }),
      ])
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <Button
        disabled={!ids.length || ids.length > 100}
        onClick={() => {
          setReason('')
          setResults(null)
          setError('')
          setOpen(true)
        }}
      >
        {t('bulkReplay')} ({ids.length})
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!pending) setOpen(value)
        }}
      >
        <DialogContent className="form-dialog bulk-replay-dialog">
          <DialogHeader>
            <DialogTitle>{t('bulkReplay')}</DialogTitle>
            <DialogDescription>{t('bulkReplayDescription')}</DialogDescription>
          </DialogHeader>
          {results ? (
            <>
              <p role="status">
                {t('bulkReplaySummary', {
                  succeeded: results.filter((result) => result.ok).length,
                  failed: results.filter((result) => !result.ok).length,
                })}
              </p>
              <div className="bulk-replay-results">
                {results.map((result) => (
                  <div className="replay-result" key={result.id}>
                    <code>{result.id}</code>
                    <span className={result.ok ? 'replay-accepted' : 'form-error'}>
                      {result.ok
                        ? t('replayCreated')
                        : t(result.error || 'unexpected_error', { defaultValue: result.error })}
                    </span>
                    {result.replay_id ? (
                      <AppLink to={'/app/admin/deliveries/' + result.replay_id}>
                        {t('view')}
                      </AppLink>
                    ) : null}
                  </div>
                ))}
              </div>
              <p className="muted">{t('bulkReplayRemaining')}</p>
              <Button onClick={() => setOpen(false)}>{t('close')}</Button>
            </>
          ) : (
            <form onSubmit={(event) => void submit(event)}>
              <p>{t('selectedDeliveries', { count: ids.length })}</p>
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
                  disabled={pending || !ids.length || ids.length > 100 || reason.trim().length < 5}
                >
                  {t(pending ? 'loading' : 'continue')}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
