'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useOrg } from '@/contexts/OrgContext'
import { useApiClient } from '@/hooks/useApiClient'
import { Plus, Package } from 'lucide-react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'

const STATUS_STYLES: Record<string, string> = {
  DRAFT:        'bg-muted text-muted-foreground',
  ACTIVE:       'bg-green-100 text-green-700',
  DISCONTINUED: 'bg-red-100 text-red-600',
}

export default function ProductsPage() {
  const api = useApiClient()
  const { activeOrg } = useOrg()
  const orgId = activeOrg?.orgId
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['products', orgId, statusFilter],
    queryFn: () => api.listProducts(orgId!, statusFilter ? { status: statusFilter } : undefined),
    enabled: !!orgId,
  })

  const products = (data?.products ?? []).filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground">Your product catalog</p>
        </div>
        {(activeOrg?.role === 'manager' || activeOrg?.role === 'owner') && (
          <Link
            href="/products/new"
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" /> New Product
          </Link>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search name or SKU…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary w-48"
        />
        {['', 'ACTIVE', 'DRAFT', 'DISCONTINUED'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              statusFilter === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      <div className="rounded-lg border overflow-x-auto">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-10 animate-pulse rounded bg-muted" />)}
          </div>
        ) : isError ? (
          <p className="p-6 text-center text-sm text-destructive">Failed to load products.</p>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Package className="h-8 w-8 text-muted-foreground/40" />
            <p className="mt-2 text-sm text-muted-foreground">No products found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">SKU</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">Category</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground hidden md:table-cell">Price</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Added</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.productId} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/products/${p.productId}`} className="font-medium hover:text-primary transition-colors">
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">{p.sku}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{p.category ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[p.status] ?? ''}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums hidden md:table-cell">
                    {p.unitPrice != null ? `$${p.unitPrice.toFixed(2)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                    {format(parseISO(p.createdAt), 'MMM d, yyyy')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
