/**
 * Sidebar — main navigation for the protected layout.
 *
 * Desktop: fixed left panel (w-56).
 * Mobile (<md): hidden by default, opened via hamburger in TopBar.
 */
'use client'

import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  FileText,
  Package,
  Warehouse,
  ArrowLeftRight,
  LifeBuoy,
  Settings,
  ShieldCheck,
  ChevronDown,
  Plus,
  KeyRound,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useOrg } from '@/contexts/OrgContext'

// ── Mobile sidebar context ───────────────────────────────────────────────

interface SidebarContextValue {
  mobileOpen: boolean
  setMobileOpen: (open: boolean) => void
  toggle: () => void
}

const SidebarContext = createContext<SidebarContextValue>({
  mobileOpen: false,
  setMobileOpen: () => {},
  toggle: () => {},
})

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const toggle = useCallback(() => setMobileOpen(prev => !prev), [])
  return (
    <SidebarContext.Provider value={{ mobileOpen, setMobileOpen, toggle }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  return useContext(SidebarContext)
}

// ── Nav config ───────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { label: 'Dashboard',   href: '/dashboard',            icon: LayoutDashboard, section: 'main' },
  { label: 'Proposals',   href: '/proposals',            icon: FileText,        section: 'products' },
  { label: 'Products',    href: '/products',             icon: Package,         section: 'products' },
  { label: 'Inventory',   href: '/inventory',            icon: Warehouse,       section: 'inventory' },
  { label: 'Movements',   href: '/inventory/movements',  icon: ArrowLeftRight,  section: 'inventory' },
  { label: 'Tickets',     href: '/tickets',              icon: LifeBuoy,        section: 'support' },
  { label: 'Settings',    href: '/settings',             icon: Settings,        section: 'support' },
]

const ADMIN_ITEM = { label: 'Admin', href: '/admin', icon: ShieldCheck, section: 'admin' }

// ── Sidebar component ────────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname()
  const { mobileOpen, setMobileOpen } = useSidebar()
  const { activeOrg } = useOrg()
  const isAdmin = false // TODO: check user profile isAdmin

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname, setMobileOpen])

  const sidebarContent = (
    <>
      <div className="border-b px-3 py-3">
        <div className="flex items-center justify-between px-2 mb-2">
          <span className="text-xs font-semibold text-teal-700 tracking-wide">XPT-Inventory</span>
          <button
            onClick={() => setMobileOpen(false)}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground md:hidden"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <OrgSwitcher />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5" aria-label="Main navigation">
        {NAV_ITEMS.filter(i => i.section === 'main').map(item => (
          <NavLink key={item.href} item={item} active={pathname === item.href} />
        ))}

        <SectionLabel label="Products" />
        {NAV_ITEMS.filter(i => i.section === 'products').map(item => (
          <NavLink key={item.href} item={item} active={pathname.startsWith(item.href)} />
        ))}

        <SectionLabel label="Inventory" />
        {NAV_ITEMS.filter(i => i.section === 'inventory').map(item => (
          <NavLink key={item.href} item={item} active={pathname === item.href} />
        ))}

        <SectionLabel label="Support" />
        {NAV_ITEMS.filter(i => i.section === 'support').map(item => (
          <NavLink key={item.href} item={item} active={pathname.startsWith(item.href)} />
        ))}

        {isAdmin && (
          <>
            <SectionLabel label="Admin" />
            <NavLink item={ADMIN_ITEM} active={pathname.startsWith('/admin')} />
          </>
        )}
      </nav>

      {/* Role badge */}
      {activeOrg && (
        <div className="border-t px-4 py-3 text-xs text-muted-foreground">
          Role: <span className="font-medium capitalize text-foreground">{activeOrg.role}</span>
        </div>
      )}
    </>
  )

  return (
    <>
      <aside className="hidden md:flex h-screen w-56 shrink-0 flex-col border-r bg-card">
        {sidebarContent}
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-card shadow-lg transition-transform duration-200 ease-in-out md:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {sidebarContent}
      </aside>
    </>
  )
}

// ── Org switcher ────────────────────────────────────────────────────────

function OrgSwitcher() {
  const { activeOrg, organizations, setActiveOrgId } = useOrg()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  if (!activeOrg) return null

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm font-medium text-foreground hover:bg-accent transition-colors"
        aria-expanded={open}
      >
        <span className="truncate">{activeOrg.name}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border bg-popover shadow-md">
          {organizations.map(org => (
            <button
              key={org.orgId}
              onClick={() => { setActiveOrgId(org.orgId); setOpen(false) }}
              className={cn(
                'flex w-full items-center px-3 py-2 text-sm transition-colors hover:bg-accent',
                org.orgId === activeOrg.orgId && 'bg-accent font-medium'
              )}
            >
              <span className="truncate">{org.name}</span>
              <span className="ml-auto text-xs text-muted-foreground">{org.role}</span>
            </button>
          ))}
          <div className="border-t">
            <button
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
              New Organization
            </button>
            <button
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <KeyRound className="h-3.5 w-3.5" />
              Join with Code
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="px-2 pb-1 pt-4 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
      {label}
    </p>
  )
}

function NavLink({ item, active }: { item: { label: string; href: string; icon: React.ComponentType<{ className?: string }> }; active: boolean }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : 'text-foreground hover:bg-accent hover:text-accent-foreground'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {item.label}
    </Link>
  )
}
