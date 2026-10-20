import { useParams, Link } from 'react-router-dom'
import { useMe } from '@/features/auth/Auth'
import { useTranslation } from 'react-i18next'
import { MutationDialog, Loading } from '@/components/common'
export default function Invitation() {
  const { token } = useParams()
  const me = useMe()
  const { t } = useTranslation()
  if (me.isPending) return <Loading />
  return (
    <div className="invitation-page">
      <h1>{t('acceptInvite')}</h1>
      <p>{t('inviteDescription')}</p>
      {me.data?.data.email_verified_at ? (
        <MutationDialog
          label="acceptInvite"
          url="/api/dashboard/v1/invitations/accept"
          values={() => ({ token })}
          onSuccess={() => {
            window.location.assign('/app')
          }}
        />
      ) : (
        <Link to="/sign-in">{t('login')}</Link>
      )}
    </div>
  )
}
