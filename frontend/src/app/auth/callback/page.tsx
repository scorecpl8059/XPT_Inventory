'use client'

import { useEffect } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import { useRouter } from 'next/navigation'

export default function CallbackPage() {
  const { isAuthenticated, isLoading, error } = useAuth0()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    if (isAuthenticated) router.replace('/dashboard')
  }, [isAuthenticated, isLoading, router])

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center flex-col gap-4 p-8">
        <div className="rounded-lg border border-red-300 bg-red-50 p-6 max-w-lg w-full">
          <h2 className="font-semibold text-red-700 mb-2">Auth0 Error</h2>
          <p className="text-sm text-red-600 font-mono break-all">{error.message}</p>
          <p className="text-xs text-red-500 mt-2 font-mono">{(error as Error & { error?: string }).error}</p>
        </div>
        <button
          onClick={() => router.replace('/')}
          className="text-sm text-muted-foreground underline"
        >
          Back to home
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  )
}
