'use client'

import { useAuth0 } from '@auth0/auth0-react'
import Image from 'next/image'
import { LogOut, User, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useOrg } from '@/contexts/OrgContext'
import { useSidebar } from '@/components/layout/Sidebar'

export function TopBar() {
  const { user, logout } = useAuth0()
  const { activeOrg } = useOrg()
  const { toggle } = useSidebar()

  const handleLogout = () => {
    logout({
      logoutParams: {
        returnTo: typeof window !== 'undefined' ? window.location.origin : '',
      },
    })
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-4 sm:px-6">
      <button
        onClick={toggle}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
        aria-label="Open navigation menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="hidden md:block" />

      <div className="flex items-center gap-2 sm:gap-3">
        {user?.picture ? (
          <Image
            src={user.picture}
            alt={user.name ?? 'User'}
            width={28}
            height={28}
            className="rounded-full object-cover"
          />
        ) : (
          <User className="h-5 w-5 text-muted-foreground" />
        )}
        <span className="hidden text-sm text-muted-foreground sm:inline">
          {user?.name ?? user?.email}
        </span>
        {activeOrg && (
          <span className={cn(
            'hidden items-center rounded-full px-2 py-0.5 text-xs font-medium sm:inline-flex',
            activeOrg.role === 'owner'
              ? 'bg-primary/10 text-primary'
              : activeOrg.role === 'manager'
                ? 'bg-amber-100 text-amber-700'
                : 'bg-muted text-muted-foreground'
          )}>
            {activeOrg.role.charAt(0).toUpperCase() + activeOrg.role.slice(1)}
          </span>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:px-3"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </header>
  )
}
