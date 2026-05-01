'use client'

import { useEffect, useState } from 'react'
import type { Lang } from '@/components/landing/copy'

const STORAGE_KEY = 'ns-lang'

function readStored(): Lang {
  if (typeof window === 'undefined') return 'en'
  const raw = window.localStorage.getItem(STORAGE_KEY)
  return raw === 'de' ? 'de' : 'en'
}

export function useLang(): [Lang, (next: Lang) => void] {
  const [lang, setLangState] = useState<Lang>('en')

  useEffect(() => {
    setLangState(readStored())
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) setLangState(readStored())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  function setLang(next: Lang) {
    setLangState(next)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, next)
    }
  }

  return [lang, setLang]
}
