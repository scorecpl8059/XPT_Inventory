'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth0 } from '@auth0/auth0-react'

export default function HomePage() {
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0()
  const router = useRouter()
  const [slideIn, setSlideIn] = useState(false)
  const [showActions, setShowActions] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setSlideIn(true), 50)
    const t2 = setTimeout(() => setShowActions(true), 800)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/dashboard')
    }
  }, [isLoading, isAuthenticated, router])

  if (isLoading || isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col overflow-y-auto">
      {/* Brand bar */}
      <div
        className="w-full px-6 py-3 text-white text-sm font-semibold tracking-wide"
        style={{
          background: 'linear-gradient(135deg, #0F766E 0%, #115E59 100%)',
          transform: slideIn ? 'translateX(0)' : 'translateX(-120%)',
          transition: 'transform 700ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        }}
      >
        XPT-Inventory
      </div>

      {/* Centred content */}
      <div className="flex flex-col items-center justify-center flex-1 px-6 gap-6 py-10">
        <div
          className="w-full max-w-[720px] sm:w-[70%]"
          style={{
            transform: slideIn ? 'translateX(0)' : 'translateX(-120%)',
            transition: 'transform 700ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          }}
        >
          <section
            className="text-white rounded-2xl px-10 py-12 shadow-xl"
            style={{ background: 'linear-gradient(135deg, #0F766E 0%, #115E59 100%)' }}
          >
            <h2 className="text-3xl font-bold mb-6">XPT-Inventory</h2>
            <p className="text-teal-100 text-base leading-relaxed max-w-xl">
              Product lifecycle management for small businesses<br />
              — from proposal to shelf, all in one platform.
            </p>
            <ul className="mt-5 space-y-1 text-sm text-teal-200">
              <li>&#10022; Product proposal workflow with approval chains</li>
              <li>&#10022; Multi-location inventory tracking and stock alerts</li>
              <li>&#10022; Role-based access for owners, managers, and staff</li>
            </ul>
          </section>
        </div>

        {/* Login / Register */}
        <div
          className="w-full max-w-[720px] sm:w-[70%] bg-white rounded-xl px-6 sm:px-8 py-5 shadow-sm space-y-3 mt-6"
          style={{
            opacity: showActions ? 1 : 0,
            transform: showActions ? 'translateY(0)' : 'translateY(8px)',
            transition: 'opacity 400ms ease-out, transform 400ms ease-out',
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-gray-500">Already have an account?</p>
            <button
              onClick={() => loginWithRedirect({ appState: { returnTo: '/dashboard' } })}
              className="inline-flex items-center justify-center gap-2 w-32 shrink-0 bg-teal-700 hover:bg-teal-900 text-white font-semibold text-sm px-5 py-2 rounded-lg shadow transition-colors"
            >
              Sign In
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
          <div className="border-t border-gray-100" />
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-gray-500">New here? Create an account to get started.</p>
            <button
              onClick={() => loginWithRedirect({
                appState: { returnTo: '/dashboard' },
                authorizationParams: { screen_hint: 'signup' },
              })}
              className="inline-flex items-center justify-center gap-2 w-32 shrink-0 bg-teal-700 hover:bg-teal-900 text-white font-semibold text-sm px-5 py-2 rounded-lg shadow transition-colors"
            >
              Register
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>
      </div>

      <div className="flex justify-center gap-4 py-4 text-xs text-gray-400">
        <span>&copy; {new Date().getFullYear()} XPT-Tech LLC</span>
        <span>&middot;</span>
        <span>All rights reserved</span>
      </div>
    </div>
  )
}
