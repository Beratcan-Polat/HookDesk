import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useScope } from '@/components/Layout'
import { get } from '@/lib/api'
import type { Page, Row } from '@/lib/types'
import { PageHeading, Loading, Failure, Empty, DateText, Pager } from '@/components/common'
export default function AuditPage({ admin = false }: { admin?: boolean }) {
  const { workspace, prefix } = useScope()
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const page = Number(params.get('page') || 1)
  const url = admin ? '/api/admin/v1/audit' : prefix + '/workspaces/' + workspace?.id + '/audit'
  const q = useQuery({
    queryKey: ['audit', url, page],
    queryFn: () => get<Page<Row>>(url + '?page=' + page),
  })
  return (
    <>
      <PageHeading title="audit" />
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
                  <th>{t('action')}</th>
                  <th>{t('actor')}</th>
                  <th>{t('effectiveUser')}</th>
                  <th>{t('reason')}</th>
                  <th>{t('createdAt')}</th>
                </tr>
              </thead>
              <tbody>
                {q.data.data.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <code>{String(row.action)}</code>
                      <small>
                        {String(row.resource_type || '')} {String(row.resource_id || '')}
                      </small>
                    </td>
                    <td>
                      <code>{String(row.actor_id || 'CLI')}</code>
                    </td>
                    <td>
                      <code>{String(row.effective_user_id || '–')}</code>
                    </td>
                    <td>{String(row.reason || '–')}</td>
                    <td>
                      <DateText value={String(row.created_at)} />
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
    </>
  )
}
