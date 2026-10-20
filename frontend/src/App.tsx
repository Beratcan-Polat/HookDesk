import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Loading, NoticeProvider, Empty } from '@/components/common'
import '@/lib/i18n'
import Layout from '@/components/Layout'
const Landing = lazy(() => import('@/pages/Landing'))
const Auth = lazy(() => import('@/features/auth/Auth'))
const Docs = lazy(() => import('@/pages/Docs'))
const Invitation = lazy(() => import('@/pages/Invitation'))
const Overview = lazy(() =>
  import('@/features/events/Events').then((m) => ({ default: m.OverviewPage })),
)
const Events = lazy(() =>
  import('@/features/events/Events').then((m) => ({ default: m.EventsPage })),
)
const EventDetail = lazy(() =>
  import('@/features/events/Events').then((m) => ({ default: m.EventDetailPage })),
)
const DeliveryDetail = lazy(() =>
  import('@/features/events/Events').then((m) => ({ default: m.DeliveryDetailPage })),
)
const Projects = lazy(() => import('@/features/projects/Projects'))
const Endpoints = lazy(() => import('@/features/endpoints/Endpoints'))
const Sources = lazy(() => import('@/features/sources/Sources'))
const Keys = lazy(() => import('@/features/keys/Keys'))
const Team = lazy(() => import('@/features/team/Team'))
const Settings = lazy(() => import('@/features/settings/Settings'))
const Audit = lazy(() => import('@/features/audit/Audit'))
const AdminOverview = lazy(() =>
  import('@/features/admin/Admin').then((m) => ({ default: m.AdminOverview })),
)
const AdminList = lazy(() =>
  import('@/features/admin/Admin').then((m) => ({ default: m.AdminList })),
)
const AdminSettings = lazy(() =>
  import('@/features/admin/Admin').then((m) => ({ default: m.AdminSettings })),
)
const AdminHealth = lazy(() =>
  import('@/features/admin/Admin').then((m) => ({ default: m.AdminHealth })),
)
const AdminSupport = lazy(() =>
  import('@/features/admin/Admin').then((m) => ({ default: m.AdminSupport })),
)
const client = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
    mutations: { retry: false },
  },
})
export default function App() {
  return (
    <QueryClientProvider client={client}>
      <NoticeProvider>
        <BrowserRouter>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/docs" element={<Docs />} />
              {[
                'sign-in',
                'sign-up',
                'forgot-password',
                'reset-password',
                'two-factor',
                'verify-email',
              ].map((path) => (
                <Route key={path} path={'/' + path} element={<Auth />} />
              ))}
              <Route path="/invitations/:token" element={<Invitation />} />
              <Route path="/app" element={<Layout />}>
                <Route index element={<Overview />} />
                <Route path="projects" element={<Projects />} />
                <Route path="events" element={<Events />} />
                <Route path="events/:eventId" element={<EventDetail />} />
                <Route path="deliveries/:deliveryId" element={<DeliveryDetail />} />
                <Route path="endpoints" element={<Endpoints />} />
                <Route path="sources" element={<Sources />} />
                <Route path="keys" element={<Keys />} />
                <Route path="team" element={<Team />} />
                <Route path="settings" element={<Settings />} />
                <Route path="audit" element={<Audit />} />
                <Route path="admin">
                  <Route index element={<AdminOverview />} />
                  {(['users', 'workspaces', 'projects', 'events', 'deliveries'] as const).map(
                    (kind) => (
                      <Route
                        key={kind}
                        path={kind}
                        element={<AdminList key={kind} kind={kind} />}
                      />
                    ),
                  )}
                  <Route path="deliveries/:deliveryId" element={<DeliveryDetail admin />} />
                  <Route path="settings" element={<AdminSettings />} />
                  <Route path="health" element={<AdminHealth />} />
                  <Route path="support" element={<AdminSupport />} />
                  <Route path="audit" element={<Audit admin />} />
                </Route>
              </Route>
              <Route path="*" element={<Empty title="notFound" />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </NoticeProvider>
    </QueryClientProvider>
  )
}
