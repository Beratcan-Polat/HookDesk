import { useTranslation } from 'react-i18next'
import { MutationDialog } from '@/components/common'

export interface LimitSnapshot {
  limits: { key: string; value: number }[]
  default_limits: Record<string, number>
  effective_limits: Record<string, number>
}

export default function WorkspaceLimits({
  workspaceId,
  snapshot,
}: {
  workspaceId: string
  snapshot: LimitSnapshot
}) {
  const { t, i18n } = useTranslation()
  const overrides = new Set(snapshot.limits.map((limit) => limit.key))
  const format = new Intl.NumberFormat(i18n.language)
  const reason = { name: 'reason', label: 'reason', type: 'textarea' as const, required: true }
  return (
    <section className="open-section">
      <h3>{t('workspaceLimits')}</h3>
      <p>{t('workspaceLimitsDescription')}</p>
      {Object.entries(snapshot.effective_limits).map(([key, value]) => (
        <div
          className="workspace-limit"
          role="group"
          aria-label={t('limit_' + key, { defaultValue: key })}
          key={key}
        >
          <div>
            <strong>{t('limit_' + key, { defaultValue: key })}</strong>
            <p>{t('limitHelp_' + key, { defaultValue: '' })}</p>
            <small>
              {t('platformDefault', { value: format.format(snapshot.default_limits[key]) })}
            </small>
          </div>
          <div className="limit-value">
            <strong>{format.format(value)}</strong>
            <span>{t(overrides.has(key) ? 'customLimit' : 'inheritedLimit')}</span>
          </div>
          <div className="row-actions">
            <MutationDialog
              label="edit"
              title="updateLimit"
              method="put"
              url={'/api/admin/v1/workspaces/' + workspaceId + '/limits'}
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
              values={(input) => ({ ...input, key, value: Number(input.value) })}
            />
            {overrides.has(key) ? (
              <MutationDialog
                label="resetLimit"
                description="resetLimitDescription"
                method="delete"
                url={'/api/admin/v1/workspaces/' + workspaceId + '/limits/' + key}
                fields={[reason]}
              />
            ) : null}
          </div>
        </div>
      ))}
    </section>
  )
}
