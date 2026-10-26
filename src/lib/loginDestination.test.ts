import { describe, expect, it, vi } from 'vitest'
import { dashboardPathAfterLogin } from './loginDestination'

describe('dashboardPathAfterLogin', () => {
  it('always opens the dashboard and drops a leftover return path', () => {
    const removeItem = vi.fn()
    vi.stubGlobal('sessionStorage', { removeItem })
    expect(dashboardPathAfterLogin()).toBe('/')
    expect(removeItem).toHaveBeenCalledWith('newport_post_login_path')
  })
})
