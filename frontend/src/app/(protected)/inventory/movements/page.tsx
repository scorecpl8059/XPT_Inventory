'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useOrg } from '@/contexts/OrgContext'
import { useApiClient } from '@/hooks/useApiClient'
import { Plus, ArrowLeftRight } from 'lucide-react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'

const TYPE_STYLES: Record<string, string> = {
  RECEIPT:    'bg-green-100 text-green-700',
  SHIPMENT:   'bg-red-100 text-red-600',
  TRANSFER:   'bg-blue-100 text-blue-700',
  ADJUSTMENT: 'bg-amber-100 text-amber-700',
  RETURN:     'bg-purple-100 text-purple-700',
}

export default function MovementsPage() {
  const api = useApiClient()
  const { activeOrg } = useOrg()
  const orgId = activeOrg?.orgId
  const [typeFilter, setTypeFilter] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['movements', orgId, typeFilter],
    queryFn: () => api.listMovements(orgId!, typeFilter ? { type: typeFilter } : undefined),
    enabled: !!orgId,
  })

  const movements = data?.movements ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Stock Movements</h1>
          <p className="text-sm text-muted-foreground">History of all inventory changes</p>
        </div>
        <Link
          href="/movements/new"
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> Record Movement
        </Link>
      </div>

      <div className="flex gap-1 flex-wrap">
        {['', 'RECEIPT', 'SHIPMENT', 'TRANSFER', 'ADJUSTMENT', 'RETURN'].map(t => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              typeFilter === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {t || 'All'}
          </button>
        ))}
      </div>

      <div className="rounded-lg border overflow-x-auto">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(6)].map((_, i) => <div key={i} className="h-10 animate-pulse rounded bg-muted" />)}
          </div>
        ) : movements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <ArrowLeftRight className="h-8 w-8 text-muted-foreground/40" />
            <p className="mt-2 text-sm text-muted-foreground">No movements recorded</p>
            <Link href="/movements/new" className="mt-3 text-sm text-primary hover:underline">Record first movement</Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Product</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Qty</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">By</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Reason</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Date</th>
              </tr>
            </thead>
            <tbody>
              {movements.map(m => (
                <tr key={m.movementId} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/products/${m.productId}`} className="font-medium hover:text-primary transition-colors">
                      {m.productName}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_STYLES[m.type] ?? ''}`}>
                      {m.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">{m.quantity}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{m.createdByName}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{m.reason ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                    {format(parseISO(m.createdAt), 'MMM d, h:mm a')}
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
