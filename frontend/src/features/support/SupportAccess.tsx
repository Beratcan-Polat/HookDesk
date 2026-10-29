import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { SupportSession } from '@/lib/types'
import { Failure, Loading } from '@/components/common'

export default function SupportAccess({
  enabled,
  session,
  pending,
  error,
  children,
}: {
  enabled: boolean
  session?: SupportSession
  pending: boolean
  error: unknown
  children: ReactNode
}) {
  const { t } = useTranslation()
  if (!enabled) return children
  if (pending && !error) return <Loading />
  const ended = !session || !!session.revoked_at
  if (error || ended)
    return (
      <div className="invitation-page">
        {error ? <Failure error={error} /> : <p role="alert">{t('support_session_ended')}</p>}
        <Link to="/app/admin/support">{t('returnToAdmin')}</Link>
      </div>
    )
  return children
}
