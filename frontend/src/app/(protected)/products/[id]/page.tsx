'use client'

import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useOrg } from '@/contexts/OrgContext'
import { useApiClient } from '@/hooks/useApiClient'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'

const STATUS_STYLES: Record<string, string> = {
  DRAFT:        'bg-muted text-muted-foreground',
  ACTIVE:       'bg-green-100 text-green-700',
  DISCONTINUED: 'bg-red-100 text-red-600',
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const api = useApiClient()
  const { activeOrg } = useOrg()
  const orgId = activeOrg?.orgId

  const { data, isLoading } = useQuery({
    queryKey: ['product', orgId, id],
    queryFn: () => api.getProduct(orgId!, id),
    enabled: !!orgId && !!id,
  })

  const { data: stockData } = useQuery({
    queryKey: ['stock', orgId, id],
    queryFn: () => api.getStockByProduct(orgId!, id),
    enabled: !!orgId && !!id,
  })

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        {[...Array(3)].map((_, i) => <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />)}
      </div>
    )
  }

  const product = data?.product ?? (data as unknown as { productId: string; name: string; sku: string; status: string; category?: string; unitPrice?: number; cost?: number; description?: string; createdAt: string })
  const variants = data?.variants ?? []

  if (!product) return <p className="text-center text-muted-foreground py-16">Product not found.</p>

  const stockLevels = stockData?.stock ?? []
  const totalStock = stockLevels.reduce((sum, s) => sum + s.quantity, 0)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start gap-3">
        <Link href="/products" className="mt-1 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[product.status] ?? ''}`}>
              {product.status}
            </span>
          </div>
          <p className="text-sm text-muted-foreground font-mono">{product.sku}</p>
        </div>
      </div>

      {/* Product details */}
      <div className="rounded-lg border bg-card p-5 space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Details</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {product.category && <div><p className="text-xs text-muted-foreground">Category</p><p className="font-medium">{product.category}</p></div>}
          {product.unitPrice != null && <div><p className="text-xs text-muted-foreground">Unit Price</p><p className="font-medium tabular-nums">${product.unitPrice.toFixed(2)}</p></div>}
          {product.cost != null && <div><p className="text-xs text-muted-foreground">Cost</p><p className="font-medium tabular-nums">${product.cost.toFixed(2)}</p></div>}
          <div><p className="text-xs text-muted-foreground">Total Stock</p><p className="font-medium tabular-nums">{totalStock} units</p></div>
          <div><p className="text-xs text-muted-foreground">Created</p><p className="font-medium">{format(parseISO(product.createdAt), 'MMM d, yyyy')}</p></div>
        </div>
        {product.description && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Description</p>
            <p className="text-sm">{product.description}</p>
          </div>
        )}
      </div>

      {/* Stock levels */}
      <div className="rounded-lg border bg-card">
        <h2 className="border-b px-4 py-3 text-sm font-semibold">Stock by Location</h2>
        {stockLevels.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No stock recorded yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Location ID</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Qty</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Reorder At</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {stockLevels.map(s => (
                <tr key={s.locationId} className="border-b last:border-0">
                  <td className="px-4 py-3 font-mono text-xs">{s.locationId}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">{s.quantity}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{s.reorderPoint}</td>
                  <td className="px-4 py-3">
                    {s.reorderPoint > 0 && s.quantity <= s.reorderPoint ? (
                      <span className="text-xs font-medium text-red-600">Low</span>
                    ) : (
                      <span className="text-xs font-medium text-green-700">OK</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Variants */}
      {variants.length > 0 && (
        <div className="rounded-lg border bg-card">
          <h2 className="border-b px-4 py-3 text-sm font-semibold">Variants</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Price</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Cost</th>
              </tr>
            </thead>
            <tbody>
              {variants.map(v => (
                <tr key={v.variantId} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{v.variantName}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{v.price != null ? `$${v.price.toFixed(2)}` : '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{v.cost != null ? `$${v.cost.toFixed(2)}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
