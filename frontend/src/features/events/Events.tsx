import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowUpRight, Send, CheckCircle2, Clock3, XCircle } from 'lucide-react'
import { useScope, AppLink, RequireProject, NewProjectButton } from '@/components/Layout'
import { get, api, errorMessage } from '@/lib/api'
import type { Page, EventItem, Delivery, Envelope } from '@/lib/types'
import {
  PageHeading,
  Loading,
  Failure,
  Empty,
  Status,
  DateText,
  Pager,
  MutationDialog,
  JsonView,
  CopyText,
  useNotice,
} from '@/components/common'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
export function TestEventButton() {
  const { prefix, project, canWrite } = useScope()
  return (
    <MutationDialog
      label="testEvent"
      url={prefix + '/projects/' + project?.id + '/test'}
      variant="default"
      disabled={!canWrite}
      fields={[
        { name: 'type', label: 'eventType', required: true, value: 'order.created' },
        {
          name: 'data',
          label: 'payload',
          type: 'json',
          required: true,
          value: '{\n  "order_id": "ORD-1042",\n  "amount": 1200\n}',
        },
      ]}
      values={(v) => {
        const data: unknown = JSON.parse(v.data)
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('invalidJson')
        return { type: v.type, data }
      }}
    />
  )
}
export function EventsPage() {
  return (
    <RequireProject>
      <EventsList />
    </RequireProject>
  )
}
export function EventsList({ compact = false }: { compact?: boolean }) {
  const { project, prefix, query: scopeQuery } = useScope()
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const page = Number(params.get('page') || 1)
  const filters = new URLSearchParams()
  for (const key of ['type', 'id', 'producer', 'from', 'to'])
    if (params.get(key)) filters.set(key, params.get(key)!)
  filters.set('page', String(page))
  const events = useQuery({
    queryKey: ['events', prefix, project?.id, filters.toString()],
    queryFn: () => get<Page<EventItem>>(prefix + '/projects/' + project?.id + '/events?' + filters),
    enabled: !!project,
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  })
  function filter(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) {
      next.set(key, value)
    } else {
      next.delete(key)
    }
    next.delete('page')
    setParams(next, { replace: true })
  }
  if (!project) return <Empty title="noProject" />
  return (
    <>
      {!compact ? (
        <PageHeading title="events" subtitle={project.name}>
          <TestEventButton />
        </PageHeading>
      ) : null}
      {!compact ? (
        <div className="filter-bar">
          <Input
            aria-label={t('eventType')}
            placeholder={t('eventType')}
            value={params.get('type') || ''}
            onChange={(e) => filter('type', e.target.value)}
          />
          <Input
            aria-label="Event ID"
            placeholder="Event ID"
            value={params.get('id') || ''}
            onChange={(e) => filter('id', e.target.value)}
          />
          <label>
            <span>{t('from')}</span>
            <Input
              type="date"
              value={params.get('from') || ''}
              onChange={(e) => filter('from', e.target.value)}
            />
          </label>
          <label>
            <span>{t('to')}</span>
            <Input
              type="date"
              value={params.get('to') || ''}
              onChange={(e) => filter('to', e.target.value)}
            />
          </label>
        </div>
      ) : null}
      {events.isPending ? (
        <Loading />
      ) : events.isError ? (
        <Failure error={events.error} retry={() => void events.refetch()} />
      ) : events.data.data.length === 0 ? (
        <Empty />
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('eventType')}</th>
                  <th>{t('createdAt')}</th>
                  <th>{t('routing')}</th>
                  <th>{t('deliveries')}</th>
                  <th>
                    <span className="sr-only">{t('view')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {events.data.data.slice(0, compact ? 5 : 100).map((event) => (
                  <tr key={event.id}>
                    <td>
                      <AppLink className="table-primary" to={'/app/events/' + event.id}>
                        {event.type}
                      </AppLink>
                      <small className="mono">{event.id}</small>
                    </td>
                    <td>
                      <DateText value={event.created_at} />
                    </td>
                    <td>
                      <Status value={event.routing_result} />
                    </td>
                    <td className="mono">{event.deliveries_count}</td>
                    <td>
                      <AppLink to={'/app/events/' + event.id}>
                        <ArrowUpRight size={16} />
                        <span className="sr-only">{t('view')}</span>
                      </AppLink>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!compact ? (
            <Pager
              page={events.data}
              onChange={(n) => {
                const next = new URLSearchParams(scopeQuery)
                next.set('page', String(n))
                setParams(next)
              }}
            />
          ) : null}
        </>
      )}
    </>
  )
}
export function PayloadButton({
  url,
  admin = false,
  label = 'viewPayload',
}: {
  url: string
  admin?: boolean
  label?: string
}) {
  const { t } = useTranslation()
  const [payload, setPayload] = useState<unknown>(undefined)
  const [busy, setBusy] = useState(false)
  const notice = useNotice()
  async function load() {
    setBusy(true)
    try {
      setPayload((await api.get(url)).data)
    } catch (error) {
      notice(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="payload-section">
      {admin ? (
        <MutationDialog
          label={label}
          description="sensitiveDescription"
          url={url}
          fields={[{ name: 'reason', label: 'reason', type: 'textarea', required: true }]}
          onSuccess={(value) => setPayload(value)}
        />
      ) : (
        <Button variant="outline" disabled={busy} onClick={() => void load()}>
          {t(label)}
        </Button>
      )}
      {payload !== undefined ? (
        <>
          <JsonView value={payload} />
          <Button variant="ghost" onClick={() => setPayload(undefined)}>
            {t('close')}
          </Button>
        </>
      ) : null}
    </div>
  )
}
export function EventDetailPage() {
  const { eventId } = useParams()
  const { prefix } = useScope()
  const { t } = useTranslation()
  const q = useQuery({
    queryKey: ['event', prefix, eventId],
    queryFn: () =>
      get<Envelope<EventItem> & { deliveries: Delivery[] }>(prefix + '/events/' + eventId),
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  })
  if (q.isPending) return <Loading />
  if (q.isError) return <Failure error={q.error} />
  const event = q.data.data
  return (
    <>
      <PageHeading title={event.type} subtitle={event.id} />
      <div className="detail-meta">
        <div>
          <span>{t('createdAt')}</span>
          <DateText value={event.created_at} />
        </div>
        <div>
          <span>{t('producer')}</span>
          <code>{event.producer}</code>
        </div>
        <div>
          <span>{t('routing')}</span>
          <Status value={event.routing_result} />
        </div>
      </div>
      <section className="open-section">
        <h2>{t('payload')}</h2>
        <PayloadButton key={prefix + event.id} url={prefix + '/events/' + event.id + '/payload'} />
      </section>
      <section className="open-section">
        <h2>{t('deliveries')}</h2>
        {q.data.deliveries.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('endpoint')}</th>
                  <th>{t('status')}</th>
                  <th>{t('attempts')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {q.data.deliveries.map((d) => (
                  <tr key={d.id}>
                    <td>{d.endpoint.name}</td>
                    <td>
                      <Status value={d.status} />
                    </td>
                    <td className="mono">{d.attempt_count} / 6</td>
                    <td>
                      <AppLink to={'/app/deliveries/' + d.id}>
                        {t('view')}
                        <ArrowUpRight size={13} />
                      </AppLink>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty />
        )}
      </section>
    </>
  )
}
export function DeliveryDetailPage({ admin = false }: { admin?: boolean }) {
  const { deliveryId } = useParams()
  const { prefix, canWrite } = useScope()
  const { t } = useTranslation()
  const base = admin ? '/api/admin/v1' : prefix
  const q = useQuery({
    queryKey: ['delivery', base, deliveryId],
    queryFn: () => get<Envelope<Delivery>>(base + '/deliveries/' + deliveryId),
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  })
  if (q.isPending) return <Loading />
  if (q.isError) return <Failure error={q.error} />
  const d = q.data.data
  return (
    <>
      <PageHeading title="deliveries" subtitle={d.id}>
        {!['pending', 'processing', 'retrying'].includes(d.status) &&
        (!admin || d.status === 'failed') ? (
          <MutationDialog
            label="replay"
            description="replayDescription"
            url={admin ? base + '/deliveries/replay' : base + '/deliveries/' + d.id + '/replay'}
            disabled={!admin && !canWrite}
            fields={
              admin ? [{ name: 'reason', label: 'reason', type: 'textarea', required: true }] : []
            }
            values={(v) => (admin ? { delivery_ids: [d.id], reason: v.reason } : {})}
          />
        ) : null}
      </PageHeading>
      <div className="detail-meta">
        <div>
          <span>{t('status')}</span>
          <Status value={d.status} />
        </div>
        <div>
          <span>{t('attempts')}</span>
          <strong>{d.attempt_count} / 6</strong>
        </div>
        <div>
          <span>{t('nextAttempt')}</span>
          {['pending', 'retrying'].includes(d.status) ? (
            <DateText value={d.next_attempt_at} />
          ) : (
            <span>–</span>
          )}
        </div>
      </div>
      <CopyText value={d.target_url} />
      {d.last_error ? <p className="form-error">{d.last_error}</p> : null}
      <section className="open-section">
        <h2>{t('attempts')}</h2>
        {d.attempts?.length ? (
          <ol className="attempt-timeline">
            {d.attempts.map((a) => (
              <li key={a.id}>
                <span className={'timeline-icon ' + a.outcome}>
                  {a.outcome === 'succeeded' ? (
                    <CheckCircle2 size={19} />
                  ) : a.outcome === 'started' ? (
                    <Clock3 size={19} />
                  ) : (
                    <XCircle size={19} />
                  )}
                </span>
                <div>
                  <div className="attempt-title">
                    <strong>#{a.number}</strong>
                    <Status value={a.outcome} />
                    <code>{a.http_status ?? a.error_code ?? '–'}</code>
                    <span className="mono">
                      {a.duration_ms !== null ? a.duration_ms + ' ms' : '–'}
                    </span>
                  </div>
                  <small>
                    <DateText value={a.created_at} />
                  </small>
                  <PayloadButton
                    key={base + a.id}
                    url={base + '/attempts/' + a.id + '/response'}
                    admin={admin}
                    label="viewResponse"
                  />
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <Empty />
        )}
      </section>
    </>
  )
}
interface Summary {
  events: number
  deliveries: number
  success_rate: number | null
  statuses: Record<string, number>
  usage: { events: number; replays: number } | null
  limits: Record<string, number>
  timeline: { day: string; total: number }[]
}
export function OverviewPage() {
  const { workspace, prefix, project } = useScope()
  const { t } = useTranslation()
  const [days, setDays] = useState('7')
  const q = useQuery({
    queryKey: ['summary', prefix, workspace?.id, days],
    queryFn: () =>
      get<Envelope<Summary>>(prefix + '/workspaces/' + workspace?.id + '/summary?days=' + days),
    enabled: !!workspace,
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  })
  if (q.isPending) return <Loading />
  if (q.isError) return <Failure error={q.error} />
  const s = q.data.data
  const pending =
    (s.statuses.pending || 0) + (s.statuses.processing || 0) + (s.statuses.retrying || 0)
  const stats = [
    ['acceptedEvents', s.events, Send],
    ['successRate', s.success_rate === null ? '–' : s.success_rate + '%', CheckCircle2],
    ['pending', pending, Clock3],
    ['failed', s.statuses.failed || 0, XCircle],
  ] as const
  return (
    <>
      <PageHeading title="overview" subtitle="overviewSubtitle">
        {project ? <TestEventButton /> : <NewProjectButton />}
      </PageHeading>
      <div className="summary-toolbar">
        <span className="workspace-tag">{workspace?.name}</span>
        <select value={days} onChange={(e) => setDays(e.target.value)} aria-label={t('from')}>
          <option value="1">{t('today')}</option>
          <option value="7">{t('last7Days')}</option>
          <option value="30">{t('last30Days')}</option>
        </select>
      </div>
      <div className="stats-grid">
        {stats.map(([label, value, Icon]) => (
          <div key={label} className="stat">
            <div>
              <span>{t(label)}</span>
              <Icon size={17} />
            </div>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="overview-middle">
        <section className="activity-section">
          <div className="section-heading">
            <h2>{t('activity')}</h2>
            <span>{t('deliveries')}</span>
          </div>
          {s.timeline.length ? (
            <div className="activity-bars" role="img" aria-label={t('activity')}>
              {s.timeline.map((day) => (
                <div key={day.day}>
                  <span className="mono">{day.total}</span>
                  <div
                    style={{
                      height: Math.max(
                        4,
                        (day.total / Math.max(...s.timeline.map((v) => v.total))) * 130,
                      ),
                    }}
                  />
                  <small>
                    {new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(
                      new Date(day.day),
                    )}
                  </small>
                </div>
              ))}
            </div>
          ) : (
            <Empty title="noActivity" />
          )}
        </section>
        <section className="usage-section">
          <h2>{t('dailyUsage')}</h2>
          <strong>
            {s.usage?.events ?? 0}
            <span>/ {s.limits.events_daily}</span>
          </strong>
          <p>{t('acceptedEvents')}</p>
          <div className="usage-divider" />
          <div>
            <span>{t('replay')}</span>
            <code>
              {s.usage?.replays ?? 0} / {s.limits.replays_daily}
            </code>
          </div>
        </section>
      </div>
      <section className="open-section">
        <div className="section-heading">
          <h2>{t('recentEvents')}</h2>
          <AppLink to="/app/events">
            {t('view')}
            <ArrowUpRight size={14} />
          </AppLink>
        </div>
        {project ? (
          <EventsList compact />
        ) : (
          <Empty title="noProject">
            <NewProjectButton />
          </Empty>
        )}
      </section>
    </>
  )
}
