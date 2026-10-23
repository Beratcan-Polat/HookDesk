import SupportStartButton from '@/features/support/SupportStart'
import SupportAccess from '@/features/support/SupportAccess'
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  Webhook,
  LayoutDashboard,
  Layers,
  Radio,
  ArrowDownToLine,
  KeyRound,
  Users,
  Settings,
  FileClock,
  BookOpen,
  Shield,
  Activity,
  LifeBuoy,
  LogOut,
  Menu,
  ChevronRight,
  X,
} from 'lucide-react'
import { useMe, useLogout, LanguageSwitch } from '@/features/auth/Auth'
import { get, api } from '@/lib/api'
import type { User, Workspace, Project, Envelope, SupportSession } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Loading, Failure, Empty, MutationDialog } from '@/components/common'
interface ScopeValue {
  user: User
  workspaces: Workspace[]
  workspace: Workspace | undefined
  project: Project | undefined
  prefix: string
  supportId: string | null
  supportSession: SupportSession | undefined
  canWrite: boolean
  canManage: boolean
  query: string
}
const Scope = createContext<ScopeValue | null>(null)
export function useScope() {
  const value = useContext(Scope)
  if (!value) throw new Error('Scope missing')
  return value
}
export function AppLink({
  to,
  children,
  className,
}: {
  to: string
  children: ReactNode
  className?: string
}) {
  const { query } = useScope()
  const [pathname, search] = to.split('?')
  const merged = new URLSearchParams(query)
  new URLSearchParams(search).forEach((value, key) => merged.set(key, value))
  return (
    <Link className={className} to={{ pathname, search: '?' + merged.toString() }}>
      {children}
    </Link>
  )
}
function SupportBanner({ session }: { session: SupportSession }) {
  const { t } = useTranslation()
  const [remaining, setRemaining] = useState(0)
  const [params, setParams] = useSearchParams()
  const qc = useQueryClient()
  useEffect(() => {
    const tick = () =>
      setRemaining(
        Math.max(0, Math.floor((new Date(session.expires_at).getTime() - Date.now()) / 1000)),
      )
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [session.expires_at])
  async function end() {
    try {
      await api.delete('/api/admin/v1/support-sessions/' + session.id)
    } finally {
      params.delete('support')
      params.delete('w')
      params.delete('p')
      setParams(params)
      await qc.invalidateQueries()
    }
  }
  return (
    <div className="support-banner">
      <LifeBuoy size={18} />
      <span>
        {t('supportBand')} <strong>{session.user.name}</strong> · {Math.floor(remaining / 60)}:
        {String(remaining % 60).padStart(2, '0')}
      </span>
      <Button size="sm" variant="outline" onClick={() => void end()}>
        {t('endSupport')}
      </Button>
    </div>
  )
}
const links = [
  ['/app', 'overview', LayoutDashboard],
  ['/app/projects', 'projects', Layers],
  ['/app/events', 'events', Radio],
  ['/app/endpoints', 'endpoints', Webhook],
  ['/app/sources', 'sources', ArrowDownToLine],
  ['/app/keys', 'keys', KeyRound],
  ['/app/team', 'team', Users],
  ['/app/audit', 'audit', FileClock],
  ['/app/settings', 'settings', Settings],
] as const
const adminLinks = [
  ['/app/admin', 'overview', Shield],
  ['/app/admin/users', 'users', Users],
  ['/app/admin/workspaces', 'workspaces', Layers],
  ['/app/admin/projects', 'projects', Layers],
  ['/app/admin/events', 'events', Radio],
  ['/app/admin/deliveries', 'deliveries', Webhook],
  ['/app/admin/health', 'health', Activity],
  ['/app/admin/support', 'support', LifeBuoy],
  ['/app/admin/settings', 'settings', Settings],
  ['/app/admin/audit', 'audit', FileClock],
] as const
export default function Layout() {
  const me = useMe()
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const supportId = params.get('support')
  const prefix = supportId ? '/api/support/v1/sessions/' + supportId : '/api/dashboard/v1'
  const workspaces = useQuery({
    queryKey: ['workspaces', supportId],
    queryFn: () => get<Envelope<Workspace[]>>(prefix + '/workspaces'),
    enabled: !!me.data?.data.email_verified_at,
    retry: supportId ? false : undefined,
  })
  const sessions = useQuery({
    queryKey: ['supportSessions', supportId],
    queryFn: () => get<Envelope<SupportSession[]>>('/api/admin/v1/support-sessions'),
    enabled: !!supportId && me.data?.data.platform_role === 'super_admin',
    refetchInterval: supportId ? 5000 : false,
    retry: false,
  })
  const workspace =
    workspaces.data?.data.find((w) => w.id === params.get('w')) ?? workspaces.data?.data[0]
  const project =
    workspace?.projects.find((p) => p.id === params.get('p')) ??
    workspace?.projects.find((p) => !p.archived_at)
  const session = sessions.data?.data.find((s) => s.id === supportId)
  const location = useLocation()
  const admin = location.pathname.startsWith('/app/admin')
  const logout = useLogout()
  const [mobile, setMobile] = useState(false)
  const query = new URLSearchParams(params)
  if (workspace) query.set('w', workspace.id)
  if (project) query.set('p', project.id)
  if (me.isPending) return <Loading />
  if (me.isError) return <Navigate to="/sign-in" replace />
  if (!me.data?.data.email_verified_at) return <Navigate to="/verify-email" replace />
  const user = me.data.data
  if (admin && (user.platform_role !== 'super_admin' || supportId))
    return <Navigate to={'/app?' + query.toString()} replace />
  const canWrite =
    !!workspace &&
    !workspace.blocked &&
    ['owner', 'admin', 'developer'].includes(workspace.role) &&
    !project?.suspended &&
    !project?.archived_at
  const canManage = !!workspace && ['owner', 'admin'].includes(workspace.role)
  return (
    <SupportAccess
      enabled={!!supportId}
      session={session}
      pending={sessions.isPending}
      error={sessions.error || workspaces.error}
    >
      <Scope.Provider
        value={{
          user,
          workspaces: workspaces.data?.data ?? [],
          workspace,
          project,
          prefix,
          supportId,
          supportSession: session,
          canWrite,
          canManage,
          query: '?' + query.toString(),
        }}
      >
        <div className="app-shell">
          <aside className={'sidebar ' + (mobile ? 'mobile-open' : '')}>
            <div className="sidebar-top">
              <Link className="brand" to="/">
                <Webhook size={24} />
                HookDesk
              </Link>
              <button
                className="mobile-close"
                aria-label={t('close')}
                onClick={() => setMobile(false)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="workspace-picker">
              <label htmlFor="workspace-select">{t('workspace')}</label>
              <select
                id="workspace-select"
                value={workspace?.id ?? ''}
                onChange={(e) => {
                  params.set('w', e.target.value)
                  params.delete('p')
                  setParams(params)
                }}
              >
                {(workspaces.data?.data ?? []).map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="nav-label">{t(admin ? 'admin' : 'operations')}</div>
            <nav aria-label={t('menu')}>
              {(admin ? adminLinks : links)
                .filter(
                  ([, key]) => !supportId || !['keys', 'team', 'settings', 'audit'].includes(key),
                )
                .map(([path, key, Icon]) => (
                  <NavLink
                    key={path}
                    end={path === '/app' || path === '/app/admin'}
                    to={{ pathname: path, search: '?' + query.toString() }}
                    onClick={() => setMobile(false)}
                  >
                    <Icon size={17} />
                    {t(key)}
                  </NavLink>
                ))}
            </nav>
            <div className="sidebar-bottom">
              <Link to="/docs">
                <BookOpen size={17} />
                {t('docs')}
              </Link>
              {user.platform_role === 'super_admin' && !supportId ? (
                <AppLink to={admin ? '/app' : '/app/admin'}>
                  <Shield size={17} />
                  {t(admin ? 'workspace' : 'admin')}
                </AppLink>
              ) : null}
              <div className="user-chip">
                <span className="avatar">{user.name.slice(0, 2).toUpperCase()}</span>
                <div>
                  <strong>{user.name}</strong>
                  <small>{user.email}</small>
                </div>
                <button onClick={() => void logout()} aria-label={t('signOut')}>
                  <LogOut size={16} />
                </button>
              </div>
            </div>
          </aside>
          <div className="main-column">
            <header className="app-header">
              <div>
                <button
                  className="mobile-menu"
                  aria-label={t('menu')}
                  onClick={() => setMobile(true)}
                >
                  <Menu size={20} />
                </button>
                <span>{admin ? t('admin') : workspace?.name || 'HookDesk'}</span>
                <ChevronRight size={14} />
                {!admin ? (
                  <select
                    aria-label={t('project')}
                    value={project?.id ?? ''}
                    onChange={(e) => {
                      params.set('p', e.target.value)
                      setParams(params)
                    }}
                  >
                    <option value="">{t('selectProject')}</option>
                    {workspace?.projects
                      .filter((p) => !p.archived_at)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                ) : (
                  <span>{t('operations')}</span>
                )}
              </div>
              <LanguageSwitch />
            </header>
            {session ? <SupportBanner session={session} /> : null}
            <main className="main-content">
              {!admin && workspace?.blocked ? (
                <div className="blocked-banner">{t('blocked')}</div>
              ) : null}
              {workspaces.isError && !admin ? (
                <Failure error={workspaces.error} retry={() => void workspaces.refetch()} />
              ) : workspaces.isPending && !admin ? (
                <Loading />
              ) : !workspace && !admin ? (
                <Empty title="firstWorkspace" body="firstWorkspaceBody">
                  <MutationDialog
                    label="newWorkspace"
                    url="/api/dashboard/v1/workspaces"
                    fields={[{ name: 'name', label: 'name', required: true }]}
                    variant="default"
                  />
                </Empty>
              ) : (
                <Outlet />
              )}
            </main>
            <footer className="app-footer">
              <span>HookDesk</span>
              <span>Webhook operations</span>
            </footer>
          </div>
        </div>
      </Scope.Provider>
    </SupportAccess>
  )
}
export function RequireProject({ children }: { children: ReactNode }) {
  const { workspace, project, prefix, canWrite } = useScope()
  if (!project)
    return (
      <Empty title="noProject" body="noProjectBody">
        {workspace && canWrite ? (
          <MutationDialog
            label="newProject"
            url={prefix + '/workspaces/' + workspace.id + '/projects'}
            fields={[
              { name: 'name', label: 'name', required: true },
              { name: 'description', label: 'description', type: 'textarea' },
            ]}
            variant="default"
          />
        ) : null}
      </Empty>
    )
  return <>{children}</>
}
export function NewProjectButton() {
  const { workspace, prefix, canWrite } = useScope()
  return (
    <MutationDialog
      label="newProject"
      url={prefix + '/workspaces/' + workspace?.id + '/projects'}
      fields={[
        { name: 'name', label: 'name', required: true },
        { name: 'description', label: 'description', type: 'textarea' },
      ]}
      disabled={!canWrite}
      variant="default"
    />
  )
}
export function ProjectPath() {
  const { project } = useScope()
  return project?.id || ''
}
export function AdminStepUp() {
  return (
    <MutationDialog
      label="stepUp"
      description="stepUpDescription"
      url="/api/admin/v1/step-up"
      fields={[
        { name: 'password', label: 'password', type: 'password', required: true },
        { name: 'code', label: 'code', required: true },
      ]}
    />
  )
}
export function SupportStart(props: { userId?: string; workspaceId?: string }) {
  return <SupportStartButton {...props} />
}
