import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Shield, Users, Layers, Radio, ArrowUpRight } from 'lucide-react'
import { AdminStepUp, AppLink, SupportStart } from '@/components/Layout'
import { get } from '@/lib/api'
import type { Envelope, Page, Row, SupportSession, WorkspaceMember } from '@/lib/types'
import {
  PageHeading,
  Loading,
  Failure,
  Empty,
  DateText,
  Pager,
  MutationDialog,
  JsonView,
  Status,
  type Field,
} from '@/components/common'
import { PayloadButton } from '@/features/events/Events'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import BulkReplay from './BulkReplay'
import WorkspaceLimits, { type LimitSnapshot } from './WorkspaceLimits'
import OwnershipTransfer from '@/features/workspaces/OwnershipTransfer'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
const reason: Field = { name: 'reason', label: 'reason', type: 'textarea', required: true }
function nested(row: Row, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (value, key) =>
        value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined,
      row,
    )
}
interface Overview {
  users: number
  workspaces: number
  projects: number
  events: number
  success_rate: number | null
  statuses: Record<string, number>
  oldest_pending_at: string | null
  worker: string | null
  scheduler: string | null
}
export function AdminOverview() {
  const { t } = useTranslation()
  const q = useQuery({
    queryKey: ['adminOverview'],
    queryFn: () => get<Envelope<Overview>>('/api/admin/v1/overview'),
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  })
  if (q.isPending) return <Loading />
  if (q.isError) return <Failure error={q.error} />
  const d = q.data.data
  return (
    <>
      <PageHeading title="admin" subtitle="adminSubtitle">
        <AdminStepUp />
      </PageHeading>
      <div className="admin-callout">
        <Shield size={20} />
        <span>{t('stepUpRequired')}</span>
      </div>
      <div className="stats-grid">
        {(
          [
            ['users', d.users, Users],
            ['workspaces', d.workspaces, Layers],
            ['projects', d.projects, Layers],
            ['events', d.events, Radio],
          ] as const
        ).map(([label, value, Icon]) => (
          <div className="stat" key={label}>
            <div>
              <span>{t(label)}</span>
              <Icon size={18} />
            </div>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="admin-operations">
        <section>
          <h2>{t('deliveries')}</h2>
          {Object.entries(d.statuses).map(([status, count]) => (
            <div className="key-value" key={status}>
              <Status value={status} />
              <code>{count}</code>
            </div>
          ))}
          <AppLink to="/app/admin/deliveries">
            {t('view')}
            <ArrowUpRight size={15} />
          </AppLink>
        </section>
        <section>
          <h2>{t('health')}</h2>
          <div className="key-value">
            <span>{t('worker')}</span>
            <DateText value={d.worker} />
          </div>
          <div className="key-value">
            <span>{t('scheduler')}</span>
            <DateText value={d.scheduler} />
          </div>
          <AppLink to="/app/admin/health">
            {t('view')}
            <ArrowUpRight size={15} />
          </AppLink>
        </section>
      </div>
    </>
  )
}
type Kind = 'users' | 'workspaces' | 'projects' | 'events' | 'deliveries'
const columns: Record<Kind, [string, string][]> = {
  users: [
    ['name', 'name'],
    ['email', 'email'],
    ['platform_role', 'platformRole'],
    ['status', 'status'],
  ],
  workspaces: [
    ['name', 'name'],
    ['owner.email', 'owner'],
    ['members_count', 'team'],
    ['projects_count', 'projects'],
  ],
  projects: [
    ['name', 'name'],
    ['workspace.name', 'workspace'],
    ['created_at', 'createdAt'],
  ],
  events: [
    ['type', 'eventType'],
    ['id', 'resource'],
    ['routing_result', 'routing'],
    ['created_at', 'createdAt'],
  ],
  deliveries: [
    ['endpoint.name', 'endpoint'],
    ['event.type', 'eventType'],
    ['status', 'status'],
    ['attempt_count', 'attempts'],
  ],
}
export function AdminList({ kind }: { kind: Kind }) {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const page = Number(params.get('page') || 1)
  const filter = params.get('search') || ''
  const status = params.get('status') || ''
  const workspaceFilter = kind === 'deliveries' ? params.get('workspace_id') || '' : ''
  const eventFilter = kind === 'deliveries' ? params.get('event_id') || '' : ''
  const [selected, setSelected] = useState<Row | null>(null)
  const selectionScope = JSON.stringify([kind, filter, status, workspaceFilter, eventFilter])
  const [selection, setSelection] = useState(() => ({
    scope: selectionScope,
    ids: new Set<string>(),
  }))
  const deliveryIds = selection.scope === selectionScope ? selection.ids : new Set<string>()
  function setDeliveryIds(update: Set<string> | ((current: Set<string>) => Set<string>)) {
    setSelection((current) => ({
      scope: selectionScope,
      ids:
        typeof update === 'function'
          ? update(current.scope === selectionScope ? current.ids : new Set<string>())
          : update,
    }))
  }
  const query = new URLSearchParams({ page: String(page) })
  if (filter) query.set(kind === 'events' ? 'type' : 'search', filter)
  if (status) query.set('status', status)
  if (workspaceFilter) query.set('workspace_id', workspaceFilter)
  if (eventFilter) query.set('event_id', eventFilter)
  const q = useQuery({
    queryKey: ['adminList', kind, query.toString()],
    queryFn: () => get<Page<Row>>('/api/admin/v1/' + kind + '?' + query),
    refetchInterval: kind === 'events' || kind === 'deliveries' ? 5000 : false,
    refetchIntervalInBackground: false,
  })
  function change(key: string, value: string) {
    setDeliveryIds(new Set())
    const next = new URLSearchParams(params)
    if (value) {
      next.set(key, value)
    } else {
      next.delete(key)
    }
    next.delete('page')
    setParams(next, { replace: true })
  }
  const eligibleIds =
    q.data?.data.filter((row) => row.status === 'failed').map((row) => row.id) || []
  const allSelected = eligibleIds.length > 0 && eligibleIds.every((id) => deliveryIds.has(id))
  const someSelected = eligibleIds.some((id) => deliveryIds.has(id))
  function selectPage() {
    setDeliveryIds((current) => {
      const next = new Set(current)
      for (const id of eligibleIds) {
        if (allSelected || (someSelected && current.size >= 100)) next.delete(id)
        else if (next.size < 100) next.add(id)
      }
      return next
    })
  }
  return (
    <>
      <PageHeading title={kind} subtitle="adminSubtitle">
        <AdminStepUp />
      </PageHeading>
      <div className="filter-bar">
        {['users', 'workspaces', 'events'].includes(kind) ? (
          <Input
            aria-label={t(kind === 'events' ? 'eventType' : 'search')}
            placeholder={t(kind === 'events' ? 'eventType' : 'search')}
            value={filter}
            onChange={(e) => change('search', e.target.value)}
          />
        ) : null}
        {kind === 'users' || kind === 'deliveries' ? (
          <select
            aria-label={t('status')}
            value={status}
            onChange={(e) => change('status', e.target.value)}
          >
            <option value="">{t('all')}</option>
            {(kind === 'users'
              ? ['active', 'suspended', 'deletion_pending', 'deleted']
              : ['pending', 'processing', 'retrying', 'succeeded', 'failed', 'cancelled']
            ).map((s) => (
              <option key={s} value={s}>
                {t(s, { defaultValue: s })}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      {kind === 'deliveries' ? (
        <div className="selection-bar">
          <div>
            <strong aria-live="polite">
              {t('selectedDeliveries', { count: deliveryIds.size })}
            </strong>
            <p>{t('bulkReplayLimit')}</p>
          </div>
          <div className="row-actions">
            <Button
              variant="ghost"
              disabled={!deliveryIds.size}
              onClick={() => setDeliveryIds(new Set())}
            >
              {t('clearSelection')}
            </Button>
            <BulkReplay
              ids={[...deliveryIds]}
              onProcessed={(ids) =>
                setDeliveryIds((current) => {
                  const next = new Set(current)
                  ids.forEach((id) => next.delete(id))
                  return next
                })
              }
            />
          </div>
        </div>
      ) : null}
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <Failure error={q.error} />
      ) : !q.data.data.length ? (
        <Empty />
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {kind === 'deliveries' ? (
                    <th className="selection-cell">
                      <input
                        type="checkbox"
                        aria-label={t('selectFailedPage')}
                        checked={allSelected}
                        ref={(input) => {
                          if (input) input.indeterminate = someSelected && !allSelected
                        }}
                        disabled={!eligibleIds.length || (deliveryIds.size >= 100 && !someSelected)}
                        onChange={selectPage}
                      />
                    </th>
                  ) : null}
                  {columns[kind].map(([path, label]) => (
                    <th key={path}>{t(label)}</th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody>
                {q.data.data.map((row) => (
                  <tr key={row.id}>
                    {kind === 'deliveries' ? (
                      <td className="selection-cell">
                        <input
                          type="checkbox"
                          aria-label={t('selectDelivery', { id: row.id })}
                          checked={deliveryIds.has(row.id)}
                          disabled={
                            !deliveryIds.has(row.id) &&
                            (row.status !== 'failed' || deliveryIds.size >= 100)
                          }
                          onChange={() =>
                            setDeliveryIds((current) => {
                              const next = new Set(current)
                              if (next.has(row.id)) next.delete(row.id)
                              else if (row.status === 'failed' && next.size < 100) next.add(row.id)
                              return next
                            })
                          }
                        />
                      </td>
                    ) : null}
                    {columns[kind].map(([path]) => (
                      <td key={path}>
                        {path === 'created_at' ? (
                          <DateText value={String(nested(row, path))} />
                        ) : path === 'status' ? (
                          <Status value={String(nested(row, path))} />
                        ) : (
                          <span className={path === 'id' ? 'mono' : ''}>
                            {String(nested(row, path) ?? '–')}
                          </span>
                        )}
                      </td>
                    ))}
                    <td>
                      {kind === 'deliveries' ? (
                        <AppLink to={'/app/admin/deliveries/' + row.id}>
                          {t('view')}
                          <ArrowUpRight size={14} />
                        </AppLink>
                      ) : (
                        <Button variant="ghost" onClick={() => setSelected(row)}>
                          {t('view')}
                          <ArrowUpRight size={14} />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager
            page={q.data}
            onChange={(n) => {
              params.set('page', String(n))
              setParams(params)
            }}
          />
        </>
      )}
      {selected ? (
        <AdminDetail
          key={kind + selected.id}
          kind={kind}
          row={selected}
          close={() => setSelected(null)}
        />
      ) : null}
    </>
  )
}
function AdminDetail({ kind, row, close }: { kind: Kind; row: Row; close: () => void }) {
  const { t } = useTranslation()
  const base = '/api/admin/v1/' + kind + '/' + row.id
  const details = useQuery({
    queryKey: ['adminDetail', kind, row.id],
    queryFn: () => get<Record<string, unknown> & Partial<LimitSnapshot>>(base),
    enabled: kind === 'users' || kind === 'workspaces' || kind === 'projects',
  })
  const workspaceDetails = details.data?.data as (Row & { members?: WorkspaceMember[] }) | undefined
  const ownerId = String(workspaceDetails?.owner_user_id || row.owner_user_id || '')
  const suspended = Boolean(row.suspended)
  return (
    <Dialog
      open
      onOpenChange={(value) => {
        if (!value) close()
      }}
    >
      <DialogContent className="detail-dialog">
        <DialogHeader>
          <DialogTitle>{String(row.name || row.type || row.id)}</DialogTitle>
          <DialogDescription>{row.id}</DialogDescription>
        </DialogHeader>
        <div className="detail-dialog-scroll">
          {kind === 'users' ? (
            <>
              <div className="row-actions">
                <MutationDialog
                  label="edit"
                  method="patch"
                  url={base}
                  fields={[
                    { name: 'name', label: 'name', value: String(row.name), required: true },
                    {
                      name: 'status',
                      label: 'status',
                      type: 'select',
                      value: String(row.status),
                      options: ['active', 'suspended'].map((value) => ({ value, label: value })),
                    },
                    {
                      name: 'platform_role',
                      label: 'platformRole',
                      type: 'select',
                      value: String(row.platform_role),
                      options: ['user', 'super_admin'].map((value) => ({ value, label: value })),
                    },
                    reason,
                  ]}
                />
                <SupportStart userId={row.id} />
                <MutationDialog
                  label="endSessions"
                  url={base + '/actions'}
                  fields={[reason]}
                  values={(v) => ({ ...v, action: 'end_sessions' })}
                />
                <MutationDialog
                  label="sendVerification"
                  url={base + '/actions'}
                  fields={[reason]}
                  values={(v) => ({ ...v, action: 'send_verification' })}
                />
                <MutationDialog
                  label="sendPasswordReset"
                  url={base + '/actions'}
                  fields={[reason]}
                  values={(v) => ({ ...v, action: 'send_reset' })}
                />
                <MutationDialog
                  label="changeEmail"
                  url={base + '/actions'}
                  fields={[
                    { name: 'email', label: 'email', type: 'email', required: true },
                    reason,
                  ]}
                  values={(v) => ({ ...v, action: 'change_email' })}
                />
              </div>
            </>
          ) : null}
          {kind === 'workspaces' ? (
            <div className="row-actions">
              <MutationDialog
                label={suspended ? 'activate' : 'suspend'}
                url={base + '/actions'}
                fields={[reason]}
                values={(v) => ({ ...v, action: suspended ? 'activate' : 'suspend' })}
              />
              <MutationDialog
                label="archive"
                url={base + '/actions'}
                fields={[reason]}
                values={(v) => ({ ...v, action: 'archive' })}
              />
              {workspaceDetails?.members ? (
                <OwnershipTransfer
                  workspaceId={row.id}
                  ownerId={ownerId}
                  admin
                  members={workspaceDetails.members}
                />
              ) : null}
              <SupportStart userId={ownerId} workspaceId={row.id} />
              <AppLink to={'/app/admin/deliveries?workspace_id=' + row.id}>
                {t('deliveries')}
              </AppLink>
            </div>
          ) : null}
          {kind === 'projects' ? (
            <div className="row-actions">
              {['suspend', 'activate', 'archive'].map((action) => (
                <MutationDialog
                  key={action}
                  label={action}
                  url={base + '/actions'}
                  fields={[reason]}
                  values={(v) => ({ ...v, action })}
                />
              ))}
            </div>
          ) : null}
          {kind === 'events' ? <PayloadButton admin url={base + '/payload'} /> : null}
          {kind === 'workspaces' &&
          details.data?.effective_limits &&
          details.data.default_limits &&
          details.data.limits ? (
            <WorkspaceLimits
              workspaceId={row.id}
              snapshot={{
                limits: details.data.limits,
                default_limits: details.data.default_limits,
                effective_limits: details.data.effective_limits,
              }}
            />
          ) : null}
          {details.data ? (
            <AdminRelatedResources kind={kind} value={details.data} workspaceId={row.id} />
          ) : null}
          <section>
            <h3>{t('metadata')}</h3>
            {details.isPending && details.fetchStatus === 'fetching' ? (
              <Loading />
            ) : details.isError ? (
              <Failure error={details.error} />
            ) : (
              <JsonView value={details.data || row} />
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
export function AdminSettings() {
  const { t } = useTranslation()
  const q = useQuery({
    queryKey: ['adminSettings'],
    queryFn: () =>
      get<
        Envelope<{
          registration_enabled: boolean
          ingestion_paused: boolean
          delivery_paused: boolean
          limits: Record<string, number>
        }>
      >('/api/admin/v1/settings'),
  })
  if (q.isPending) return <Loading />
  if (q.isError) return <Failure error={q.error} />
  const d = q.data.data
  return (
    <>
      <PageHeading title="settings" subtitle="adminSubtitle">
        <AdminStepUp />
      </PageHeading>
      {(['registration_enabled', 'ingestion_paused', 'delivery_paused'] as const).map((key) => (
        <section className="settings-section" key={key}>
          <div>
            <h2>{t(key)}</h2>
            <Status value={d[key] ? 'enabled' : 'disabled'} />
          </div>
          <MutationDialog
            label="edit"
            url="/api/admin/v1/settings"
            method="put"
            fields={[reason]}
            values={(v) => ({ ...v, key, value: !d[key] })}
          />
        </section>
      ))}
      <section className="open-section">
        <h2>{t('defaultLimits')}</h2>
        {Object.entries(d.limits).map(([key, value]) => (
          <div className="settings-section" key={key}>
            <div>
              <strong>{t('limit_' + key, { defaultValue: key })}</strong>
              <p>{value}</p>
            </div>
            <MutationDialog
              label="edit"
              method="put"
              url="/api/admin/v1/settings"
              fields={[
                {
                  name: 'value',
                  label: 'limitValue',
                  type: 'number',
                  min: 1,
                  max: 1000000,
                  value: String(value),
                  required: true,
                },
                reason,
              ]}
              values={(v) => ({ ...v, key: 'limit.' + key, value: Number(v.value) })}
            />
          </div>
        ))}
      </section>
    </>
  )
}
export function AdminHealth() {
  const { t } = useTranslation()
  const q = useQuery({
    queryKey: ['adminHealth'],
    queryFn: () =>
      get<Envelope<Record<string, boolean | string | number | null>>>('/api/admin/v1/health'),
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  })
  return (
    <>
      <PageHeading title="health" subtitle="adminSubtitle" />
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <Failure error={q.error} />
      ) : (
        <div className="health-list">
          {Object.entries(q.data.data).map(([key, value]) => (
            <div className="settings-section" key={key}>
              <h2>{t(key, { defaultValue: key.replaceAll('_', ' ') })}</h2>
              {typeof value === 'boolean' ? (
                <Status value={value ? 'healthy' : 'unavailable'} />
              ) : key === 'worker' || key === 'scheduler' ? (
                value ? (
                  <DateText value={String(value)} />
                ) : (
                  <span>{t('unknown')}</span>
                )
              ) : (
                <code>{String(value ?? '–')}</code>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  )
}
export function AdminSupport() {
  const { t } = useTranslation()
  const q = useQuery({
    queryKey: ['adminSupport'],
    queryFn: () => get<Envelope<SupportSession[]>>('/api/admin/v1/support-sessions'),
  })
  return (
    <>
      <PageHeading title="support" subtitle="supportDescription">
        <AdminStepUp />
        <SupportStart />
      </PageHeading>
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <Failure error={q.error} />
      ) : !q.data.data.length ? (
        <Empty />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('user')}</th>
                <th>{t('workspace')}</th>
                <th>{t('reason')}</th>
                <th>{t('expires')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {q.data.data.map((s) => (
                <tr key={s.id}>
                  <td>
                    {s.user.name}
                    <small>{s.user.email}</small>
                  </td>
                  <td>{s.workspace.name}</td>
                  <td>{s.reason}</td>
                  <td>
                    <DateText value={s.expires_at} />
                  </td>
                  <td>
                    {!s.revoked_at && new Date(s.expires_at) > new Date() ? (
                      <AppLink to={'/app?support=' + s.id + '&w=' + s.workspace_id}>
                        {t('continue')}
                      </AppLink>
                    ) : (
                      <Status value="expired" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function rowList(value: unknown): Row[] {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is Row =>
          !!entry && typeof entry === 'object' && typeof entry.id === 'string',
      )
    : []
}
function AdminRelatedResources({
  kind,
  value,
  workspaceId,
}: {
  kind: Kind
  value: Record<string, unknown>
  workspaceId: string
}) {
  const { t } = useTranslation()
  const data =
    value.data && typeof value.data === 'object' ? (value.data as Record<string, unknown>) : {}
  const members = rowList(data.members)
  const endpoints = rowList(data.endpoints)
  const sources = rowList(value.sources)
  const keys = rowList(value.keys)
  const invitations = rowList(value.invitations)
  return (
    <>
      {kind === 'workspaces' ? (
        <>
          <section className="open-section">
            <h3>{t('team')}</h3>
            {members.map((member) => (
              <div className="settings-section" key={member.id}>
                <div>
                  <strong>
                    {String((member.user as Record<string, unknown>)?.name || member.user_id)}
                  </strong>
                  <p>
                    {String(member.user_id)} · {t(String(member.role))}
                  </p>
                </div>
                {member.role !== 'owner' ? (
                  <div className="row-actions">
                    <MutationDialog
                      label="edit"
                      method="patch"
                      url={'/api/admin/v1/workspaces/' + workspaceId + '/members/' + member.id}
                      fields={[
                        {
                          name: 'role',
                          label: 'role',
                          type: 'select',
                          value: String(member.role),
                          options: ['admin', 'developer', 'viewer'].map((role) => ({
                            value: role,
                            label: role === 'admin' ? 'workspaceAdmin' : role,
                          })),
                        },
                        reason,
                      ]}
                    />
                    <MutationDialog
                      label="delete"
                      method="delete"
                      url={'/api/admin/v1/workspaces/' + workspaceId + '/members/' + member.id}
                      fields={[reason]}
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </section>
          <section className="open-section">
            <h3>{t('invitations')}</h3>
            {invitations.map((invitation) => (
              <div className="settings-section" key={invitation.id}>
                <span>{String(invitation.email)}</span>
                <MutationDialog
                  label="revoke"
                  method="delete"
                  url={'/api/admin/v1/workspaces/' + workspaceId + '/invitations/' + invitation.id}
                  fields={[reason]}
                />
              </div>
            ))}
          </section>
        </>
      ) : null}
      {kind === 'projects' ? (
        <>
          <section className="open-section">
            <h3>{t('endpoints')}</h3>
            {endpoints.map((endpoint) => (
              <div className="settings-section" key={endpoint.id}>
                <div>
                  <strong>{String(endpoint.name)}</strong>
                  <p>{String(endpoint.url || endpoint.kind)}</p>
                </div>
                <MutationDialog
                  label={endpoint.paused ? 'resume' : 'pause'}
                  method="patch"
                  url={'/api/admin/v1/endpoints/' + endpoint.id}
                  fields={[reason]}
                  values={(v) => ({ ...v, paused: !endpoint.paused })}
                />
              </div>
            ))}
          </section>
          <section className="open-section">
            <h3>{t('sources')}</h3>
            {sources.map((source) => (
              <div className="settings-section" key={source.id}>
                <div>
                  <strong>{String(source.name)}</strong>
                  <p>{String(source.event_type)}</p>
                </div>
                <div className="row-actions">
                  {['disable', 'rotate'].map((action) => (
                    <MutationDialog
                      key={action}
                      label={action}
                      url={'/api/admin/v1/sources/' + source.id + '/actions'}
                      fields={[reason]}
                      values={(v) => ({ ...v, action })}
                    />
                  ))}
                </div>
              </div>
            ))}
          </section>
          <section className="open-section">
            <h3>{t('keys')}</h3>
            {keys.map((key) => (
              <div className="settings-section" key={key.id}>
                <div>
                  <strong>{String(key.name)}</strong>
                  <p>{String(key.prefix)}…</p>
                </div>
                {!key.revoked_at ? (
                  <MutationDialog
                    label="revoke"
                    method="delete"
                    url={'/api/admin/v1/keys/' + key.id}
                    fields={[reason]}
                  />
                ) : (
                  <Status value="revoked" />
                )}
              </div>
            ))}
          </section>
        </>
      ) : null}
    </>
  )
}
