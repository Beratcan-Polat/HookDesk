import { describe, it, expect } from 'vitest'
import { AxiosError, AxiosHeaders } from 'axios'
import { errorMessage } from './api'
describe('API error reporting', () => {
  it('preserves field validation errors', () => {
    const error = new AxiosError('validation', 'ERR_BAD_REQUEST', undefined, undefined, {
      data: { errors: { name: ['Name is required.'] } },
      status: 422,
      statusText: 'Unprocessable',
      headers: {},
      config: { headers: new AxiosHeaders() },
    })
    expect(errorMessage(error)).toBe('Name is required.')
  })
  it('uses a stable fallback for unknown errors', () => {
    expect(errorMessage(null)).toBe('unexpected_error')
  })
})
