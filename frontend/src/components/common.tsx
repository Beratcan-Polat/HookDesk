import { createContext, useContext, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { Check, Copy, LoaderCircle, X, Inbox } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useForm } from 'react-hook-form'
import { api, errorMessage } from '@/lib/api'
import type { Page } from '@/lib/types'
const Notices = createContext<(message: string) => void>(() => {})
export function NoticeProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('')
  const { t } = useTranslation()
  return (
    <Notices.Provider value={setMessage}>
      {children}
      {message ? (
        <div className="notice" role="status">
          {t(message, { defaultValue: message })}
          <button aria-label={t('close')} onClick={() => setMessage('')}>
            <X size={16} />
          </button>
        </div>
      ) : null}
    </Notices.Provider>
  )
}
export const useNotice = () => useContext(Notices)
export function Loading() {
  const { t } = useTranslation()
  return (
    <div className="state">
      <LoaderCircle className="spin" size={20} />
      <span>{t('loading')}</span>
    </div>
  )
}
export function Failure({ error, retry }: { error: unknown; retry?: () => void }) {
  const { t } = useTranslation()
  return (
    <div role="alert" className="error-panel">
      <p>{t(errorMessage(error), { defaultValue: errorMessage(error) })}</p>
      {retry ? (
        <Button variant="outline" onClick={retry}>
          {t('retry')}
        </Button>
      ) : null}
    </div>
  )
}
export function Empty({
  title,
  body,
  children,
}: {
  title?: string
  body?: string
  children?: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <div className="empty">
      <Inbox size={28} />
      <h3>{t(title || 'noResults')}</h3>
      <p>{t(body || 'noResultsBody')}</p>
      {children}
    </div>
  )
}
export function PageHeading({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children?: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <div className="page-heading">
      <div>
        <h1>{t(title, { defaultValue: title })}</h1>
        {subtitle ? <p>{t(subtitle, { defaultValue: subtitle })}</p> : null}
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  )
}
export function Status({ value }: { value: string }) {
  const { t } = useTranslation()
  return (
    <span className={'status status-' + value}>
      <span />
      {t(value, { defaultValue: value.replaceAll('_', ' ') })}
    </span>
  )
}
export function CopyText({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  const { t } = useTranslation()
  return (
    <div className="copy-line">
      <code>{value}</code>
      <Button
        size="icon"
        variant="ghost"
        aria-label={t(copied ? 'copied' : 'copy')}
        onClick={() => {
          void navigator.clipboard.writeText(value).then(() => setCopied(true))
        }}
      >
        {copied ? <Check size={15} /> : <Copy size={15} />}
      </Button>
    </div>
  )
}
export function JsonView({ value }: { value: unknown }) {
  return (
    <pre className="json-view">
      {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
    </pre>
  )
}
export function DateText({ value }: { value: string | null | undefined }) {
  const { i18n } = useTranslation()
  return (
    <>
      {value
        ? new Intl.DateTimeFormat(i18n.language, {
            dateStyle: 'medium',
            timeStyle: 'short',
          }).format(new Date(value))
        : '–'}
    </>
  )
}
export function Pager<T>({ page, onChange }: { page: Page<T>; onChange: (n: number) => void }) {
  const { t } = useTranslation()
  const n = page.meta?.current_page ?? page.current_page ?? 1
  const last = page.meta?.last_page ?? page.last_page ?? 1
  return (
    <div className="pager">
      <span>
        {t('page')} {n} {t('of')} {last}
      </span>
      <Button
        size="sm"
        variant="outline"
        disabled={n <= 1}
        aria-label={t('previous')}
        onClick={() => onChange(n - 1)}
      >
        {t('previous')}
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={n >= last}
        aria-label={t('next')}
        onClick={() => onChange(n + 1)}
      >
        {t('next')}
      </Button>
    </div>
  )
}
export type Field = {
  name: string
  label: string
  type?: 'text' | 'email' | 'password' | 'textarea' | 'select' | 'json' | 'number'
  min?: number
  max?: number
  required?: boolean
  value?: string
  options?: { value: string; label: string }[]
  help?: string
}
export interface MutationDialogProps {
  label: string
  title?: string
  description?: string
  url: string
  method?: 'post' | 'put' | 'patch' | 'delete'
  fields?: Field[]
  values?: (v: Record<string, string>) => unknown
  onSuccess?: (response: unknown) => void
  variant?: 'default' | 'outline' | 'ghost' | 'destructive'
  disabled?: boolean
}
export function MutationDialog({
  label,
  title,
  description,
  url,
  method = 'post',
  fields = [],
  values,
  onSuccess,
  variant = 'outline',
  disabled,
}: MutationDialogProps) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const notice = useNotice()
  const [open, setOpen] = useState(false)
  const [secret, setSecret] = useState('')
  const [result, setResult] = useState<unknown>(null)
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
    setError,
  } = useForm<Record<string, string>>()
  async function submit(input: Record<string, string>) {
    try {
      const payload = values ? values(input) : input
      const response = await api.request({
        url,
        method,
        data: payload,
        headers: { 'Idempotency-Key': crypto.randomUUID() },
      })
      const body = response.data as { secret?: string; token?: string; url?: string }
      setSecret(body?.secret || body?.token || body?.url || '')
      await qc.invalidateQueries()
      onSuccess?.(response.data)
      if (body?.secret || body?.token || body?.url) setResult(null)
      else {
        setOpen(false)
        notice('saved')
      }
    } catch (error) {
      setError('root', { message: errorMessage(error) })
    }
  }
  return (
    <>
      <Button
        variant={variant}
        disabled={disabled}
        onClick={() => {
          reset(Object.fromEntries(fields.map((f) => [f.name, f.value ?? ''])))
          setSecret('')
          setResult(null)
          setOpen(true)
        }}
      >
        {t(label, { defaultValue: label })}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value)
          if (!value) {
            setSecret('')
            setResult(null)
          }
        }}
      >
        <DialogContent className="form-dialog">
          <DialogHeader>
            <DialogTitle>{t(secret ? 'secretTitle' : title || label)}</DialogTitle>
            <DialogDescription>
              {t(secret ? 'secretDescription' : description || 'confirmOperation')}
            </DialogDescription>
          </DialogHeader>
          {secret ? (
            <>
              <CopyText value={secret} />
              <Button
                onClick={() => {
                  setSecret('')
                  setOpen(false)
                }}
              >
                {t('close')}
              </Button>
            </>
          ) : (
            <form onSubmit={handleSubmit(submit)}>
              {fields.map((field) => (
                <label className="field" key={field.name}>
                  <span>{t(field.label)}</span>
                  {field.type === 'select' ? (
                    <select
                      {...register(field.name, {
                        required: field.required ? t('required') : false,
                      })}
                    >
                      {field.options?.map((option) => (
                        <option key={option.value} value={option.value}>
                          {t(option.label, { defaultValue: option.label })}
                        </option>
                      ))}
                    </select>
                  ) : field.type === 'textarea' || field.type === 'json' ? (
                    <textarea
                      className={field.type === 'json' ? 'mono' : ''}
                      rows={field.type === 'json' ? 7 : 3}
                      {...register(field.name, {
                        required: field.required ? t('required') : false,
                      })}
                    />
                  ) : (
                    <Input
                      type={field.type || 'text'}
                      min={field.min}
                      max={field.max}
                      step={field.type === 'number' ? 1 : undefined}
                      autoComplete={field.type === 'password' ? 'current-password' : 'off'}
                      {...register(field.name, {
                        required: field.required ? t('required') : false,
                        validate:
                          field.type === 'number'
                            ? (value) =>
                                (value.trim() !== '' &&
                                  Number.isInteger(Number(value)) &&
                                  Number(value) >= (field.min ?? Number.MIN_SAFE_INTEGER) &&
                                  Number(value) <= (field.max ?? Number.MAX_SAFE_INTEGER)) ||
                                t('wholeNumberRange', { min: field.min, max: field.max })
                            : undefined,
                      })}
                    />
                  )}{' '}
                  {field.help ? <small>{t(field.help)}</small> : null}
                  {errors[field.name] ? (
                    <small role="alert">{errors[field.name]?.message}</small>
                  ) : null}
                </label>
              ))}
              {errors.root ? (
                <p role="alert" className="form-error">
                  {t(errors.root.message || 'unexpected_error', {
                    defaultValue: errors.root.message,
                  })}
                </p>
              ) : null}
              {result ? <JsonView value={result} /> : null}
              <div className="dialog-actions">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  {t('cancel')}
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <LoaderCircle className="spin" size={16} /> : null}
                  {t('continue')}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
export function usePerform() {
  const qc = useQueryClient()
  const notice = useNotice()
  return async (url: string, method = 'post', data: unknown = {}) => {
    try {
      const response = await api.request({ url, method, data })
      await qc.invalidateQueries()
      notice('saved')
      return response.data as unknown
    } catch (error) {
      notice(errorMessage(error))
      throw error
    }
  }
}
