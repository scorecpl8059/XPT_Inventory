'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useOrg } from '@/contexts/OrgContext'
import { useApiClient } from '@/hooks/useApiClient'
import { Warehouse, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

export default function InventoryPage() {
  const api = useApiClient()
  const { activeOrg } = useOrg()
  const orgId = activeOrg?.orgId
  const [locationFilter, setLocationFilter] = useState('')
  const [showLowOnly, setShowLowOnly] = useState(false)

  const { data: locData } = useQuery({
    queryKey: ['locations', orgId],
    queryFn: () => api.listLocations(orgId!),
    enabled: !!orgId,
  })

  const { data: stockData, isLoading } = useQuery({
    queryKey: ['stock', orgId, locationFilter],
    queryFn: () => api.listStock(orgId!, locationFilter ? { locationId: locationFilter } : undefined),
    enabled: !!orgId,
  })

  const locations = locData?.locations ?? []
  const locationMap = Object.fromEntries(locations.map(l => [l.locationId, l.name]))

  const stock = (stockData?.stock ?? []).filter(s =>
    !showLowOnly || (s.reorderPoint > 0 && s.quantity <= s.reorderPoint)
  )

  const lowCount = (stockData?.stock ?? []).filter(s => s.reorderPoint > 0 && s.quantity <= s.reorderPoint).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground">Stock levels across all locations</p>
        </div>
        <Link
          href="/inventory/movements"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          View movements →
        </Link>
      </div>

      {lowCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span><strong>{lowCount}</strong> item{lowCount !== 1 ? 's' : ''} at or below reorder point.</span>
          <button onClick={() => setShowLowOnly(!showLowOnly)} className="ml-auto underline text-xs">
            {showLowOnly ? 'Show all' : 'Show only low stock'}
          </button>
        </div>
      )}

      <div className="flex gap-3 flex-wrap items-center">
        <select
          value={locationFilter}
          onChange={e => setLocationFilter(e.target.value)}
          className="rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">All locations</option>
          {locations.map(l => <option key={l.locationId} value={l.locationId}>{l.name}</option>)}
        </select>
        {showLowOnly && (
          <button onClick={() => setShowLowOnly(false)} className="text-sm text-muted-foreground hover:text-foreground">
            Clear filter
          </button>
        )}
      </div>

      <div className="rounded-lg border overflow-x-auto">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(6)].map((_, i) => <div key={i} className="h-10 animate-pulse rounded bg-muted" />)}
          </div>
        ) : stock.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Warehouse className="h-8 w-8 text-muted-foreground/40" />
            <p className="mt-2 text-sm text-muted-foreground">No stock records found</p>
            <Link href="/movements/new" className="mt-3 text-sm text-primary hover:underline">Record a movement</Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Product ID</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Location</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Quantity</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground hidden sm:table-cell">Reorder At</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {stock.map(s => {
                const isLow = s.reorderPoint > 0 && s.quantity <= s.reorderPoint
                return (
                  <tr key={`${s.productId}-${s.locationId}`} className={`border-b last:border-0 ${isLow ? 'bg-red-50/50' : ''}`}>
                    <td className="px-4 py-3">
                      <Link href={`/products/${s.productId}`} className="font-mono text-xs hover:text-primary transition-colors">
                        {s.productId}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {locationMap[s.locationId] ?? s.locationId}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">{s.quantity}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground hidden sm:table-cell">{s.reorderPoint}</td>
                    <td className="px-4 py-3">
                      {isLow ? (
                        <span className="text-xs font-medium text-red-600 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> Low
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-green-700">OK</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
