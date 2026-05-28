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
    if (error) router.replace('/')
  }, [isAuthenticated, isLoading, error, router])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  )
}
