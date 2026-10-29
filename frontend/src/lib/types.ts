export interface User {
  id: string
  name: string
  email: string
  platform_role: 'user' | 'super_admin'
  status: string
  locale: 'tr' | 'en'
  email_verified_at: string | null
  two_factor_confirmed_at: string | null
}
export interface Project {
  id: string
  workspace_id: string
  name: string
  description: string | null
  suspended: boolean
  archived_at: string | null
}
export interface Workspace {
  id: string
  name: string
  owner_user_id: string
  role: 'owner' | 'admin' | 'developer' | 'viewer'
  projects: Project[]
  blocked: boolean
  suspended: boolean
  archived_at: string | null
}
export interface WorkspaceMember {
  id: string
  role: 'owner' | 'admin' | 'developer' | 'viewer'
  user: Pick<User, 'id' | 'name' | 'email' | 'status' | 'email_verified_at'>
}
export interface Endpoint {
  id: string
  name: string
  url: string | null
  kind: 'https' | 'sandbox'
  paused: boolean
  sandbox_behavior: string
  subscriptions: { event_type: string }[]
}
export interface Source {
  id: string
  name: string
  event_type: string
  mode: string
  enabled: boolean
}
export interface EventItem {
  id: string
  type: string
  project_id: string
  producer: string
  routing_result: string
  created_at: string
  deliveries_count: number
}
export interface Attempt {
  id: string
  number: number
  outcome: string
  http_status: number | null
  duration_ms: number | null
  response_truncated: boolean
  error_code: string | null
  created_at: string
  finished_at: string | null
}
export interface Delivery {
  id: string
  event_id: string
  status: string
  target_url: string
  attempt_count: number
  last_error: string | null
  next_attempt_at: string
  created_at: string
  expires_at: string
  endpoint: { id: string; name: string; kind: string }
  event?: EventItem
  attempts?: Attempt[]
  replay_of_delivery_id: string | null
}
export interface SupportSession {
  id: string
  actor_id: string
  user_id: string
  workspace_id: string
  reason: string
  expires_at: string | null
  created_at: string
  revoked_at: string | null
  user: Pick<User, 'id' | 'name' | 'email'>
  workspace: { id: string; name: string }
}
export interface Envelope<T> {
  data: T
}
export interface Page<T> {
  data: T[]
  meta?: { current_page: number; last_page: number; total: number }
  current_page?: number
  last_page?: number
  total?: number
}
export type Row = Record<string, unknown> & { id: string }
