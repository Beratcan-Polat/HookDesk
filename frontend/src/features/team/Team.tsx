import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useScope } from '@/components/Layout'
import { get } from '@/lib/api'
import type { Envelope, User } from '@/lib/types'
import {
  PageHeading,
  Loading,
  Failure,
  MutationDialog,
  DateText,
  Empty,
  type Field,
} from '@/components/common'
const roles = [
  { value: 'developer', label: 'developer' },
  { value: 'viewer', label: 'viewer' },
  { value: 'admin', label: 'workspaceAdmin' },
]
const roleField: Field = {
  name: 'role',
  label: 'role',
  type: 'select',
  value: 'developer',
  options: roles,
  required: true,
}
interface Team {
  members: { id: string; role: string; user: User }[]
  invitations: { id: string; email: string; role: string; expires_at: string }[]
}
export default function TeamPage() {
  const { workspace, prefix, canManage } = useScope()
  const { t } = useTranslation()
  const q = useQuery({
    queryKey: ['team', workspace?.id],
    queryFn: () => get<Envelope<Team>>(prefix + '/workspaces/' + workspace?.id + '/team'),
  })
  const owner = workspace?.role === 'owner'
  const choices = owner ? roles : roles.filter((r) => r.value !== 'admin')
  return (
    <>
      <PageHeading title="team" subtitle={workspace?.name}>
        {canManage ? (
          <MutationDialog
            label="invite"
            variant="default"
            url={prefix + '/workspaces/' + workspace?.id + '/invitations'}
            fields={[
              { name: 'email', label: 'email', type: 'email', required: true },
              { ...roleField, options: choices },
            ]}
          />
        ) : null}
      </PageHeading>
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <Failure error={q.error} />
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('name')}</th>
                  <th>{t('role')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {q.data.data.members.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <strong>{m.user.name}</strong>
                      <small>{m.user.email}</small>
                    </td>
                    <td>{t(m.role === 'admin' ? 'workspaceAdmin' : m.role)}</td>
                    <td>
                      {canManage && m.role !== 'owner' && (owner || m.role !== 'admin') ? (
                        <div className="row-actions">
                          <MutationDialog
                            label="edit"
                            url={prefix + '/workspaces/' + workspace?.id + '/members/' + m.id}
                            method="patch"
                            fields={[{ ...roleField, options: choices, value: m.role }]}
                          />
                          <MutationDialog
                            label="delete"
                            url={prefix + '/workspaces/' + workspace?.id + '/members/' + m.id}
                            method="delete"
                          />
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <section className="open-section">
            <h2>{t('invitations')}</h2>
            {q.data.data.invitations.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t('email')}</th>
                      <th>{t('role')}</th>
                      <th>{t('expires')}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {q.data.data.invitations.map((i) => (
                      <tr key={i.id}>
                        <td>{i.email}</td>
                        <td>{t(i.role)}</td>
                        <td>
                          <DateText value={i.expires_at} />
                        </td>
                        <td>
                          {canManage ? (
                            <MutationDialog
                              label="revoke"
                              url={prefix + '/workspaces/' + workspace?.id + '/invitations/' + i.id}
                              method="delete"
                            />
                          ) : null}
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
      )}
    </>
  )
}
