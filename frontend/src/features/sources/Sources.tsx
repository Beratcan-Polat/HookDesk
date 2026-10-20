import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useScope, RequireProject } from '@/components/Layout'
import { get } from '@/lib/api'
import type { Envelope, Source } from '@/lib/types'
import {
  PageHeading,
  Loading,
  Failure,
  Empty,
  MutationDialog,
  Status,
  type Field,
} from '@/components/common'
const fields: Field[] = [
  { name: 'name', label: 'name', required: true },
  { name: 'event_type', label: 'eventType', required: true, value: 'webhook.received' },
  {
    name: 'mode',
    label: 'mode',
    type: 'select',
    value: 'capture_and_forward',
    options: [
      { value: 'capture_only', label: 'capture_only' },
      { value: 'capture_and_forward', label: 'capture_and_forward' },
    ],
  },
]
export default function SourcesPage() {
  return (
    <RequireProject>
      <SourceList />
    </RequireProject>
  )
}
function SourceList() {
  const { project, prefix, canWrite, supportId } = useScope()
  const { t } = useTranslation()
  const q = useQuery({
    queryKey: ['sources', prefix, project?.id],
    queryFn: () => get<Envelope<Source[]>>(prefix + '/projects/' + project?.id + '/sources'),
  })
  return (
    <>
      <PageHeading title="sources" subtitle={project?.name}>
        {!supportId ? (
          <MutationDialog
            label="newSource"
            disabled={!canWrite}
            variant="default"
            url={prefix + '/projects/' + project?.id + '/sources'}
            fields={fields}
          />
        ) : null}
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
                <th>{t('name')}</th>
                <th>{t('eventType')}</th>
                <th>{t('mode')}</th>
                <th>{t('status')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {q.data.data.map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong>{s.name}</strong>
                    <small className="mono">{s.id}</small>
                  </td>
                  <td>
                    <code>{s.event_type}</code>
                  </td>
                  <td>{t(s.mode)}</td>
                  <td>
                    <Status value={s.enabled ? 'active' : 'disabled'} />
                  </td>
                  <td>
                    <div className="row-actions">
                      <MutationDialog
                        label="edit"
                        disabled={!canWrite}
                        method="patch"
                        url={prefix + '/sources/' + s.id}
                        fields={fields.map((f) => ({
                          ...f,
                          value: String(s[f.name as keyof Source] ?? f.value ?? ''),
                        }))}
                      />
                      <MutationDialog
                        label={s.enabled ? 'disable' : 'enable'}
                        disabled={!canWrite}
                        method="patch"
                        url={prefix + '/sources/' + s.id}
                        values={() => ({ enabled: !s.enabled })}
                      />
                      {!supportId ? (
                        <MutationDialog
                          label="rotate"
                          disabled={!canWrite}
                          url={prefix + '/sources/' + s.id + '/rotate'}
                        />
                      ) : null}
                    </div>
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
