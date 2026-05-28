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
      <div style={{ minHeight: '100vh', background: '#050d1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #1a6fd4', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#050d1a', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      {/* Brand bar */}
      <div style={{
        width: '100%',
        padding: '12px 24px',
        fontSize: 14,
        fontWeight: 600,
        letterSpacing: '0.05em',
        color: '#e8f0fe',
        background: 'linear-gradient(135deg, #1a6fd4 0%, #0b1626 100%)',
        transform: slideIn ? 'translateX(0)' : 'translateX(-120%)',
        transition: 'transform 700ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      }}>
        XPT-Inventory
      </div>

      {/* Centred content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', gap: 24 }}>
        {/* Hero card */}
        <div style={{
          width: '100%',
          maxWidth: 720,
          transform: slideIn ? 'translateX(0)' : 'translateX(-120%)',
          transition: 'transform 700ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        }}>
          <section style={{
            background: 'linear-gradient(135deg, #1a6fd4 0%, #0b1626 100%)',
            borderRadius: 16,
            padding: '48px 40px',
            boxShadow: '0 20px 60px rgba(26,111,212,0.25)',
            border: '1px solid rgba(55,138,221,0.18)',
          }}>
            <h2 style={{ fontSize: 30, fontWeight: 700, color: '#ffffff', marginBottom: 16, letterSpacing: -0.5 }}>
              XPT-Inventory
            </h2>
            <p style={{ color: 'rgba(232,240,254,0.75)', fontSize: 15, lineHeight: 1.7, maxWidth: 480 }}>
              Product lifecycle management for small businesses<br />
              — from proposal to shelf, all in one platform.
            </p>
            <ul style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                'Product proposal workflow with approval chains',
                'Multi-location inventory tracking and stock alerts',
                'Role-based access for owners, managers, and staff',
              ].map(item => (
                <li key={item} style={{ fontSize: 13, color: 'rgba(55,138,221,0.9)', letterSpacing: '0.03em', listStyle: 'none' }}>
                  ✦ {item}
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Auth card */}
        <div style={{
          width: '100%',
          maxWidth: 720,
          background: 'rgba(11,22,38,0.8)',
          border: '1px solid rgba(55,138,221,0.18)',
          borderRadius: 12,
          padding: '20px 32px',
          backdropFilter: 'blur(8px)',
          opacity: showActions ? 1 : 0,
          transform: showActions ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 400ms ease-out, transform 400ms ease-out',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <p style={{ fontSize: 13, color: '#5a7499' }}>Already have an account?</p>
            <button
              onClick={() => loginWithRedirect({ appState: { returnTo: '/dashboard' } })}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                width: 128, flexShrink: 0, justifyContent: 'center',
                background: '#1a6fd4',
                color: '#fff', fontWeight: 600, fontSize: 13,
                padding: '9px 20px', borderRadius: 8, border: 'none',
                cursor: 'pointer', transition: 'background 0.2s',
                letterSpacing: '0.03em',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#378ADD')}
              onMouseLeave={e => (e.currentTarget.style.background = '#1a6fd4')}
            >
              Sign In
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div style={{ borderTop: '1px solid rgba(55,138,221,0.12)' }} />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <p style={{ fontSize: 13, color: '#5a7499' }}>New here? Create an account to get started.</p>
            <button
              onClick={() => loginWithRedirect({
                appState: { returnTo: '/dashboard' },
                authorizationParams: { screen_hint: 'signup' },
              })}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                width: 128, flexShrink: 0, justifyContent: 'center',
                background: 'transparent',
                color: '#5a7499', fontWeight: 600, fontSize: 13,
                padding: '9px 20px', borderRadius: 8,
                border: '1px solid rgba(55,138,221,0.25)',
                cursor: 'pointer', transition: 'border-color 0.2s, color 0.2s',
                letterSpacing: '0.03em',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#378ADD'; e.currentTarget.style.color = '#378ADD' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(55,138,221,0.25)'; e.currentTarget.style.color = '#5a7499' }}
            >
              Register
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, padding: '16px', fontSize: 11, color: '#5a7499', letterSpacing: '0.05em' }}>
        <span>&copy; {new Date().getFullYear()} XPT-Tech LLC</span>
        <span>&middot;</span>
        <span>All rights reserved</span>
      </div>
    </div>
  )
}
