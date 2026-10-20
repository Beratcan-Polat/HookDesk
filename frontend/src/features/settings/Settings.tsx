import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useScope } from '@/components/Layout'
import { api, errorMessage } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeading, MutationDialog, Failure, CopyText, useNotice } from '@/components/common'
export default function SettingsPage() {
  const { user, workspace, prefix } = useScope()
  const { t, i18n } = useTranslation()
  const qc = useQueryClient()
  const notice = useNotice()
  const [qr, setQr] = useState('')
  const [codes, setCodes] = useState<string[]>([])
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<unknown>(null)
  async function setup() {
    try {
      setError(null)
      await api.post('/user/confirm-password', { password })
      await api.post('/user/two-factor-authentication')
      const response = await api.get<{ svg: string }>('/user/two-factor-qr-code')
      setQr(response.data.svg)
    } catch (e) {
      setError(e)
    }
  }
  async function confirm() {
    try {
      await api.post('/user/confirmed-two-factor-authentication', { code })
      const response = await api.get<string[]>('/user/two-factor-recovery-codes')
      setCodes(response.data)
      setQr('')
      setCode('')
      setPassword('')
      await qc.invalidateQueries({ queryKey: ['me'] })
      notice('saved')
    } catch (e) {
      setError(e)
    }
  }
  async function language(value: string) {
    try {
      await api.patch(prefix + '/profile', { locale: value })
      await i18n.changeLanguage(value)
      await qc.invalidateQueries({ queryKey: ['me'] })
    } catch (e) {
      notice(errorMessage(e))
    }
  }
  return (
    <>
      <PageHeading title="settings" subtitle={user.email} />
      <section className="settings-section">
        <div>
          <h2>{t('name')}</h2>
          <p>{user.name}</p>
        </div>
        <MutationDialog
          label="edit"
          method="patch"
          url={prefix + '/profile'}
          fields={[{ name: 'name', label: 'name', value: user.name, required: true }]}
        />
      </section>
      <section className="settings-section">
        <div>
          <h2>{t('language')}</h2>
        </div>
        <select
          aria-label={t('language')}
          value={i18n.language}
          onChange={(e) => void language(e.target.value)}
        >
          <option value="tr">Türkçe</option>
          <option value="en">English</option>
        </select>
      </section>
      <section className="settings-section">
        <div>
          <h2>{t('security')}</h2>
          <p>{t('passwordRule')}</p>
        </div>
        <MutationDialog
          label="reset"
          method="put"
          url="/user/password"
          fields={[
            {
              name: 'current_password',
              label: 'current_password',
              type: 'password',
              required: true,
            },
            { name: 'password', label: 'password', type: 'password', required: true },
            {
              name: 'password_confirmation',
              label: 'password_confirmation',
              type: 'password',
              required: true,
            },
          ]}
        />
      </section>
      <section className="security-panel">
        <h2>{t('enable2fa')}</h2>
        {user.two_factor_confirmed_at ? (
          <>
            <p>{t('twoFactorReady')}</p>
            {user.platform_role !== 'super_admin' ? (
              <MutationDialog
                label="disable2fa"
                method="delete"
                url="/user/two-factor-authentication"
              />
            ) : null}
          </>
        ) : (
          <>
            <p>{t('confirmPassword')}</p>
            <div className="inline-controls">
              <Input
                aria-label={t('password')}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button onClick={() => void setup()}>{t('enable2fa')}</Button>
            </div>
          </>
        )}
        {error ? <Failure error={error} /> : null}
        {qr ? (
          <div className="qr-setup">
            <p>{t('scanQr')}</p>
            <img
              width="200"
              height="200"
              alt={t('scanQr')}
              src={'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(qr)}
            />
            <div className="inline-controls">
              <Input
                aria-label={t('code')}
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <Button onClick={() => void confirm()}>{t('confirm2fa')}</Button>
            </div>
          </div>
        ) : null}
        {codes.length ? (
          <div>
            <h3>{t('recoveryCodes')}</h3>
            {codes.map((c) => (
              <CopyText value={c} key={c} />
            ))}
            <Button variant="outline" onClick={() => setCodes([])}>
              {t('close')}
            </Button>
          </div>
        ) : null}
      </section>
      {workspace?.role === 'owner' ? (
        <section className="settings-section">
          <div>
            <h2>{t('workspace')}</h2>
            <p>{workspace.name}</p>
          </div>
          <div className="row-actions">
            <MutationDialog
              label="edit"
              url={prefix + '/workspaces/' + workspace.id}
              method="patch"
              fields={[{ name: 'name', label: 'name', value: workspace.name, required: true }]}
            />
            <MutationDialog
              label="transfer"
              url={prefix + '/workspaces/' + workspace.id + '/transfer'}
              fields={[{ name: 'user_id', label: 'userId', required: true }]}
            />
            <MutationDialog
              label="archive"
              url={prefix + '/workspaces/' + workspace.id + '/archive'}
            />
          </div>
        </section>
      ) : workspace ? (
        <MutationDialog label="leave" url={prefix + '/workspaces/' + workspace.id + '/leave'} />
      ) : null}
      <section className="settings-section danger-section">
        <div>
          <h2>{t('deleteAccount')}</h2>
          <p>{t('deleteDescription')}</p>
        </div>
        <MutationDialog
          label="deleteAccount"
          description="deleteDescription"
          variant="destructive"
          method="delete"
          url={prefix + '/account'}
          fields={[{ name: 'password', label: 'password', type: 'password', required: true }]}
        />
      </section>
    </>
  )
}
