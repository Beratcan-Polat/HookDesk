import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Webhook, ArrowUpRight, ShieldCheck } from 'lucide-react'
import { api, csrf, get, errorMessage } from '@/lib/api'
import type { Envelope, User } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Failure, useNotice } from '@/components/common'
export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => get<Envelope<User> & { two_factor_enabled: boolean }>('/api/me'),
    retry: false,
    staleTime: 30000,
  })
}
export function LanguageSwitch() {
  const { i18n } = useTranslation()
  const qc = useQueryClient()
  const notice = useNotice()
  async function change(language: 'tr' | 'en') {
    await i18n.changeLanguage(language)
    const me = qc.getQueryData<Envelope<User>>(['me'])
    if (me?.data.email_verified_at) {
      try {
        await api.patch('/api/dashboard/v1/profile', { locale: language })
        await qc.invalidateQueries({ queryKey: ['me'] })
      } catch (error) {
        notice(errorMessage(error))
      }
    }
  }
  return (
    <div className="language-switch" aria-label="Language">
      {(['tr', 'en'] as const).map((language) => (
        <button
          key={language}
          lang={language}
          aria-pressed={i18n.language === language}
          onClick={() => void change(language)}
        >
          {language.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
const schema = z.object({
  name: z.string().optional(),
  email: z.string().optional(),
  password: z.string().optional(),
  password_confirmation: z.string().optional(),
  code: z.string().optional(),
  recovery_code: z.string().optional(),
})
type Values = z.infer<typeof schema>
export default function AuthPage() {
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const notice = useNotice()
  const me = useMe()
  const [recovery, setRecovery] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const mode = pathname.slice(1)
  const registration = mode === 'sign-up'
  const reset = mode === 'reset-password'
  const forgot = mode === 'forgot-password'
  const twoFactor = mode === 'two-factor'
  const verify = mode === 'verify-email'
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: params.get('email') || '' },
  })
  if (me.data?.data.email_verified_at && !twoFactor && !reset && !forgot)
    return <Navigate to="/app" replace />
  async function submit(v: Values) {
    setError(null)
    try {
      await csrf()
      if (verify) {
        await api.post('/email/verification-notification')
        notice('sent')
        return
      }
      if (registration) {
        if (
          !v.password ||
          v.password.length < 12 ||
          !/[a-z]/i.test(v.password) ||
          !/\d/.test(v.password)
        )
          throw new Error(t('passwordRule'))
        await api.post('/register', { ...v, locale: i18n.language })
        await qc.invalidateQueries({ queryKey: ['me'] })
        navigate('/verify-email')
        return
      }
      if (forgot) {
        await api.post('/forgot-password', { email: v.email })
        notice('sent')
        return
      }
      if (reset) {
        await api.post('/reset-password', { ...v, token: params.get('token') })
        navigate('/sign-in')
        notice('saved')
        return
      }
      if (twoFactor) {
        await api.post(
          '/two-factor-challenge',
          recovery ? { recovery_code: v.recovery_code } : { code: v.code },
        )
        await qc.invalidateQueries({ queryKey: ['me'] })
        navigate('/app')
        return
      }
      const response = await api.post<{ two_factor?: boolean }>('/login', {
        email: v.email,
        password: v.password,
      })
      await qc.invalidateQueries({ queryKey: ['me'] })
      navigate(response.data.two_factor ? '/two-factor' : '/app')
    } catch (e) {
      setError(e)
    }
  }
  const title = verify
    ? 'verifyTitle'
    : twoFactor
      ? 'twoFactorTitle'
      : registration
        ? 'registerTitle'
        : forgot
          ? 'forgot'
          : reset
            ? 'reset'
            : 'welcome'
  return (
    <div className="auth-page">
      <div className="auth-story">
        <Link className="brand" to="/">
          <Webhook size={26} />
          HookDesk
        </Link>
        <div>
          <span className="eyebrow">{t('landingTag')}</span>
          <h1>{t('landingTitle')}</h1>
          <p>{t('landingDescription')}</p>
          <div className="auth-trust">
            <ShieldCheck size={20} />
            {t('landingFlow')}
          </div>
        </div>
        <span>{t('landingFooter')}</span>
      </div>
      <div className="auth-main">
        <div className="auth-top">
          <LanguageSwitch />
          <Link to="/docs">
            {t('docs')}
            <ArrowUpRight size={14} />
          </Link>
        </div>
        <div className="auth-form">
          <h2>{t(title)}</h2>
          <p>{t(verify ? 'verifyDescription' : 'authDescription')}</p>
          <form onSubmit={handleSubmit(submit)}>
            {registration ? (
              <label className="field">
                <span>{t('name')}</span>
                <Input autoComplete="name" required {...register('name')} />
              </label>
            ) : null}
            {!verify && !twoFactor && !reset ? (
              <label className="field">
                <span>{t('email')}</span>
                <Input type="email" autoComplete="email" required {...register('email')} />
              </label>
            ) : null}
            {!verify && !twoFactor && !forgot ? (
              <label className="field">
                <span>{t('password')}</span>
                <Input
                  type="password"
                  autoComplete={registration || reset ? 'new-password' : 'current-password'}
                  minLength={registration || reset ? 12 : undefined}
                  required
                  {...register('password')}
                />
              </label>
            ) : null}
            {registration || reset ? (
              <label className="field">
                <span>{t('password_confirmation')}</span>
                <Input
                  type="password"
                  autoComplete="new-password"
                  required
                  {...register('password_confirmation')}
                />
                <small>{t('passwordRule')}</small>
              </label>
            ) : null}
            {twoFactor ? (
              <label className="field">
                <span>{t(recovery ? 'recoveryCode' : 'code')}</span>
                <Input
                  inputMode={recovery ? 'text' : 'numeric'}
                  autoComplete="one-time-code"
                  required
                  {...register(recovery ? 'recovery_code' : 'code')}
                />
              </label>
            ) : null}
            {error ? <Failure error={error} /> : null}
            <Button className="w-full" disabled={isSubmitting} type="submit">
              {t(
                verify
                  ? 'resend'
                  : registration
                    ? 'register'
                    : forgot
                      ? 'sendReset'
                      : reset
                        ? 'reset'
                        : twoFactor
                          ? 'continue'
                          : 'login',
              )}
            </Button>
          </form>
          {twoFactor ? (
            <Button variant="ghost" onClick={() => setRecovery(!recovery)}>
              {t('useRecovery')}
            </Button>
          ) : null}
          {!verify && !twoFactor && !forgot && !reset ? (
            <>
              <Link className="forgot" to="/forgot-password">
                {t('forgot')}
              </Link>
              <p className="auth-switch">
                {t(registration ? 'haveAccount' : 'newHere')}{' '}
                <Link to={registration ? '/sign-in' : '/sign-up'}>
                  {t(registration ? 'login' : 'register')}
                </Link>
              </p>
            </>
          ) : null}
          {forgot || reset ? <Link to="/sign-in">{t('login')}</Link> : null}
          {verify ? (
            <Button variant="outline" onClick={() => void me.refetch()}>
              {t('continue')}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
export function useLogout() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const notice = useNotice()
  return async () => {
    try {
      await api.post('/logout')
      qc.clear()
      navigate('/sign-in')
    } catch (e) {
      notice(errorMessage(e))
    }
  }
}
