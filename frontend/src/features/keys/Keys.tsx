import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useScope, RequireProject } from '@/components/Layout'
import { get } from '@/lib/api'
import {
  PageHeading,
  Loading,
  Failure,
  Empty,
  MutationDialog,
  DateText,
  Status,
} from '@/components/common'
import type { Envelope } from '@/lib/types'
interface KeyItem {
  id: string
  name: string
  prefix: string
  abilities: string[]
  created_by: string
  expires_at: string
  last_used_at: string | null
  revoked_at: string | null
}
export default function KeysPage() {
  return (
    <RequireProject>
      <KeyList />
    </RequireProject>
  )
}
function KeyList() {
  const { project, prefix, canWrite, canManage, user, supportId } = useScope()
  const { t } = useTranslation()
  const q = useQuery({
    queryKey: ['keys', prefix, project?.id],
    queryFn: () => get<Envelope<KeyItem[]>>(prefix + '/projects/' + project?.id + '/keys'),
    enabled: !supportId && canWrite,
  })
  if (supportId || !canWrite) return <Empty title="forbidden" />
  return (
    <>
      <PageHeading title="keys" subtitle={project?.name}>
        <MutationDialog
          label="newKey"
          variant="default"
          url={prefix + '/projects/' + project?.id + '/keys'}
          fields={[
            { name: 'name', label: 'name', required: true },
            {
              name: 'abilities',
              label: 'abilities',
              type: 'select',
              value: 'both',
              options: [
                { value: 'both', label: 'readWrite' },
                { value: 'read', label: 'readOnly' },
                { value: 'write', label: 'writeOnly' },
              ],
            },
          ]}
          values={(v) => ({
            name: v.name,
            abilities:
              v.abilities === 'both' ? ['events:read', 'events:write'] : ['events:' + v.abilities],
          })}
        />
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
                <th>{t('abilities')}</th>
                <th>{t('lastUsed')}</th>
                <th>{t('expires')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {q.data.data.map((k) => (
                <tr key={k.id}>
                  <td>
                    <strong>{k.name}</strong>
                    <small className="mono">{k.prefix}…</small>
                  </td>
                  <td>
                    {k.abilities.map((a) => (
                      <code key={a}>{a} </code>
                    ))}
                  </td>
                  <td>
                    <DateText value={k.last_used_at} />
                  </td>
                  <td>
                    <DateText value={k.expires_at} />
                  </td>
                  <td>
                    {k.revoked_at ? (
                      <Status value="revoked" />
                    ) : (
                      <MutationDialog
                        label="revoke"
                        disabled={!canManage && k.created_by !== user.id}
                        url={prefix + '/keys/' + k.id}
                        method="delete"
                      />
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
