import { useEffect, useState, type ReactNode } from 'react'
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
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!enabled) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [enabled])
  if (!enabled) return children
  if (pending && !error) return <Loading />
  const expired =
    !session || !!session.revoked_at || !(new Date(session.expires_at).getTime() > now)
  if (error || expired)
    return (
      <div className="invitation-page">
        {error ? <Failure error={error} /> : <p role="alert">{t('support_session_expired')}</p>}
        <Link to="/app/admin/support">{t('returnToAdmin')}</Link>
      </div>
    )
  return children
}
