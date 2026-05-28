'use client'

import { useQuery } from '@tanstack/react-query'
import { useOrg } from '@/contexts/OrgContext'
import { useApiClient } from '@/hooks/useApiClient'
import { FileText, Package, AlertTriangle, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'

function StatCard({ title, value, icon: Icon, href, color }: {
  title: string
  value: number | string | undefined
  icon: React.ComponentType<{ className?: string }>
  href: string
  color: string
}) {
  return (
    <Link href={href} className="rounded-lg border bg-card p-5 hover:bg-accent/30 transition-colors block">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">
            {value === undefined ? <span className="h-8 w-16 animate-pulse rounded bg-muted inline-block" /> : value}
          </p>
        </div>
        <div className={`rounded-lg p-2 ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        View all <ArrowRight className="h-3 w-3" />
      </div>
    </Link>
  )
}

export default function DashboardPage() {
  const api = useApiClient()
  const { activeOrg } = useOrg()
  const orgId = activeOrg?.orgId

  const { data: proposalsData } = useQuery({
    queryKey: ['proposals', orgId, 'SUBMITTED'],
    queryFn: () => api.listProposals(orgId!, { status: 'SUBMITTED' }),
    enabled: !!orgId,
  })

  const { data: inReviewData } = useQuery({
    queryKey: ['proposals', orgId, 'IN_REVIEW'],
    queryFn: () => api.listProposals(orgId!, { status: 'IN_REVIEW' }),
    enabled: !!orgId,
  })

  const { data: productsData } = useQuery({
    queryKey: ['products', orgId],
    queryFn: () => api.listProducts(orgId!, { status: 'ACTIVE' }),
    enabled: !!orgId,
  })

  const { data: stockData } = useQuery({
    queryKey: ['stock', orgId],
    queryFn: () => api.listStock(orgId!),
    enabled: !!orgId,
  })

  const { data: ticketsData } = useQuery({
    queryKey: ['tickets', orgId],
    queryFn: () => api.listTickets(orgId!),
    enabled: !!orgId,
  })

  const pendingProposals = (proposalsData?.proposals?.length ?? 0) + (inReviewData?.proposals?.length ?? 0)
  const lowStockItems = (stockData?.stock ?? []).filter(s => s.reorderPoint > 0 && s.quantity <= s.reorderPoint)
  const openTickets = (ticketsData?.tickets ?? []).filter(t => t.status === 'OPEN' || t.status === 'IN_PROGRESS')
  const recentProposals = [...(proposalsData?.proposals ?? []), ...(inReviewData?.proposals ?? [])]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5)

  const proposalsLoading  = !proposalsData && !inReviewData
  const productsLoading   = !productsData
  const stockLoading      = !stockData
  const ticketsLoading    = !ticketsData

  if (!orgId) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <p>No organization selected.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">{activeOrg?.name}</p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Pending Proposals"
          value={proposalsLoading ? undefined : pendingProposals}
          icon={FileText}
          href="/proposals"
          color="bg-amber-100 text-amber-700"
        />
        <StatCard
          title="Active Products"
          value={productsLoading ? undefined : productsData?.products?.length ?? 0}
          icon={Package}
          href="/products"
          color="bg-primary/10 text-primary"
        />
        <StatCard
          title="Low Stock Alerts"
          value={stockLoading ? undefined : lowStockItems.length}
          icon={AlertTriangle}
          href="/inventory"
          color={lowStockItems.length > 0 ? 'bg-red-100 text-red-600' : 'bg-muted text-muted-foreground'}
        />
        <StatCard
          title="Open Tickets"
          value={ticketsLoading ? undefined : openTickets.length}
          icon={FileText}
          href="/tickets"
          color="bg-blue-100 text-blue-700"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pending proposals */}
        <div className="rounded-lg border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="font-medium">Pending Proposals</h2>
            <Link href="/proposals" className="text-xs text-muted-foreground hover:text-foreground">View all</Link>
          </div>
          {proposalsLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(3)].map((_, i) => <div key={i} className="h-10 animate-pulse rounded bg-muted" />)}
            </div>
          ) : recentProposals.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No pending proposals</p>
          ) : (
            <div className="divide-y">
              {recentProposals.map(p => (
                <Link key={p.proposalId} href={`/proposals/${p.proposalId}`} className="flex items-center justify-between px-4 py-3 hover:bg-accent/30 transition-colors">
                  <div>
                    <p className="text-sm font-medium">{p.title}</p>
                    <p className="text-xs text-muted-foreground">{p.createdByName} · {format(parseISO(p.createdAt), 'MMM d')}</p>
                  </div>
                  <StatusBadge status={p.status} />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Low stock alerts */}
        <div className="rounded-lg border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="font-medium">Low Stock Alerts</h2>
            <Link href="/inventory" className="text-xs text-muted-foreground hover:text-foreground">View all</Link>
          </div>
          {stockLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(3)].map((_, i) => <div key={i} className="h-10 animate-pulse rounded bg-muted" />)}
            </div>
          ) : lowStockItems.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">All stock levels are healthy</p>
          ) : (
            <div className="divide-y">
              {lowStockItems.slice(0, 5).map(s => (
                <div key={`${s.productId}-${s.locationId}`} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium font-mono">{s.productId.slice(-8)}</p>
                    <p className="text-xs text-muted-foreground">Qty: {s.quantity} / Reorder at: {s.reorderPoint}</p>
                  </div>
                  <span className="text-xs font-medium text-red-600">Low</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT:          'bg-muted text-muted-foreground',
    SUBMITTED:      'bg-amber-100 text-amber-700',
    IN_REVIEW:      'bg-blue-100 text-blue-700',
    APPROVED:       'bg-green-100 text-green-700',
    REJECTED:       'bg-red-100 text-red-600',
    PRODUCT_CREATED:'bg-primary/10 text-primary',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${map[status] ?? 'bg-muted text-muted-foreground'}`}>
      {status.replace('_', ' ')}
    </span>
  )
}
