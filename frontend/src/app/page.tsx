'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth0 } from '@auth0/auth0-react'

export default function HomePage() {
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0()
  const router = useRouter()
  const [slideIn, setSlideIn] = useState(false)
  const [showActions, setShowActions] = useState(false)
  const redirected = useRef(false)

  useEffect(() => {
    const t1 = setTimeout(() => setSlideIn(true), 50)
    const t2 = setTimeout(() => setShowActions(true), 800)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  useEffect(() => {
    if (!isLoading && isAuthenticated && !redirected.current) {
      redirected.current = true
      router.replace('/dashboard')
    }
  }, [isLoading, isAuthenticated, router])

  if (isLoading || isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Brand bar */}
      <div style={{
        width: '100%',
        background: 'linear-gradient(135deg, #312e81 0%, #5b21b6 100%)',
        padding: '2rem',
        boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'center',
        transform: slideIn ? 'translateX(0)' : 'translateX(-120%)',
        transition: 'transform 700ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          {/* Logo */}
          <svg width="58" height="58" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="invGrad" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#6366F1" />
                <stop offset="100%" stopColor="#8B5CF6" />
              </linearGradient>
              <clipPath id="invClip">
                <rect width="44" height="44" rx="10" />
              </clipPath>
            </defs>
            <rect width="44" height="44" rx="10" fill="url(#invGrad)" />
            {/* Box / inventory icon */}
            <rect x="10" y="20" width="24" height="16" rx="2" fill="white" opacity="0.9" />
            <rect x="10" y="14" width="24" height="7" rx="2" fill="white" opacity="0.6" />
            <rect x="18" y="14" width="8" height="7" rx="1" fill="white" opacity="0.9" />
            <rect x="16" y="24" width="12" height="2" rx="1" fill="url(#invGrad)" opacity="0.8" />
            <g clipPath="url(#invClip)">
              <rect x="34" y="14.5" width="12" height="2.5" rx="1.25" fill="white" opacity=".4" />
              <rect x="37" y="19.5" width="10" height="2" rx="1" fill="white" opacity=".25" />
            </g>
          </svg>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
            <span style={{ color: '#ffffff', fontWeight: 700, fontSize: '1.75rem', letterSpacing: '0.02em' }}>XPT-Tech</span>
            <span style={{ color: '#a5b4fc', fontWeight: 400, fontSize: '1rem' }}>Inventory Management</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col items-center justify-center flex-1 px-6 gap-6">
        {/* Hero card */}
        <div style={{
          width: '70%',
          transform: slideIn ? 'translateX(0)' : 'translateX(-120%)',
          transition: 'transform 700ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        }}>
          <section
            className="text-white rounded-2xl px-10 py-12 shadow-xl"
            style={{ background: 'linear-gradient(135deg, #312e81 0%, #5b21b6 100%)' }}
          >
            <h2 className="text-3xl font-bold mb-4">XPT-Inventory</h2>
            <p className="text-indigo-100 text-base leading-relaxed max-w-xl mb-2">
              A product lifecycle management platform for small businesses — manage proposals,
              products, and multi-location inventory all in one place. Streamline your operations
              from product idea to shelf with role-based access and real-time stock tracking.
            </p>
            <ul className="mt-5 space-y-1 text-sm text-indigo-200">
              <li>✦ Product proposal workflow with approval chains</li>
              <li>✦ Multi-location inventory tracking and low-stock alerts</li>
              <li>✦ Role-based access for owners, managers, and staff</li>
              <li>✦ In-app support ticket system</li>
            </ul>
          </section>
        </div>

        {/* Auth card */}
        <div
          className="bg-white rounded-xl px-8 py-5 shadow-sm space-y-3"
          style={{
            width: '70%',
            opacity: showActions ? 1 : 0,
            transform: showActions ? 'translateY(0)' : 'translateY(8px)',
            transition: 'opacity 400ms ease-out, transform 400ms ease-out',
            marginTop: '1.5rem',
          }}
        >
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Already have an account?</p>
            <button
              onClick={() => loginWithRedirect({ appState: { returnTo: '/dashboard' } })}
              className="inline-flex items-center justify-center gap-2 w-32 text-white font-semibold text-sm px-5 py-2 rounded-lg shadow transition-colors hover:bg-indigo-700"
              style={{ backgroundColor: '#4338ca' }}
            >
              Sign In
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <div className="border-t border-gray-100" />
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">New here? Create an account to get started.</p>
            <button
              onClick={() => loginWithRedirect({
                appState: { returnTo: '/dashboard' },
                authorizationParams: { screen_hint: 'signup' },
              })}
              className="inline-flex items-center justify-center gap-2 w-32 text-white font-semibold text-sm px-5 py-2 rounded-lg shadow transition-colors hover:bg-indigo-700"
              style={{ backgroundColor: '#4338ca' }}
            >
              Register
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
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
