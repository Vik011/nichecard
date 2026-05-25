/** @jest-environment jsdom */
import { renderHook, act } from '@testing-library/react'
import { useDailyFreeModal } from './useDailyFreeModal'
import { DAILY_MODAL_COOKIE_NAME } from './dailyModalCookie'

function clearCookies() {
  document.cookie = `${DAILY_MODAL_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
}

describe('useDailyFreeModal', () => {
  beforeEach(() => {
    clearCookies()
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2099-06-15T14:00:00Z'))
  })
  afterEach(() => {
    clearCookies()
    jest.useRealTimers()
  })

  it('returns shouldOpen=false while user loading', () => {
    const { result } = renderHook(() =>
      useDailyFreeModal({ tier: 'free', userLoading: true, isLoggedIn: true, todayPinId: 'sr-1' }),
    )
    expect(result.current.shouldOpen).toBe(false)
  })

  it('returns shouldOpen=false for premium', () => {
    const { result } = renderHook(() =>
      useDailyFreeModal({ tier: 'premium', userLoading: false, isLoggedIn: true, todayPinId: 'sr-1' }),
    )
    expect(result.current.shouldOpen).toBe(false)
  })

  it('returns shouldOpen=false for basic', () => {
    const { result } = renderHook(() =>
      useDailyFreeModal({ tier: 'basic', userLoading: false, isLoggedIn: true, todayPinId: 'sr-1' }),
    )
    expect(result.current.shouldOpen).toBe(false)
  })

  it('returns shouldOpen=false when pin is null', () => {
    const { result } = renderHook(() =>
      useDailyFreeModal({ tier: 'free', userLoading: false, isLoggedIn: true, todayPinId: null }),
    )
    expect(result.current.shouldOpen).toBe(false)
  })

  it('returns shouldOpen=false for anonymous (isLoggedIn=false)', () => {
    const { result } = renderHook(() =>
      useDailyFreeModal({ tier: 'free', userLoading: false, isLoggedIn: false, todayPinId: 'sr-1' }),
    )
    expect(result.current.shouldOpen).toBe(false)
  })

  it('returns shouldOpen=true for free + pin + no cookie', () => {
    const { result } = renderHook(() =>
      useDailyFreeModal({ tier: 'free', userLoading: false, isLoggedIn: true, todayPinId: 'sr-1' }),
    )
    expect(result.current.shouldOpen).toBe(true)
  })

  it('returns shouldOpen=false when cookie already set for today', () => {
    document.cookie = `${DAILY_MODAL_COOKIE_NAME}=2099-06-15; path=/`
    const { result } = renderHook(() =>
      useDailyFreeModal({ tier: 'free', userLoading: false, isLoggedIn: true, todayPinId: 'sr-1' }),
    )
    expect(result.current.shouldOpen).toBe(false)
  })

  it('returns shouldOpen=true when cookie has yesterday', () => {
    document.cookie = `${DAILY_MODAL_COOKIE_NAME}=2099-06-14; path=/`
    const { result } = renderHook(() =>
      useDailyFreeModal({ tier: 'free', userLoading: false, isLoggedIn: true, todayPinId: 'sr-1' }),
    )
    expect(result.current.shouldOpen).toBe(true)
  })

  it('markSeen() flips shouldOpen to false on next render', () => {
    const { result, rerender } = renderHook(
      ({ pin }) => useDailyFreeModal({ tier: 'free', userLoading: false, isLoggedIn: true, todayPinId: pin }),
      { initialProps: { pin: 'sr-1' as string | null } },
    )
    expect(result.current.shouldOpen).toBe(true)

    act(() => {
      result.current.markSeen()
    })

    rerender({ pin: 'sr-1' })
    expect(result.current.shouldOpen).toBe(false)
    expect(document.cookie).toContain(`${DAILY_MODAL_COOKIE_NAME}=2099-06-15`)
  })
})
