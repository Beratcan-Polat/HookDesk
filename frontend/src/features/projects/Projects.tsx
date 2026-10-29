import { useScope, NewProjectButton, AppLink } from '@/components/Layout'
import { useTranslation } from 'react-i18next'
import { Layers } from 'lucide-react'
import { PageHeading, Empty, MutationDialog, Status } from '@/components/common'
export default function ProjectsPage() {
  const { workspace, prefix, canWrite, canManage, supportId } = useScope()
  const { t } = useTranslation()
  return (
    <>
      <PageHeading title="projects" subtitle={workspace?.name}>
        <NewProjectButton />
        {!supportId ? (
          <MutationDialog
            label="newWorkspace"
            url="/api/dashboard/v1/workspaces"
            fields={[{ name: 'name', label: 'name', required: true }]}
          />
        ) : null}
      </PageHeading>
      {workspace?.projects.length ? (
        <div className="project-list">
          {workspace.projects.map((p) => (
            <article key={p.id}>
              <div className="project-symbol">
                <Layers size={23} />
              </div>
              <div>
                <h2>{p.name}</h2>
                <p>{p.description || p.id}</p>
                {p.archived_at ? (
                  <Status value="archived" />
                ) : p.suspended ? (
                  <Status value="suspended" />
                ) : null}
              </div>
              <div className="row-actions">
                <MutationDialog
                  label="edit"
                  url={prefix + '/projects/' + p.id}
                  method="patch"
                  disabled={!canWrite || !!p.archived_at}
                  fields={[
                    { name: 'name', label: 'name', value: p.name, required: true },
                    {
                      name: 'description',
                      label: 'description',
                      type: 'textarea',
                      value: p.description || '',
                    },
                  ]}
                />
                <MutationDialog
                  label="archive"
                  url={prefix + '/projects/' + p.id + '/archive'}
                  disabled={!canManage || !!p.archived_at}
                />
                <AppLink className="table-primary" to={'/app/events?p=' + p.id}>
                  {t('events')}
                </AppLink>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty title="noProject" body="noProjectBody" />
      )}
    </>
  )
}
