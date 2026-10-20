import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Webhook } from 'lucide-react'
import { useScope, RequireProject } from '@/components/Layout'
import { get } from '@/lib/api'
import type { Envelope, Endpoint } from '@/lib/types'
import {
  PageHeading,
  Loading,
  Failure,
  Empty,
  MutationDialog,
  Status,
  CopyText,
  type Field,
} from '@/components/common'
const behavior: Field = {
  name: 'sandbox_behavior',
  label: 'behavior',
  type: 'select',
  value: 'success',
  options: ['success', 'fail_twice', 'always_fail', 'timeout'].map((value) => ({
    value,
    label: value,
  })),
}
const subscriptions: Field = {
  name: 'subscriptions',
  label: 'subscriptions',
  required: true,
  value: '*',
  help: 'subscriptionsHelp',
}
export default function EndpointsPage() {
  return (
    <RequireProject>
      <EndpointList />
    </RequireProject>
  )
}
function EndpointList() {
  const { project, prefix, canWrite, supportId } = useScope()
  const { t } = useTranslation()
  const q = useQuery({
    queryKey: ['endpoints', prefix, project?.id],
    queryFn: () => get<Envelope<Endpoint[]>>(prefix + '/projects/' + project?.id + '/endpoints'),
  })
  return (
    <>
      <PageHeading title="endpoints" subtitle={project?.name}>
        {!supportId ? (
          <MutationDialog
            label="newEndpoint"
            variant="default"
            disabled={!canWrite}
            url={prefix + '/projects/' + project?.id + '/endpoints'}
            fields={[
              { name: 'name', label: 'name', required: true },
              {
                name: 'kind',
                label: 'kind',
                type: 'select',
                value: 'sandbox',
                options: [
                  { value: 'sandbox', label: 'sandbox' },
                  { value: 'https', label: 'https' },
                ],
              },
              { name: 'url', label: 'url' },
              behavior,
              subscriptions,
            ]}
            values={(v) => ({
              ...v,
              url: v.url || null,
              subscriptions: v.subscriptions
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            })}
          />
        ) : null}
      </PageHeading>
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <Failure error={q.error} />
      ) : q.data.data.length ? (
        <div className="endpoint-list">
          {q.data.data.map((e) => (
            <article key={e.id}>
              <div className="endpoint-heading">
                <span className="project-symbol">
                  <Webhook size={21} />
                </span>
                <div>
                  <h2>{e.name}</h2>
                  <small>{t(e.kind === 'sandbox' ? 'sandbox' : 'https')}</small>
                </div>
                <Status value={e.paused ? 'paused' : 'active'} />
              </div>
              {e.url ? (
                <CopyText value={e.url} />
              ) : (
                <p className="mono muted">{t(e.sandbox_behavior)}</p>
              )}
              <div className="subscription-list">
                {e.subscriptions.map((s) => (
                  <code key={s.event_type}>{s.event_type}</code>
                ))}
              </div>
              <div className="row-actions">
                <MutationDialog
                  label="edit"
                  disabled={!canWrite}
                  method="patch"
                  url={prefix + '/endpoints/' + e.id}
                  fields={[
                    { name: 'name', label: 'name', value: e.name, required: true },
                    ...(e.kind === 'https'
                      ? [{ name: 'url', label: 'url', value: e.url || '', required: true }]
                      : [{ ...behavior, value: e.sandbox_behavior }]),
                    {
                      ...subscriptions,
                      value: e.subscriptions.map((s) => s.event_type).join(', '),
                    },
                  ]}
                  values={(v) => ({
                    ...v,
                    subscriptions: v.subscriptions
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })}
                />
                <MutationDialog
                  label={e.paused ? 'resume' : 'pause'}
                  disabled={!canWrite}
                  method="patch"
                  url={prefix + '/endpoints/' + e.id}
                  values={() => ({ paused: !e.paused })}
                />
                {!supportId ? (
                  <MutationDialog
                    label="rotate"
                    disabled={!canWrite}
                    url={prefix + '/endpoints/' + e.id + '/rotate-secret'}
                  />
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty />
      )}
    </>
  )
}
