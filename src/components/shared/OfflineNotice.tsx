import { useEffect, useState } from 'react'

export function OfflineNotice() {
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false)

  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  if (!offline) return null
  return (
    <p className="bg-[#3d2a08] px-4 py-2 text-center text-xs text-[#ffe7b3]">
      You are offline. Saved dashboard data on this device still opens. Microsoft sign-in and cloud meetings need a connection.
    </p>
  )
}
