import { render, screen } from '@testing-library/react'
import { AdminNav } from './AdminNav'

const usePathnameMock = jest.fn<string, []>()
jest.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
}))

beforeEach(() => {
  usePathnameMock.mockReset()
})

describe('AdminNav', () => {
  it('renders both Overview and Setup TOTP links with correct hrefs', () => {
    usePathnameMock.mockReturnValue('/admin')
    render(<AdminNav />)
    const overview = screen.getByRole('link', { name: /overview/i })
    const setup = screen.getByRole('link', { name: /setup totp/i })
    expect(overview).toHaveAttribute('href', '/admin')
    expect(setup).toHaveAttribute('href', '/admin/setup-totp')
  })

  it('marks Overview active when pathname is /admin', () => {
    usePathnameMock.mockReturnValue('/admin')
    render(<AdminNav />)
    expect(screen.getByRole('link', { name: /overview/i })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: /setup totp/i })).not.toHaveAttribute('aria-current')
  })

  it('marks Setup TOTP active when pathname is /admin/setup-totp', () => {
    usePathnameMock.mockReturnValue('/admin/setup-totp')
    render(<AdminNav />)
    expect(screen.getByRole('link', { name: /setup totp/i })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: /overview/i })).not.toHaveAttribute('aria-current')
  })

  it('does NOT mark Overview active when pathname is a deeper /admin route', () => {
    usePathnameMock.mockReturnValue('/admin/setup-totp')
    render(<AdminNav />)
    // Overview should only match exact /admin, not prefix /admin/*
    expect(screen.getByRole('link', { name: /overview/i })).not.toHaveAttribute('aria-current')
  })

  it('renders as a <nav> landmark for accessibility', () => {
    usePathnameMock.mockReturnValue('/admin')
    render(<AdminNav />)
    expect(screen.getByRole('navigation', { name: /admin sections/i })).toBeInTheDocument()
  })
})
