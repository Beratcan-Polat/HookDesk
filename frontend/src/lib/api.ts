import axios from 'axios'
import i18n from './i18n'
export const api = axios.create({
  baseURL: '/',
  withCredentials: true,
  withXSRFToken: true,
  headers: { Accept: 'application/json' },
})
api.interceptors.request.use((config) => {
  config.headers.set('X-Locale', i18n.language)
  return config
})
export async function csrf() {
  await api.get('/sanctum/csrf-cookie')
}
export async function get<T>(url: string): Promise<T> {
  return (await api.get<T>(url)).data
}
export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as
      { message?: string; errors?: Record<string, string[]> } | undefined
    if (body?.errors) return Object.values(body.errors).flat().join(' ')
    return (
      body?.message || (error.response?.status === 419 ? 'session_expired' : 'connection_error')
    )
  }
  return error instanceof Error ? error.message : 'unexpected_error'
}
