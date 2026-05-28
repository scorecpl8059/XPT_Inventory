'use client'

import { useAuth0 } from '@auth0/auth0-react'
import { Sidebar, SidebarProvider } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { OrgProvider, useOrg } from '@/contexts/OrgContext'

/**
 * OrgProvider is mounted unconditionally at this level — it must NOT sit
 * inside an auth-conditional render because Auth0's isLoading can briefly flip
 * to true during token refresh, which would unmount/remount the provider and
 * trigger repeated API calls (visible as an infinite refresh loop).
 *
 * OrgProvider waits for isAuthenticated internally before fetching.
 */
export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <OrgProvider>
      <SidebarProvider>
        <ProtectedShell>{children}</ProtectedShell>
      </SidebarProvider>
    </OrgProvider>
  )
}

function ProtectedShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading: authLoading, loginWithRedirect } = useAuth0()
  const { isLoading: orgLoading } = useOrg()

  if (authLoading || (isAuthenticated && orgLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" aria-label="Loading" role="status" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-2xl font-semibold">XPT-Inventory</h1>
          <button
            onClick={() => loginWithRedirect({ appState: { returnTo: window.location.pathname } })}
            className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Sign In
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
