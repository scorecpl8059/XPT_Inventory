'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth0 } from '@auth0/auth0-react'

export default function HomePage() {
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0()
  const router = useRouter()
  const redirected = useRef(false)

  useEffect(() => {
    if (!isLoading && isAuthenticated && !redirected.current) {
      redirected.current = true
      router.replace('/dashboard')
    }
  }, [isLoading, isAuthenticated, router])

  if (isLoading || isAuthenticated) {
    return (
      <div style={{
        height: '100vh',
        background: '#050d1a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          width: 32, height: 32,
          borderRadius: '50%',
          border: '3px solid #1a6fd4',
          borderTopColor: 'transparent',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --blue:       #1a6fd4;
          --blue-light: #378ADD;
          --blue-dim:   rgba(26,111,212,0.12);
          --dark:       #050d1a;
          --dark2:      #0b1626;
          --text:       #e8f0fe;
          --muted:      #5a7499;
          --border:     rgba(55,138,221,0.18);
        }

        html, body { height: 100%; overflow: hidden; }

        .inv-page {
          height: 100vh;
          background: var(--dark);
          color: var(--text);
          font-family: var(--font-dm-mono), 'DM Mono', monospace;
          overflow: hidden;
          position: relative;
        }

        /* animated grid */
        .inv-page::before {
          content: '';
          position: fixed;
          inset: 0;
          background-image:
            linear-gradient(var(--border) 1px, transparent 1px),
            linear-gradient(90deg, var(--border) 1px, transparent 1px);
          background-size: 60px 60px;
          animation: gridDrift 6s linear infinite;
          pointer-events: none;
          z-index: 0;
        }

        @keyframes gridDrift {
          0%   { background-position: 0 0; }
          100% { background-position: 60px 60px; }
        }

        /* radial glow */
        .inv-page::after {
          content: '';
          position: fixed;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 700px; height: 700px;
          background: radial-gradient(ellipse at center, rgba(26,111,212,0.18) 0%, transparent 70%);
          pointer-events: none;
          z-index: 0;
          animation: pulse 6s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.6; transform: translate(-50%,-50%) scale(1); }
          50%       { opacity: 1;   transform: translate(-50%,-50%) scale(1.1); }
        }

        .container {
          position: relative;
          z-index: 1;
          height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          text-align: center;
        }

        .wordmark {
          font-family: var(--font-syne), 'Syne', sans-serif;
          font-size: clamp(52px, 10vw, 96px);
          font-weight: 800;
          letter-spacing: -2px;
          line-height: 1;
          opacity: 0;
          animation: fadeUp 0.8s 0.4s ease forwards;
        }
        .wordmark .xpt   { color: #ffffff; }
        .wordmark .dash  { color: var(--blue-light); }
        .wordmark .inv   { color: var(--blue); font-weight: 400; }

        .tagline {
          margin-top: 16px;
          font-size: 11px;
          letter-spacing: 4px;
          color: var(--muted);
          text-transform: uppercase;
          opacity: 0;
          animation: fadeUp 0.8s 0.6s ease forwards;
        }

        .divider {
          margin: 40px auto;
          width: 1px; height: 48px;
          background: linear-gradient(to bottom, transparent, var(--blue-light), transparent);
          opacity: 0;
          animation: fadeUp 0.8s 0.7s ease forwards;
        }

        .status-bar {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(11,22,38,0.8);
          border: 1px solid var(--border);
          border-radius: 100px;
          padding: 10px 24px;
          font-size: 13px;
          letter-spacing: 3px;
          color: var(--muted);
          backdrop-filter: blur(8px);
          opacity: 0;
          margin-bottom: 24px;
          animation: fadeUp 0.6s 0.7s ease forwards;
        }

        .dot {
          width: 9px; height: 9px;
          border-radius: 50%;
          background: #22c55e;
          animation: blink 2s ease-in-out infinite;
        }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }

        .headline {
          font-family: var(--font-syne), 'Syne', sans-serif;
          font-size: clamp(18px, 3.5vw, 28px);
          font-weight: 700;
          color: var(--text);
          letter-spacing: -0.5px;
          opacity: 0;
          animation: fadeUp 0.8s 0.8s ease forwards;
        }
        .headline .accent { color: var(--blue-light); }

        .sub {
          margin-top: 14px;
          font-size: 13px;
          color: var(--muted);
          letter-spacing: 0.5px;
          line-height: 1.7;
          max-width: 480px;
          opacity: 0;
          animation: fadeUp 0.8s 1s ease forwards;
        }

        .auth-actions {
          margin-top: 40px;
          display: flex;
          gap: 12px;
          opacity: 0;
          animation: fadeUp 0.8s 1.2s ease forwards;
        }

        .btn-primary {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--blue);
          border: none;
          border-radius: 8px;
          padding: 13px 28px;
          font-family: var(--font-syne), 'Syne', sans-serif;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 1.5px;
          color: #fff;
          cursor: pointer;
          text-transform: uppercase;
          transition: background 0.2s, box-shadow 0.2s;
        }
        .btn-primary:hover {
          background: var(--blue-light);
          box-shadow: 0 0 20px rgba(55,138,221,0.3);
        }

        .btn-outline {
          display: flex;
          align-items: center;
          gap: 8px;
          background: transparent;
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 13px 28px;
          font-family: var(--font-syne), 'Syne', sans-serif;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 1.5px;
          color: var(--muted);
          cursor: pointer;
          text-transform: uppercase;
          transition: border-color 0.2s, color 0.2s;
          backdrop-filter: blur(8px);
        }
        .btn-outline:hover {
          border-color: var(--blue-light);
          color: var(--blue-light);
        }

        .services {
          margin-top: 48px;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: center;
          max-width: 560px;
          opacity: 0;
          animation: fadeUp 0.8s 1.4s ease forwards;
        }

        .pill {
          display: flex;
          align-items: center;
          gap: 6px;
          background: var(--blue-dim);
          border: 1px solid var(--border);
          border-radius: 100px;
          padding: 6px 14px;
          font-size: 10px;
          letter-spacing: 1.5px;
          color: var(--blue-light);
          text-transform: uppercase;
        }

        .pill-dot {
          width: 4px; height: 4px;
          border-radius: 50%;
          background: var(--blue-light);
          opacity: 0.6;
        }

        .domain {
          position: fixed;
          bottom: 28px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 11px;
          letter-spacing: 2px;
          color: var(--muted);
          opacity: 0;
          animation: fadeUp 0.8s 1.5s ease forwards;
        }
        .domain span { color: var(--blue-light); }

        .corner {
          position: fixed;
          width: 40px; height: 40px;
          opacity: 0.3;
        }
        .corner-tl { top: 20px; left: 20px; border-top: 1px solid var(--blue-light); border-left: 1px solid var(--blue-light); }
        .corner-br { bottom: 20px; right: 20px; border-bottom: 1px solid var(--blue-light); border-right: 1px solid var(--blue-light); }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="inv-page">
        <div className="corner corner-tl" />
        <div className="corner corner-br" />

        <div className="container">
          <div className="wordmark">
            <span className="xpt">XPT</span>
            <span className="dash">-</span>
            <span className="inv">Inventory</span>
          </div>

          <div className="tagline">Proposals · Products · Stock · Operations</div>

          <div className="divider" />

          <div className="status-bar">
            <div className="dot" />
            PLATFORM LIVE
          </div>

          <div className="headline">
            From <span className="accent">proposal</span> to shelf — all in one place.
          </div>

          <p className="sub">
            A product lifecycle management platform built for small businesses —
            proposal approvals, multi-location inventory, role-based access, and
            support tickets under one roof.
          </p>

          <div className="auth-actions">
            <button
              className="btn-primary"
              onClick={() => loginWithRedirect({ appState: { returnTo: '/dashboard' } })}
            >
              Sign In
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button
              className="btn-outline"
              onClick={() => loginWithRedirect({
                appState: { returnTo: '/dashboard' },
                authorizationParams: { screen_hint: 'signup' },
              })}
            >
              Register
            </button>
          </div>

          <div className="services">
            <div className="pill"><div className="pill-dot" />Product Proposals</div>
            <div className="pill"><div className="pill-dot" />Multi-Location Stock</div>
            <div className="pill"><div className="pill-dot" />Role-Based Access</div>
            <div className="pill"><div className="pill-dot" />Stock Movements</div>
            <div className="pill"><div className="pill-dot" />Support Tickets</div>
          </div>
        </div>

        <div className="domain">
          <span>inv</span>.xpt-tech.com
        </div>
      </div>
    </>
  )
}
