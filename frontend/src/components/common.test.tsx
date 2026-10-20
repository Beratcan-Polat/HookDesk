import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Status, JsonView, Empty } from './common'
import '@/lib/i18n'
describe('operational UI', () => {
  it('renders JSON as text without executing markup', () => {
    render(<JsonView value={{ data: '<script>danger()</script>' }} />)
    expect(screen.getByText(/<script>danger/)).toBeInTheDocument()
    expect(document.querySelector('script')).toBeNull()
  })
  it('pairs statuses with readable text', () => {
    render(<Status value="succeeded" />)
    expect(screen.getByText('Succeeded')).toBeInTheDocument()
  })
  it('renders a useful empty state', () => {
    render(<Empty />)
    expect(screen.getByRole('heading')).toBeInTheDocument()
  })
})
