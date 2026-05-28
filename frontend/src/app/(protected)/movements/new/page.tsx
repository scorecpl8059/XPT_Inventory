'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useOrg } from '@/contexts/OrgContext'
import { useApiClient } from '@/hooks/useApiClient'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

const MOVEMENT_TYPES = ['RECEIPT', 'SHIPMENT', 'TRANSFER', 'ADJUSTMENT', 'RETURN']

export default function NewMovementPage() {
  const router = useRouter()
  const api = useApiClient()
  const qc = useQueryClient()
  const { activeOrg } = useOrg()
  const orgId = activeOrg?.orgId

  const [type, setType]           = useState('RECEIPT')
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity]   = useState('')
  const [fromLocId, setFromLoc]   = useState('')
  const [toLocId, setToLoc]       = useState('')
  const [reason, setReason]       = useState('')

  const { data: productsData } = useQuery({
    queryKey: ['products', orgId],
    queryFn: () => api.listProducts(orgId!, { status: 'ACTIVE' }),
    enabled: !!orgId,
  })

  const { data: locData } = useQuery({
    queryKey: ['locations', orgId],
    queryFn: () => api.listLocations(orgId!),
    enabled: !!orgId,
  })

  const products  = productsData?.products ?? []
  const locations = locData?.locations ?? []

  const mutation = useMutation({
    mutationFn: () => api.createMovement(orgId!, {
      productId, type,
      quantity: parseInt(quantity, 10),
      fromLocId: fromLocId || undefined,
      toLocId:   toLocId || undefined,
      reason:    reason || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['movements', orgId] })
      qc.invalidateQueries({ queryKey: ['stock', orgId] })
      toast.success('Movement recorded')
      router.push('/inventory/movements')
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to record movement'),
  })

  const needsFrom = type === 'SHIPMENT' || type === 'TRANSFER'
  const needsTo   = type === 'RECEIPT' || type === 'RETURN' || type === 'TRANSFER' || type === 'ADJUSTMENT'

  const f = 'w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!productId || !quantity) return
    mutation.mutate()
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/inventory/movements" className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Record Movement</h1>
          <p className="text-sm text-muted-foreground">Log a stock change</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="rounded-lg border bg-card p-5 space-y-4">
        {/* Type selector */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Movement Type <span className="text-destructive">*</span></label>
          <div className="flex flex-wrap gap-2">
            {MOVEMENT_TYPES.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`rounded-full px-3 py-1 text-sm font-medium border transition-colors ${
                  type === t ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Product */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Product <span className="text-destructive">*</span></label>
          <select className={f} value={productId} onChange={e => setProductId(e.target.value)} required>
            <option value="">Select product…</option>
            {products.map(p => <option key={p.productId} value={p.productId}>{p.name} ({p.sku})</option>)}
          </select>
        </div>

        {/* Quantity */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Quantity <span className="text-destructive">*</span></label>
          <input className={f} type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="Enter quantity" required />
        </div>

        {/* From location */}
        {needsFrom && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium">From Location <span className="text-destructive">*</span></label>
            <select className={f} value={fromLocId} onChange={e => setFromLoc(e.target.value)}>
              <option value="">Select location…</option>
              {locations.map(l => <option key={l.locationId} value={l.locationId}>{l.name}</option>)}
            </select>
          </div>
        )}

        {/* To location */}
        {needsTo && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium">To Location <span className="text-destructive">*</span></label>
            <select className={f} value={toLocId} onChange={e => setToLoc(e.target.value)}>
              <option value="">Select location…</option>
              {locations.map(l => <option key={l.locationId} value={l.locationId}>{l.name}</option>)}
            </select>
          </div>
        )}

        {/* Reason */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Reason / Notes</label>
          <input className={f} value={reason} onChange={e => setReason(e.target.value)} placeholder="Optional notes about this movement" />
        </div>

        <div className="flex gap-3 pt-2">
          <Link href="/inventory/movements" className="flex-1 rounded-md border px-4 py-2 text-center text-sm font-medium hover:bg-accent transition-colors">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={mutation.isPending || !productId || !quantity}
            className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {mutation.isPending ? 'Recording…' : 'Record Movement'}
          </button>
        </div>
      </form>
    </div>
  )
}
