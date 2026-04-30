'use client'

import { useState } from 'react'

export function ManageSubscriptionButton() {
  const [loading, setLoading] = useState(false)

  async function open() {
    setLoading(true)
    const resp = await fetch('/api/stripe/portal', { method: 'POST' })
    if (resp.ok) {
      const data = await resp.json()
      if (data?.url) window.location.href = data.url
    } else {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={open}
      disabled={loading}
      className="block text-xs text-slate-400 hover:text-slate-200 mt-1.5 disabled:opacity-50"
    >
      {loading ? 'Opening…' : 'Manage subscription'}
    </button>
  )
}
